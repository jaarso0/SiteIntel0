import os
import uuid
import json
import asyncio
from urllib.parse import urljoin
from fastapi import FastAPI, BackgroundTasks
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from groq import Groq

# Load environment variables
load_dotenv()

from crawler.orchestrator import crawl_site
from crawler.extractor import fetch_and_extract
from crawler.classifier import classify
from store.db import get_db, get_crawled_pages, save_kb_to_cache, get_kb_from_cache, save_page
from agents.kb_architect import build_kb
from agents.auditor import audit
from rag.chunker import chunk_article
from rag.retriever import index_chunks, search

app = FastAPI(title="SiteIntel API")

# Configure CORS for React development server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
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
            genai.configure(api_key=gemini_key)
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
    db = get_db()
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
                chunks = chunk_article(article, chunk_size=300, overlap=30)
                all_chunks.extend(chunks)
            index_chunks(all_chunks)
            
            jobs[job_id]["progress"] = 100
            jobs[job_id]["status"] = "ready"
            jobs[job_id]["kb"] = kb
            return

        # Start primary crawl
        jobs[job_id]["status"] = "crawling"
        jobs[job_id]["progress"] = 10
        await crawl_site(seed_url, max_pages=20)  # capped at 20 for fast demo
        
        pages = get_crawled_pages(db, seed_url)
        if not pages:
            raise ValueError("No pages crawled successfully")
            
        jobs[job_id]["progress"] = 40
        jobs[job_id]["status"] = "building_kb"
        
        # Build KB
        kb = build_kb(pages, [])
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
                kb = build_kb(pages, [])
                
        # Save KB to cache
        save_kb_to_cache(db, seed_url, json.dumps(kb))
        jobs[job_id]["progress"] = 85
        jobs[job_id]["status"] = "indexing"
        
        # Index RAG
        all_chunks = []
        for article in kb.get("kb_articles", []):
            chunks = chunk_article(article, chunk_size=300, overlap=30)
            all_chunks.extend(chunks)
            
        if all_chunks:
            index_chunks(all_chunks)
            
        jobs[job_id]["progress"] = 100
        jobs[job_id]["status"] = "ready"
        jobs[job_id]["kb"] = kb
        
    except Exception as e:
        print(f"Error in pipeline execution for job {job_id}: {e}")
        jobs[job_id]["status"] = "failed"
        jobs[job_id]["error"] = str(e)

async def stream_chat(message: str, use_kb: bool, system_prompt: str):
    if use_kb:
        chunks = search(message, n=5)
        context = "\n\n".join(
            f"[Source: {c['source_url']}]\n{c['text']}" for c in chunks
        )
        system = f"{system_prompt}\n\nCONTEXT:\n{context}\n\nAnswer ONLY from context. Cite sources. Be specific."
    else:
        system = "You are a helpful assistant. You do not have access to any external knowledge base. Speak generally."

    provider, client = get_chat_client()
    
    if provider == "groq":
        try:
            stream = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": message}
                ],
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
            # Format system prompt and user query for Gemini
            prompt = f"SYSTEM INSTRUCTIONS:\n{system}\n\nUSER QUESTION:\n{message}"
            response = client.generate_content(prompt, stream=True)
            for chunk in response:
                yield chunk.text
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
    job_id = str(uuid.uuid4())
    jobs[job_id] = {
        "job_id": job_id,
        "status": "pending",
        "progress": 0,
        "kb": None
    }
    # Start the async pipeline task in the background
    asyncio.create_task(run_pipeline(job_id, req.url))
    return {"job_id": job_id}

@app.get("/status/{job_id}")
def get_status(job_id: str):
    return jobs.get(job_id, {"status": "not_found"})

@app.post("/chat")
async def chat_endpoint(req: ChatRequest):
    job = jobs.get(req.job_id)
    if job and job.get("kb"):
        system_prompt = job["kb"].get("system_prompt", "You are a helpful assistant.")
    else:
        system_prompt = "You are a helpful assistant."
        
    return StreamingResponse(
        stream_chat(req.message, req.use_kb, system_prompt),
        media_type="text/plain"
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
