import trafilatura
from playwright.async_api import async_playwright
from bs4 import BeautifulSoup

async def fetch_and_extract(url: str) -> dict:
    html = ""
    title = ""
    description = ""
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page()
            # Set a standard viewport and user agent
            await page.set_extra_http_headers({
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            })
            # 30 seconds timeout
            await page.goto(url, wait_until="networkidle", timeout=30000)
            html = await page.content()
            await browser.close()
    except Exception as e:
        print(f"Error fetching {url}: {e}")

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
