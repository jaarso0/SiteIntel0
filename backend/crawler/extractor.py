import httpx
import trafilatura
from bs4 import BeautifulSoup

async def fetch_and_extract(url: str) -> dict:
    html = ""
    title = ""
    description = ""
    
    # 1. Try HTTPX first (extremely fast, thread-safe, async-native, no event loop conflicts)
    try:
        print(f"Fetching {url} using HTTPX...")
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
            res = await client.get(url, headers=headers)
            if res.status_code == 200:
                html = res.text
                print(f"HTTPX successful for {url}")
    except Exception as e:
        print(f"HTTPX fetch failed for {url}: {e}")
        
    # 2. Fall back to Playwright only if HTTPX did not return content (e.g. requires JS rendering)
    if not html:
        print(f"Falling back to Playwright for {url}...")
        try:
            from playwright.async_api import async_playwright
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                page = await browser.new_page()
                await page.set_extra_http_headers({
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                })
                # Use "load" instead of "networkidle" to prevent hangs on tracking pixels, with 15s timeout
                await page.goto(url, wait_until="load", timeout=15000)
                html = await page.content()
                await browser.close()
                print(f"Playwright successful for {url}")
        except Exception as e:
            print(f"Playwright fallback failed for {url}: {e}")

    content = ""
    if html:
        content = trafilatura.extract(html, include_links=False, no_fallback=False)
        try:
            soup = BeautifulSoup(html, "html.parser")
            title = soup.title.string.strip() if soup.title and soup.title.string else ""
            meta = soup.find("meta", attrs={"name": "description"})
            if meta:
                description = meta.get("content", "").strip()
        except Exception as e:
            print(f"Error parsing HTML with BeautifulSoup: {e}")

    return {
        "url": url,
        "content": content or "",
        "title": title or "",
        "description": description or "",
        "html": html
    }
