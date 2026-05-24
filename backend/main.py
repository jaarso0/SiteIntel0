import os
import uuid
import json
import asyncio
from urllib.parse import urljoin, parse_qs
from fastapi import FastAPI, BackgroundTasks, Request, Response
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from groq import Groq
import httpx

# Load environment variables
load_dotenv(override=True)

from crawler.orchestrator import crawl_site, find_competitors, crawl_competitors
from crawler.extractor import fetch_and_extract
from crawler.classifier import classify
from store.db import get_db, get_crawled_pages, save_kb_to_cache, get_kb_from_cache, save_page, save_active_job, get_active_job
from agents.kb_architect import build_kb
from agents.auditor import audit
from rag.chunker import chunk_article
from rag.retriever import index_chunks, search

app = FastAPI(title="SiteIntel API")

# Configure CORS for React development server
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory jobs tracking
jobs = {}

class CrawlRequest(BaseModel):
    url: str

class ChatRequest(BaseModel):
    job_id: str
    message: str
    use_kb: bool = True
    is_voice: bool = False

def get_chat_client():
    """Helper to select either Groq or Gemini based on configured keys"""
    groq_key = os.getenv("GROQ_API_KEY")
    if groq_key and groq_key != "your_key_here":
        try:
            return "groq", Groq(api_key=groq_key)
        except Exception as e:
            print(f"Error configuring Groq: {e}")
            
    gemini_key = os.getenv("GEMINI_API_KEY")
    if gemini_key and gemini_key != "your_key_here":
        try:
            import google.generativeai as genai
            genai.configure(api_key=gemini_key, transport="rest")
            return "gemini", genai.GenerativeModel("gemini-2.5-flash")
        except Exception as e:
            print(f"Error configuring Gemini: {e}")
            
    return None, None

async def crawl_specific_urls(site_url: str, hints: list[str]) -> list[dict]:
    db = get_db()
    extra_pages = []
    # Crawl max 3 specific URLs flagged by auditor
    for hint in hints[:3]:
        if not hint:
            continue
        if hint.startswith("http"):
            url = hint
        else:
            url = urljoin(site_url, hint)
        print(f"Auditor requested re-crawl: {url}")
        try:
            res = await fetch_and_extract(url)
            if res["html"]:
                page_type = classify(url, res["title"])
                save_page(db, site_url, url, page_type, res["title"], res["content"])
                extra_pages.append({
                    "url": url,
                    "content": res["content"],
                    "title": res["title"],
                    "page_type": page_type
                })
        except Exception as e:
            print(f"Failed to fetch re-crawl URL {url}: {e}")
    return extra_pages

async def run_pipeline(job_id: str, seed_url: str):
    seed_url = seed_url.rstrip("/")
    db = get_db()
    jobs[job_id]["site_url"] = seed_url
    try:
        # Check cache first for instant load
        cached_kb_json = get_kb_from_cache(db, seed_url)
        if cached_kb_json:
            print(f"Serving cached KB for {seed_url}")
            kb = json.loads(cached_kb_json)
            jobs[job_id]["progress"] = 90
            jobs[job_id]["status"] = "indexing"
            
            # Re-index cache into RAG just in case
            all_chunks = []
            for article in kb.get("kb_articles", []):
                chunks = chunk_article(article, seed_url, chunk_size=300, overlap=30)
                all_chunks.extend(chunks)
            index_chunks(all_chunks)
            
            jobs[job_id]["progress"] = 100
            jobs[job_id]["status"] = "ready"
            jobs[job_id]["kb"] = kb
            save_active_job(db, job_id, seed_url, cached_kb_json)
            return

        # Start primary crawl and competitor crawl concurrently
        jobs[job_id]["status"] = "crawling"
        jobs[job_id]["progress"] = 10
        
        competitors = find_competitors(seed_url)
        print(f"Discovered competitors to analyze: {competitors}")
        
        # Execute primary site crawl and competitor main page crawls in parallel
        await asyncio.gather(
            crawl_site(seed_url, max_pages=20),
            crawl_competitors_task := asyncio.create_task(crawl_competitors(competitors))
        )
        
        competitor_pages = crawl_competitors_task.result()
        pages = get_crawled_pages(db, seed_url)
        
        if not pages:
            raise ValueError("No pages crawled successfully")
            
        jobs[job_id]["progress"] = 40
        jobs[job_id]["status"] = "building_kb"
        
        # Build KB with both site content and competitor content
        kb = build_kb(pages, competitor_pages)
        jobs[job_id]["progress"] = 70
        jobs[job_id]["status"] = "auditing"
        
        # Audit KB
        audit_res = audit(kb, pages)
        if audit_res["needs_recrawl"]:
            print(f"Quality audit flagged gaps. Re-crawling urls: {audit_res['recrawl_hints']}")
            jobs[job_id]["status"] = "re-crawling"
            extra_pages = await crawl_specific_urls(seed_url, audit_res["recrawl_hints"])
            if extra_pages:
                pages.extend(extra_pages)
                jobs[job_id]["status"] = "re-building_kb"
                kb = build_kb(pages, competitor_pages)
                
        # Save KB to cache
        save_kb_to_cache(db, seed_url, json.dumps(kb))
        jobs[job_id]["progress"] = 85
        jobs[job_id]["status"] = "indexing"
        
        # Index RAG
        all_chunks = []
        for article in kb.get("kb_articles", []):
            chunks = chunk_article(article, seed_url, chunk_size=300, overlap=30)
            all_chunks.extend(chunks)
            
        if all_chunks:
            index_chunks(all_chunks)
            
        jobs[job_id]["progress"] = 100
        jobs[job_id]["status"] = "ready"
        jobs[job_id]["kb"] = kb
        save_active_job(db, job_id, seed_url, json.dumps(kb))
        
    except Exception as e:
        print(f"Error in pipeline execution for job {job_id}: {e}")
        jobs[job_id]["status"] = "failed"
        jobs[job_id]["error"] = str(e)

async def stream_chat(message: str, use_kb: bool, system_prompt: str, site_url: str = None, history: list = None, is_voice: bool = False):
    if use_kb:
        chunks = search(message, site_url=site_url, n=5)
        context = "\n\n".join(
            f"[Source: {c['source_url']}]\n{c['text']}" for c in chunks
        )
        if is_voice:
            system = (
                f"{system_prompt}\n\n"
                f"CONTEXT:\n{context}\n\n"
                f"Guidelines for VOICE Call:\n"
                f"1. You are speaking on a real-time voice call. Be extremely warm, direct, and conversational.\n"
                f"2. Keep the response very concise (1 to 3 short sentences maximum).\n"
                f"3. Never output lists, bullet points, asterisks, markdown, or bracketed source citations like '[Source: ...]'.\n"
                f"4. Speak in natural paragraphs that are easy to hear. Answer ONLY from context. If you don't know, say you don't know."
            )
        else:
            system = f"{system_prompt}\n\nCONTEXT:\n{context}\n\nAnswer ONLY from context. Cite sources. Be specific."
    else:
        if is_voice:
            system = "You are a helpful voice assistant. Keep answers to 1-2 concise sentences."
        else:
            system = "You are a helpful assistant. You do not have access to any external knowledge base. Speak generally."

    provider, client = get_chat_client()
    history_list = history or []
    
    if provider == "groq":
        try:
            # Construct the conversational messages array
            messages = [{"role": "system", "content": system}]
            messages.extend(history_list)
            messages.append({"role": "user", "content": message})
            
            stream = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=messages,
                stream=True,
            )
            for chunk in stream:
                delta = chunk.choices[0].delta.content or ""
                yield delta
                await asyncio.sleep(0.01)
        except Exception as e:
            print(f"Groq API error: {e}")
            yield f"\n[Error streaming with Groq: {e}]"
            
    elif provider == "gemini":
        try:
            # Format system prompt, conversational turns, and user query for Gemini
            prompt_parts = [f"SYSTEM INSTRUCTIONS:\n{system}\n"]
            for turn in history_list:
                role_label = "USER" if turn["role"] == "user" else "ASSISTANT"
                prompt_parts.append(f"{role_label}: {turn['content']}")
            prompt_parts.append(f"USER: {message}")
            prompt = "\n\n".join(prompt_parts)
            
            response = client.generate_content(prompt, stream=True)
            for chunk in response:
                try:
                    # Safely access the text to avoid quick accessor crashes on safety/finish blocks
                    if chunk.candidates and chunk.candidates[0].content.parts:
                        text_part = chunk.text
                        if text_part:
                            yield text_part
                except Exception as e:
                    # Silence non-text chunk exceptions (e.g. final finish_reason metadata)
                    continue
                await asyncio.sleep(0.01)
        except Exception as e:
            print(f"Gemini API error during chat: {e}")
            yield f"\n[Error streaming with Gemini: {e}]"
            
    else:
        # Local mock streaming if no API keys are provided
        mock_response = f"[Grounding Check] Running in local mock mode (no API keys configured).\nQuery: '{message}'\n"
        if use_kb:
            mock_response += "Based on our indexed knowledge base, example.com is used for documentation and is not for operational purposes."
        else:
            mock_response += "I'm a general helpful assistant. I don't have local KB context, so I'm not sure!"
            
        for word in mock_response.split(" "):
            yield word + " "
            await asyncio.sleep(0.05)

@app.post("/crawl")
async def start_crawl(req: CrawlRequest):
    normalized_url = req.url.rstrip("/")
    job_id = str(uuid.uuid4())
    jobs[job_id] = {
        "job_id": job_id,
        "status": "pending",
        "progress": 0,
        "kb": None
    }
    # Persist job startup mapping in SQLite to handle restarts
    db = get_db()
    save_active_job(db, job_id, normalized_url)
    
    # Start the async pipeline task in the background
    asyncio.create_task(run_pipeline(job_id, normalized_url))
    return {"job_id": job_id}

@app.get("/status/{job_id}")
def get_status(job_id: str):
    job = jobs.get(job_id)
    if not job:
        db = get_db()
        db_job = get_active_job(db, job_id)
        if db_job:
            site_url, kb_json = db_job
            kb = json.loads(kb_json) if kb_json else None
            job = {
                "job_id": job_id,
                "status": "ready" if kb else "pending",
                "progress": 100 if kb else 0,
                "kb": kb,
                "site_url": site_url
            }
            jobs[job_id] = job
    return jobs.get(job_id, {"status": "not_found"})

@app.post("/chat")
async def chat_endpoint(req: ChatRequest):
    job = jobs.get(req.job_id)
    db = get_db()
    
    # Recover job configurations automatically from SQLite if the server reloaded/restarted
    if not job:
        db_job = get_active_job(db, req.job_id)
        if db_job:
            site_url_recovered, kb_json = db_job
            kb_recovered = json.loads(kb_json) if kb_json else None
            job = {
                "job_id": req.job_id,
                "status": "ready" if kb_recovered else "pending",
                "progress": 100 if kb_recovered else 0,
                "kb": kb_recovered,
                "site_url": site_url_recovered
            }
            jobs[req.job_id] = job
            print(f"Auto-recovered active job session {req.job_id} for RAG site: {site_url_recovered}")
            
    site_url = job.get("site_url") if job else None
    
    if job and job.get("kb"):
        system_prompt = job["kb"].get("system_prompt", "You are a helpful assistant.")
    else:
        system_prompt = "You are a helpful assistant."
        
    # Get or initialize history per job and per tenant (voice sandbox vs standard chat panel)
    if req.is_voice:
        history_key = "history_voice"
    else:
        history_key = "history_kb" if req.use_kb else "history_normal"
        
    if job:
        if history_key not in job:
            job[history_key] = []
        history = job[history_key]
    else:
        history = []
        
    async def chat_wrapper():
        full_response = ""
        async for chunk in stream_chat(req.message, req.use_kb, system_prompt, site_url, history, req.is_voice):
            full_response += chunk
            yield chunk
            
        # Once complete, save both user message and final response to history!
        if job:
            job[history_key].append({"role": "user", "content": req.message})
            job[history_key].append({"role": "assistant", "content": full_response})
            # Bound history to last 6 entries (3 full turns) to prevent context bloat
            job[history_key] = job[history_key][-6:]
            
    return StreamingResponse(chat_wrapper(), media_type="text/plain")

def clean_for_speech(text: str) -> str:
    import re
    # Strip markdown symbols, headers, citations, and brackets for synthetic reading
    text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)
    text = re.sub(r"\*([^*]+)\*", r"\1", text)
    text = re.sub(r"\[Source:\s*[^\]]+\]", "", text)
    text = re.sub(r"#[#\s\w]+", "", text)
    text = re.sub(r"-\s+", "", text)
    text = text.replace("\n", " ")
    # Replace multiple spaces with a single space
    text = re.sub(r"\s+", " ", text)
    return text.strip()

async def get_voice_response(message: str, system_prompt: str, site_url: str = None, history: list = None) -> str:
    if site_url:
        chunks = search(message, site_url=site_url, n=3)
        context = "\n\n".join(
            f"[Source: {c['source_url']}]\n{c['text']}" for c in chunks
        )
        system = (
            f"{system_prompt}\n\n"
            f"CONTEXT:\n{context}\n\n"
            f"Answer the user's question. Guidelines:\n"
            f"1. Be extremely concise, direct, and conversational. This is a real-time voice call.\n"
            f"2. Keep the answer to 1 to 3 sentences maximum.\n"
            f"3. Never output lists, bullet points, asterisks, markdown, or text citations like '[Source: ...]'.\n"
            f"4. If the answer is not in the context, say: 'I apologize, but I do not have that information in my knowledge base. How else can I assist you?'"
        )
    else:
        system = "You are a helpful voice assistant. Keep answers to 1-2 concise sentences."

    provider, client = get_chat_client()
    history_list = history or []
    
    if provider == "groq":
        try:
            messages = [{"role": "system", "content": system}]
            messages.extend(history_list)
            messages.append({"role": "user", "content": message})
            
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: client.chat.completions.create(
                    model="llama-3.3-70b-versatile",
                    messages=messages,
                    stream=False
                )
            )
            return response.choices[0].message.content or ""
        except Exception as e:
            print(f"Groq API error during voice response: {e}")
            return "I am sorry, I had trouble connecting to my brain. Can you repeat that?"
            
    elif provider == "gemini":
        try:
            prompt_parts = [f"SYSTEM INSTRUCTIONS:\n{system}\n"]
            for turn in history_list:
                role_label = "USER" if turn["role"] == "user" else "ASSISTANT"
                prompt_parts.append(f"{role_label}: {turn['content']}")
            prompt_parts.append(f"USER: {message}")
            prompt = "\n\n".join(prompt_parts)
            
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: client.generate_content(prompt)
            )
            return response.text or ""
        except Exception as e:
            print(f"Gemini API error during voice response: {e}")
            return "I am sorry, I had trouble connecting to my brain. Can you repeat that?"
            
    else:
        # Mock response when no API keys are loaded
        await asyncio.sleep(0.6)
        if "pricing" in message.lower() or "cost" in message.lower() or "plans" in message.lower():
            return f"Regarding pricing, please consult the website for current plans. In our knowledge base for {site_url or 'the site'}, plans are listed. Can I help you with anything else?"
        return f"Hello, this is a simulated response. You asked: {message}. We found grounding context for {site_url or 'the site'} in our local vector database."

def get_elevenlabs_key() -> str | None:
    key = os.getenv("ELEVENLABS_API_KEY")
    if not key or key == "your_key_here":
        return None
    key = key.strip()
    if key.startswith("sk_"):
        key = key[3:]
    return key

@app.post("/twilio/voice")
async def twilio_voice(request: Request):
    import urllib.parse
    job_id = request.query_params.get("job_id")
    job = jobs.get(job_id) if job_id else None
    
    company_name = "our business"
    if job:
        site_url = job.get("site_url", "")
        if site_url:
            company_name = site_url.replace("https://", "").replace("http://", "").split("/")[0].split(".")[0].title()
            
    api_key = get_elevenlabs_key()
    has_el = api_key is not None
    
    if has_el:
        base_url = str(request.base_url).rstrip("/")
        greeting = f"Hello! Thanks for calling the {company_name} AI assistant. How can I help you today?"
        encoded_greeting = urllib.parse.quote(greeting)
        twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Play>{base_url}/voice/tts?text={encoded_greeting}</Play>
    <Gather input="speech" action="/twilio/respond?job_id={job_id or ''}" method="POST" speechTimeout="auto" />
</Response>"""
    else:
        twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="Polly.Joanna-Neural">
        Hello! Thanks for calling the {company_name} AI assistant. How can I help you today?
    </Say>
    <Gather input="speech" action="/twilio/respond?job_id={job_id or ''}" method="POST" speechTimeout="auto" />
</Response>"""
        
    return Response(content=twiml, media_type="application/xml")

@app.post("/twilio/respond")
async def twilio_respond(request: Request):
    import urllib.parse
    job_id = request.query_params.get("job_id")
    job = jobs.get(job_id) if job_id else None
    
    body = await request.body()
    params = parse_qs(body.decode())
    speech_result = params.get("SpeechResult", [""])[0].strip()
    
    api_key = get_elevenlabs_key()
    has_el = api_key is not None
    base_url = str(request.base_url).rstrip("/")
    
    if not speech_result:
        prompt = "I didn't quite catch that. Can you please repeat your question?"
        if has_el:
            encoded_prompt = urllib.parse.quote(prompt)
            twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Play>{base_url}/voice/tts?text={encoded_prompt}</Play>
    <Gather input="speech" action="/twilio/respond?job_id={job_id or ''}" method="POST" speechTimeout="auto" />
</Response>"""
        else:
            twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="Polly.Joanna-Neural">
        {prompt}
    </Say>
    <Gather input="speech" action="/twilio/respond?job_id={job_id or ''}" method="POST" speechTimeout="auto" />
</Response>"""
        return Response(content=twiml, media_type="application/xml")
        
    site_url = job.get("site_url") if job else None
    system_prompt = "You are a helpful assistant."
    if job and job.get("kb"):
        system_prompt = job["kb"].get("system_prompt", system_prompt)
        
    history_key = "history_voice"
    if job:
        if history_key not in job:
            job[history_key] = []
        history = job[history_key]
    else:
        history = []
        
    raw_answer = await get_voice_response(speech_result, system_prompt, site_url, history)
    answer = clean_for_speech(raw_answer)
    
    if job:
        job[history_key].append({"role": "user", "content": speech_result})
        job[history_key].append({"role": "assistant", "content": answer})
        job[history_key] = job[history_key][-6:]
        
    if has_el:
        encoded_answer = urllib.parse.quote(answer)
        twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Play>{base_url}/voice/tts?text={encoded_answer}</Play>
    <Gather input="speech" action="/twilio/respond?job_id={job_id or ''}" method="POST" speechTimeout="auto" />
</Response>"""
    else:
        twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="Polly.Joanna-Neural">
        {answer}
    </Say>
    <Gather input="speech" action="/twilio/respond?job_id={job_id or ''}" method="POST" speechTimeout="auto" />
</Response>"""
        
    return Response(content=twiml, media_type="application/xml")

@app.get("/voice/tts")
async def elevenlabs_tts(text: str, voice_id: str = "21m00Tcm4TlvDq8ikWAM"):
    api_key = get_elevenlabs_key()
    if not api_key:
        return Response("ElevenLabs API Key not configured.", status_code=400)
        
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    headers = {
        "xi-api-key": api_key,
        "Content-Type": "application/json",
    }
    body = {
        "text": text,
        "model_id": "eleven_monolingual_v1",
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.75}
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, json=body, timeout=30.0)
            if response.status_code != 200:
                print(f"ElevenLabs API Error: {response.status_code} - {response.text}")
                return Response(f"ElevenLabs API returned error: {response.status_code}", status_code=500)
            
            # Return complete audio bytes as a standard HTTP response
            return Response(content=response.content, media_type="audio/mpeg")
    except Exception as e:
        print(f"Connection error to ElevenLabs: {e}")
        return Response(f"Failed to connect to ElevenLabs: {e}", status_code=500)

@app.get("/voice/status")
def get_voice_status():
    api_key = get_elevenlabs_key()
    return {"eleven_labs_active": api_key is not None}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
