def chunk_article(article: dict, chunk_size=500, overlap=50) -> list[dict]:
    content = article.get("content", "")
    words = content.split()
    chunks = []
    
    # Handle empty content
    if not words:
        return []
        
    for i in range(0, len(words), chunk_size - overlap):
        text = " ".join(words[i:i + chunk_size])
        source_urls = article.get("source_urls", [])
        source_url = source_urls[0] if source_urls else ""
        chunks.append({
            "text": text,
            "source_url": source_url,
            "title": article.get("title", ""),
            "category": article.get("category", ""),
            "chunk_index": len(chunks),
        })
        # If we reached the end of the content
        if i + chunk_size >= len(words):
            break
            
    return chunks
