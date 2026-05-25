import asyncio
import sys
import os
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup


sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from crawler.extractor import fetch_and_extract
from crawler.classifier import classify
from store.db import get_db, save_page

PRIORITY_VALUES = {
    "pricing": 1,
    "support": 2,
    "product": 3,
    "company": 4,
    "general": 5,
    "deprioritize": 6,
}

def get_domain(url: str) -> str:
    parsed = urlparse(url)
    return parsed.netloc

def extract_links(html: str, base_url: str) -> list[str]:
    links = []
    try:
        soup = BeautifulSoup(html, "html.parser")
        for a in soup.find_all("a", href=True):
            href = a["href"].strip()
            href = href.split("#")[0]
            if not href:
                continue
            full_url = urljoin(base_url, href)
            if full_url.endswith("/"):
                full_url = full_url[:-1]
            links.append(full_url)
    except Exception as e:
        print(f"Error extracting links: {e}")
    return list(set(links))

async def crawl_site(seed_url: str, max_pages: int = 50):
    db = get_db()
    seed_url = seed_url.rstrip("/")
    domain = get_domain(seed_url)
    queue = asyncio.PriorityQueue()
    await queue.put((0, seed_url))
    
    visited = set()
    crawled_count = 0
    

    sem = asyncio.Semaphore(5)
    
    async def worker():
        nonlocal crawled_count
        while crawled_count < max_pages:
            if queue.empty():
                break
            try:
                priority, url = await queue.get()
            except asyncio.QueueEmpty:
                break
                
            if url in visited:
                queue.task_done()
                continue
                
            visited.add(url)
            
            async with sem:
                print(f"[{crawled_count + 1}] Crawling: {url} (Priority: {priority})")
                res = await fetch_and_extract(url)
                queue.task_done()
                
                if not res["html"]:
                    continue
                    
                crawled_count += 1
                
                # Classify page
                page_type = classify(url, res["title"])
                
                # Store in SQLite
                save_page(db, seed_url, url, page_type, res["title"], res["content"])
                
                # Extract and enqueue new links
                links = extract_links(res["html"], url)
                for link in links:
                    if get_domain(link) == domain and link not in visited:
                        link_type = classify(link)
                        if link_type == "skip":
                            continue
                        prio_val = PRIORITY_VALUES.get(link_type, 5)
                        await queue.put((prio_val, link))
                        
            
            await asyncio.sleep(0.1)

    
    await worker()
    print(f"\nCrawl finished. Crawled {crawled_count} pages.")

def find_competitors(site_url: str) -> list[str]:
    domain = get_domain(site_url).lower()
    if "prephelp" in domain:
        return ["byjus.com", "unacademy.com"]
    if "example" in domain:
        return ["example-competitor.com"]
    return ["competitor1.com", "competitor2.com"]

async def crawl_competitors(competitor_domains: list[str]) -> list[dict]:
    competitor_pages = []
    for domain in competitor_domains:
        seed = f"https://{domain}" if not domain.startswith("http") else domain
        print(f"Crawling competitor main page: {seed}")
        try:
            res = await fetch_and_extract(seed)
            if res["html"]:
                page_type = classify(seed, res["title"])
                competitor_pages.append({
                    "url": seed,
                    "content": res["content"],
                    "title": res["title"],
                    "page_type": page_type
                })
        except Exception as e:
            print(f"Failed to crawl competitor {seed}: {e}")
    return competitor_pages

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python orchestrator.py <url>")
        sys.exit(1)
        
    url = sys.argv[1]
    asyncio.run(crawl_site(url))
