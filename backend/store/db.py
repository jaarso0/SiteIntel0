import sqlite3
import hashlib
from datetime import datetime

DB_NAME = "siteintel.db"

def get_db():
    db = sqlite3.connect(DB_NAME)
    db.execute("""CREATE TABLE IF NOT EXISTS pages (
        id TEXT PRIMARY KEY,
        url TEXT,
        site_url TEXT,
        page_type TEXT,
        title TEXT,
        content TEXT,
        crawled_at TEXT
    )""")
    db.execute("""CREATE TABLE IF NOT EXISTS kb_cache (
        site_hash TEXT PRIMARY KEY,
        kb_json TEXT,
        created_at TEXT
    )""")
    db.commit()
    return db

def site_hash(url: str) -> str:
    return hashlib.sha256(url.encode()).hexdigest()[:16]

def save_page(db, site_url: str, url: str, page_type: str, title: str, content: str):
    page_id = hashlib.sha256(url.encode()).hexdigest()[:16]
    crawled_at = datetime.utcnow().isoformat()
    db.execute(
        """INSERT OR REPLACE INTO pages (id, url, site_url, page_type, title, content, crawled_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (page_id, url, site_url, page_type, title, content, crawled_at)
    )
    db.commit()

def get_crawled_pages(db, site_url: str) -> list[dict]:
    cursor = db.cursor()
    cursor.execute(
        "SELECT url, page_type, title, content FROM pages WHERE site_url = ?",
        (site_url,)
    )
    rows = cursor.fetchall()
    return [
        {"url": r[0], "page_type": r[1], "title": r[2], "content": r[3]}
        for r in rows
    ]

def get_kb_from_cache(db, site_url: str) -> str | None:
    sh = site_hash(site_url)
    cursor = db.cursor()
    cursor.execute("SELECT kb_json FROM kb_cache WHERE site_hash = ?", (sh,))
    row = cursor.fetchone()
    return row[0] if row else None

def save_kb_to_cache(db, site_url: str, kb_json: str):
    sh = site_hash(site_url)
    created_at = datetime.utcnow().isoformat()
    db.execute(
        "INSERT OR REPLACE INTO kb_cache (site_hash, kb_json, created_at) VALUES (?, ?, ?)",
        (sh, kb_json, created_at)
    )
    db.commit()
