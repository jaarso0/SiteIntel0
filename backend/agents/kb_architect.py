import os
import json
import time
import re
import google.generativeai as genai
from google.api_core.exceptions import GoogleAPIError

def clean_json_response(text: str) -> str:
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if match:
        return match.group(1).strip()
    return text.strip()

def build_kb(pages: list[dict], competitor_pages: list[dict]) -> dict:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or api_key == "your_key_here":
        raise ValueError("GEMINI_API_KEY environment variable is not set or is still a placeholder")

    genai.configure(api_key=api_key, transport="rest")
    model = genai.GenerativeModel("gemini-2.5-flash")

    site_content = "\n\n".join(
        f"[{p['page_type'].upper()}] {p['url']}\n{p['content']}"
        for p in pages if p.get("content")
    )
    competitor_content = "\n\n".join(
        f"[COMPETITOR] {p['url']}\n{p.get('content', '')[:500]}"
        for p in competitor_pages if p.get("content")
    )

    prompt = f"""You are a knowledge base architect. Analyze the website content below
and return ONLY a valid JSON object — no markdown, no explanation.

<site_content>
{site_content}
</site_content>

<competitor_content>
{competitor_content}
</competitor_content>

Return this exact structure:
{{
  "business_type": "...",
  "kb_articles": [{{"title":"","category":"","content":"","source_urls":[]}}],
  "qa_pairs": [{{"question":"","answer":"","source_url":""}}],
  "system_prompt": "...",
  "inconsistencies": [{{"description":"","pages":[],"severity":"high|medium|low"}}],
  "coverage_gaps": [{{"topic":"","priority":"high|medium|low"}}],
  "staleness_flags": [{{"content":"","source_url":"","reason":""}}],
  "competitor_gaps": [{{"topic":"","competitor_has_it":true}}]
}}"""


    backoff = 1.0
    max_retries = 5
    for attempt in range(max_retries):
        try:
            print(f"Calling Gemini API (attempt {attempt + 1}/{max_retries})...")
            response = model.generate_content(prompt)
            raw_text = response.text
            cleaned_text = clean_json_response(raw_text)
            return json.loads(cleaned_text)
        except (GoogleAPIError, json.JSONDecodeError, Exception) as e:
            print(f"Attempt {attempt + 1} failed: {e}")
            if attempt == max_retries - 1:
                raise e
            time.sleep(backoff)
            backoff *= 2.0
