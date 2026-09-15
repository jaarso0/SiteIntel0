import asyncio
import json
import logging
import os

from dotenv import load_dotenv

load_dotenv(override=True)

from livekit.agents import JobContext, JobProcess, WorkerOptions, cli, llm
from livekit.agents.voice import Agent, AgentSession
from livekit.agents.voice.turn import (
    EndpointingOptions,
    InterruptionOptions,
    PreemptiveGenerationOptions,
    TurnHandlingOptions,
)
from livekit.plugins import openai, sarvam, silero

logging.basicConfig(level=logging.INFO)
for noisy in ("livekit", "livekit.agents", "livekit.rtc"):
    logging.getLogger(noisy).setLevel(logging.WARNING)
logger = logging.getLogger("siteintel-agent")

GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
GROQ_BASE_URL = "https://api.groq.com/openai/v1"
# "unknown" = auto-detect. A fixed "en-IN" makes Sarvam translate Hindi speech into
# English, so the LLM never knows the caller spoke Hindi.
STT_LANGUAGE = os.getenv("SARVAM_STT_LANGUAGE", "unknown")
TTS_SPEAKER = os.getenv("SARVAM_SPEAKER", "shubh")
RETRIEVAL_TOP_K = 3

DEFAULT_PROMPT = "You are a helpful customer support agent. Keep answers to 1-2 short sentences. Be warm."
VOICE_RULES = (
    "Voice call rules:\n"
    "- Max 2 short sentences per reply. No lists, no markdown, no bullet points.\n"
    "- Sound warm and natural like a real support agent.\n"
    "- Never read source URLs or citation brackets aloud.\n"
    "- If you don't have the answer, say so and offer to help with something else.\n\n"
    "Language:\n"
    "- If the caller speaks English, reply in English.\n"
    "- If the caller speaks Hindi or Hinglish, reply in natural Hinglish, the everyday Hindi-English mix "
    "people use on Indian support calls. Use Hindi sentence structure but keep common English words in English: "
    "order, refund, payment, account, plan, delivery, app, login, working days, prices and numbers.\n"
    "- Write Hindi words in Devanagari and English words in English letters, "
    "for example: \"आपका order कल तक deliver हो जाएगा।\"\n"
    "- Never use formal or shuddh Hindi words like आदेश, धनवापसी, खाता or भुगतान when an English word is common."
)


def prewarm(proc: JobProcess) -> None:
    """Runs once per worker process, before any call is assigned to it.

    Importing torch/sentence-transformers and opening Chroma takes ~20s on this
    machine. Doing it here — with an idle process kept ready — means a call only
    pays for connecting to the room, not for loading models.
    """
    from rag.embedder import get_model
    from rag.retriever import get_collection

    get_model()
    get_collection()
    proc.userdata["vad"] = silero.VAD.load(
        min_silence_duration=0.15,
        prefix_padding_duration=0.2,
        activation_threshold=0.5,
    )
    logger.info("worker process warm")


def load_job(job_id: str) -> tuple[str, str]:
    """Returns (site_url, system_prompt) for a crawl job."""
    try:
        from store.db import get_active_job, get_db

        result = get_active_job(get_db(), job_id)
        if result:
            site_url, kb_json = result
            prompt = json.loads(kb_json).get("system_prompt", DEFAULT_PROMPT) if kb_json else DEFAULT_PROMPT
            return site_url, prompt
    except Exception as e:
        logger.error(f"DB load failed: {e}")
    return "", DEFAULT_PROMPT


def company_name(site_url: str) -> str:
    if not site_url:
        return "our team"
    host = site_url.replace("https://", "").replace("http://", "").split("/")[0]
    return host.split(".")[0].title()


def build_stt() -> sarvam.STT:
    return sarvam.STT(language=STT_LANGUAGE, model="saarika:v2.5", api_key=os.getenv("SARVAM_API_KEY"))


def build_tts() -> sarvam.TTS:
    return sarvam.TTS(
        target_language_code="en-IN",  # switched per turn in on_user_turn_completed
        model="bulbul:v3",
        speaker=TTS_SPEAKER,
        api_key=os.getenv("SARVAM_API_KEY"),
    )


def build_llm() -> openai.LLM:
    return openai.LLM(
        model=GROQ_MODEL,
        api_key=os.getenv("GROQ_API_KEY"),
        base_url=GROQ_BASE_URL,
        reasoning_effort="low",  # gpt-oss reasons before answering; keep it short for voice
    )


class SiteIntelAgent(Agent):
    def __init__(self, site_url: str, system_prompt: str):
        super().__init__(instructions=f"{system_prompt}\n\n{VOICE_RULES}")
        self.site_url = site_url

    async def on_enter(self) -> None:
        self.session.generate_reply(
            instructions=f"Greet the caller in one short sentence as {company_name(self.site_url)} support "
            "and ask how you can help."
        )

    async def on_user_turn_completed(self, turn_ctx: llm.ChatContext, new_message: llm.ChatMessage) -> None:
        # Inject RAG context before the LLM runs — one LLM call, nothing leaks into TTS.
        question = (new_message.text_content or "").strip()
        if not question:
            return

        # Hindi/Hinglish callers get a Hinglish reply (see VOICE_RULES); voice it with the Hindi model.
        is_hindi = any("ऀ" <= ch <= "ॿ" for ch in question)  # Devanagari
        self.session.tts.update_options(target_language_code="hi-IN" if is_hindi else "en-IN")

        if not self.site_url:
            return

        try:
            from rag.retriever import search

            hits = await asyncio.to_thread(search, question, site_url=self.site_url, n=RETRIEVAL_TOP_K)
        except Exception as e:
            # Never re-raise here — the framework silently drops the reply.
            logger.error(f"RAG failed, answering without context: {e}", exc_info=True)
            return

        if not hits:
            logger.info(f"no context for {question!r}")
            return

        logger.info(f"RAG: injected {len(hits)} chunks for {question[:60]!r}")
        context = "\n\n".join(f"[{h['source_url']}]\n{h['text']}" for h in hits)
        turn_ctx.add_message(
            role="system",
            content="Answer using only the context below. Speak naturally, never read URLs aloud.\n\n" + context,
        )


async def entrypoint(ctx: JobContext):
    await ctx.connect()

    job_id = ctx.room.name.removeprefix("room-")
    site_url, system_prompt = load_job(job_id)
    logger.info(f"call started — job {job_id}, site {site_url or '(none)'}")

    session = AgentSession(
        vad=ctx.proc.userdata["vad"],
        stt=build_stt(),
        llm=build_llm(),
        tts=build_tts(),
        turn_handling=TurnHandlingOptions(
            endpointing=EndpointingOptions(min_delay=0.15, max_delay=1.5),
            # Preemptive generation starts the LLM before RAG context is injected,
            # then cancels it — two LLM calls instead of one.
            preemptive_generation=PreemptiveGenerationOptions(enabled=False),
            # Stop talking as soon as VAD hears the caller. min_words > 0 would make LiveKit
            # wait for STT to transcribe that many words first, so the agent talked over people.
            # A cough or noise only pauses the agent; it resumes if no words follow within 2s.
            interruption=InterruptionOptions(
                enabled=True,
                mode="vad",
                min_duration=0.3,
                min_words=0,
                resume_false_interruption=True,
                false_interruption_timeout=2.0,
            ),
        ),
    )

    # The frontend renders captions from these data packets.
    def publish_caption(sender: str, text: str) -> None:
        payload = json.dumps({"sender": sender, "text": text}).encode()
        asyncio.create_task(ctx.room.local_participant.publish_data(payload, reliable=True))

    @session.on("user_input_transcribed")
    def on_user_transcript(ev):
        if ev.is_final and ev.transcript:
            logger.info(f"[user] {ev.transcript}")
            publish_caption("user", ev.transcript)

    @session.on("conversation_item_added")
    def on_conversation_item(ev):
        text = getattr(ev.item, "text_content", None)
        if getattr(ev.item, "role", None) == "assistant" and text:
            logger.info(f"[agent] {text[:80]}")
            publish_caption("ai", text)

    # Every call for a site reuses room-{job_id}. When the caller hangs up the session
    # closes, but the job would otherwise stay in the room — the next call then finds
    # stale agents there, each still holding a process.
    @session.on("close")
    def on_close(ev):
        ctx.shutdown(reason="call ended")

    await session.start(room=ctx.room, agent=SiteIntelAgent(site_url, system_prompt))


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            prewarm_fnc=prewarm,
            agent_name="siteintel-agent",
            # dev mode defaults to 0 idle processes, so every call would spawn a
            # fresh process and reload torch. Keep one warm and ready.
            num_idle_processes=1,
            initialize_process_timeout=90.0,
        )
    )
