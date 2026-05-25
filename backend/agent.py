import os
import json
import logging
import asyncio
from dotenv import load_dotenv

load_dotenv(override=True)

from livekit.agents import JobContext, WorkerOptions, cli, llm
from livekit.agents.voice import Agent, AgentSession
from livekit.agents.voice.turn import TurnHandlingOptions, EndpointingOptions, InterruptionOptions, PreemptiveGenerationOptions
from livekit.agents.voice.room_io import RoomOptions
from livekit.plugins import openai, silero, deepgram, cartesia

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("siteintel-agent")

# WHY LIVEKIT IS SLOWER THAN WEB SPEECH API:
# Web Speech API: browser-native STT (instant) + speechSynthesis (instant) → only LLM latency ~400ms
# LiveKit pipeline: VAD silence detection (300ms) + Groq Whisper STT (network, ~300ms)
#                  + RAG (local, ~20ms) + LLM (network, ~300ms) + Edge TTS (local HTTP, ~200ms)
# Total LiveKit first response: ~1.1-1.5s. This is inherent — STT and TTS are now real network services.
# To close the gap further: switch to a streaming STT (Deepgram) and streaming TTS.


def _build_edge_tts_base_url() -> str:
    url = os.getenv("EDGE_TTS_URL", "http://localhost:5050").strip().rstrip("/")
    return url if url.endswith("/v1") else url + "/v1"


def _load_job_from_db(job_id: str) -> tuple[str, str]:
    default = "You are a helpful customer support agent. Keep answers to 1-2 short sentences. Be warm."
    try:
        from store.db import get_db, get_active_job
        db = get_db()
        result = get_active_job(db, job_id)
        if result:
            site_url, kb_json = result
            if kb_json:
                return site_url, json.loads(kb_json).get("system_prompt", default)
            return site_url, default
    except Exception as e:
        logger.error(f"DB load failed: {e}")
    return "", default


class SiteIntelAgent(Agent):
    def __init__(self, instructions: str, site_url: str, greeting: str):
        super().__init__(instructions=instructions)
        self._site_url = site_url
        self._greeting = greeting

    async def on_enter(self) -> None:
        # Canonical hook for initial greeting — runs when agent joins the room session.
        # More reliable than calling generate_reply() after session.start().
        logger.info("Agent entered room — speaking greeting")
        self.session.generate_reply(instructions=self._greeting)

    async def on_user_turn_completed(
        self, turn_ctx: llm.ChatContext, new_message: llm.ChatMessage
    ) -> None:
        # Called after VAD+STT completes, before LLM is invoked.
        # Inject RAG context here — same pattern as main.py stream_chat().
        # No function_tool needed: one LLM call, context already in prompt, nothing leaks to TTS.
        if not self._site_url:
            return

        try:
            user_text = (new_message.text_content or "").strip()
            if not user_text:
                logger.info("on_user_turn_completed: empty transcript, skipping RAG")
                return

            logger.info(f"RAG lookup for: '{user_text[:80]}'")
            from rag.retriever import search
            chunks = search(user_text, site_url=self._site_url, n=3)

            if chunks:
                context = "\n\n".join(
                    f"[{c['source_url']}]\n{c['text']}" for c in chunks
                )
                turn_ctx.add_message(
                    role="system",
                    content=(
                        "Answer using only the context below. "
                        "Speak naturally — no lists, no markdown, never read URLs aloud.\n\n"
                        + context
                    ),
                )
                logger.info(f"RAG: injected {len(chunks)} chunks")
            else:
                logger.info("RAG: no chunks found, LLM will answer from instructions only")

        except Exception as e:
            # Log but do NOT re-raise — framework silently drops response on any exception here
            logger.error(f"RAG failed (agent will still reply without context): {e}", exc_info=True)


async def entrypoint(ctx: JobContext):
    room_name = ctx.room.name
    job_id = room_name.replace("room-", "")
    logger.info(f"Dispatched — room: {room_name}, job_id: {job_id}")

    # Latency Tuning: Pre-load the sentence transformer model in the background immediately
    # so that it is fully loaded in memory by the time the user connects and speaks!
    try:
        from rag.embedder import get_model
        loop = asyncio.get_running_loop()
        loop.run_in_executor(None, get_model)
        logger.info("Background thread launched to warm up SentenceTransformer model...")
    except Exception as warmup_err:
        logger.warning(f"Failed to pre-load SentenceTransformer in background: {warmup_err}")

    site_url, system_prompt = _load_job_from_db(job_id)
    logger.info(f"Loaded KB for site: {site_url or '(none)'}")

    voice_prompt = (
        f"{system_prompt}\n\n"
        "Voice call rules:\n"
        "- Max 2 short sentences per reply. No lists, no markdown, no bullet points.\n"
        "- Sound warm and natural like a real support agent.\n"
        "- Never read source URLs or citation brackets aloud.\n"
        "- If you don't have the answer, say so and offer to help with something else."
    )

    domain = (
        site_url.replace("https://", "").replace("http://", "")
        .split("/")[0].split(".")[0].title()
        if site_url else "our team"
    )
    greeting = f"Hey, thanks for calling {domain} support — how can I help you today?"

    groq_key = os.getenv("GROQ_API_KEY")
    deepgram_key = os.getenv("DEEPGRAM_API_KEY")
    cartesia_key = os.getenv("CARTESIA_API_KEY")
    edge_tts_key = os.getenv("EDGE_TTS_API_KEY", "mykey123")
    edge_tts_base = _build_edge_tts_base_url()

    # Determine STT engine (prefer Deepgram if key is available)
    if deepgram_key:
        logger.info("STT: Using Deepgram Streaming STT")
        stt_instance = deepgram.STT(api_key=deepgram_key)
    else:
        logger.info("STT: No Deepgram key found, falling back to Groq Whisper STT")
        stt_instance = openai.STT(
            model="whisper-large-v3-turbo",
            api_key=groq_key,
            base_url="https://api.groq.com/openai/v1",
        )

    # Determine TTS engine (enforce local Edge-TTS to bypass STT-only key crashes)
    use_local_tts = False
    if edge_tts_base:
        try:
            import httpx
            resp = httpx.get(edge_tts_base.replace("/v1", ""), timeout=1.0)
            if resp.status_code < 500:
                use_local_tts = True
        except Exception:
            pass

    if use_local_tts:
        logger.info(f"TTS: Using local Edge-TTS at {edge_tts_base}")
        tts_instance = openai.TTS(
            model="tts-1",
            voice="alloy",
            api_key=edge_tts_key,
            base_url=edge_tts_base,
        )
    elif cartesia_key:
        logger.info("TTS: Using premium Cartesia Sonic low-latency TTS")
        tts_instance = cartesia.TTS(
            api_key=cartesia_key,
            voice="db6b0ed5-d5d3-463d-ae85-518a07d3c2b4"
        )
    else:
        logger.warning("TTS: Local Edge-TTS offline. Trying Edge-TTS directly...")
        tts_instance = openai.TTS(
            model="tts-1",
            voice="alloy",
            api_key=edge_tts_key,
            base_url=edge_tts_base,
        )

    session = AgentSession(
        vad=silero.VAD.load(
            min_silence_duration=0.15,
            prefix_padding_duration=0.2,
            activation_threshold=0.5,
        ),
        stt=stt_instance,
        llm=openai.LLM(
            model="llama-3.3-70b-versatile",
            api_key=groq_key,
            base_url="https://api.groq.com/openai/v1",
        ),
        tts=tts_instance,
        turn_handling=TurnHandlingOptions(
            endpointing=EndpointingOptions(min_delay=0.15, max_delay=1.5),
            # Disable preemptive — it starts LLM before on_user_turn_completed runs,
            # cancels when RAG changes context → 2 LLM calls instead of 1.
            preemptive_generation=PreemptiveGenerationOptions(enabled=False),
            interruption=InterruptionOptions(
                enabled=True,
                min_words=3,
                resume_false_interruption=True,
            ),
        ),
    )

    @session.on("user_input_transcribed")
    def on_user_transcript(event):
        if getattr(event, "is_final", True) and event.transcript:
            logger.info(f"[STT] User: {event.transcript}")
            payload = json.dumps({"sender": "user", "text": event.transcript})
            asyncio.create_task(
                ctx.room.local_participant.publish_data(payload.encode(), reliable=True)
            )

    @session.on("conversation_item_added")
    def on_conversation_item(event):
        item = event.item
        if getattr(item, "role", None) == "assistant":
            content = getattr(item, "content", None)
            text = (
                content if isinstance(content, str)
                else " ".join(
                    c if isinstance(c, str) else getattr(c, "text", "")
                    for c in (content or [])
                )
            ).strip()
            if text:
                logger.info(f"[TTS] Agent: {text[:80]}")
                payload = json.dumps({"sender": "ai", "text": text})
                asyncio.create_task(
                    ctx.room.local_participant.publish_data(payload.encode(), reliable=True)
                )

    logger.info("Connecting to room...")
    await ctx.connect()

    logger.info("Starting AgentSession...")
    await session.start(
        room=ctx.room,
        agent=SiteIntelAgent(
            instructions=voice_prompt,
            site_url=site_url,
            greeting=greeting,
        ),
        room_options=RoomOptions(),
    )

    logger.info("Session started — on_enter will fire greeting automatically")


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, agent_name="siteintel-agent"))
