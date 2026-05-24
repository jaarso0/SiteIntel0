import os
import chromadb
import hashlib

_collection = None

def get_collection():
    global _collection
    if _collection is None:
        # Determine the root database path relative to backend
        db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "chroma_db")
        client = chromadb.PersistentClient(path=db_path)
        _collection = client.get_or_create_collection("siteintel_kb")
    return _collection

def index_chunks(chunks: list[dict]):
    if not chunks:
        return
        
    from rag.embedder import embed
    col = get_collection()
    
    texts = [c["text"] for c in chunks]
    vectors = embed(texts)
    
    # Generate unique, deterministic IDs based on SHA256 of text to prevent duplicate chunks
    ids = []
    for c in chunks:
        h = hashlib.sha256(c["text"].encode()).hexdigest()[:16]
        ids.append(f"chunk_{h}")
        
    # Prepare metadata (excluding text)
    metadatas = [{k: v for k, v in c.items() if k != "text"} for c in chunks]
    
    col.upsert(
        ids=ids,
        embeddings=vectors,
        documents=texts,
        metadatas=metadatas
    )

def search(query: str, site_url: str = None, n=5) -> list[dict]:
    from rag.embedder import embed
    col = get_collection()
    
    # Embed the query
    vec = embed([query])[0]
    
    # Construct metadata filter
    where_clause = {"site_url": site_url} if site_url else None
    
    results = col.query(
        query_embeddings=[vec],
        n_results=n,
        where=where_clause
    )
    
    # Format and return the search results
    formatted_results = []
    if results and "documents" in results and results["documents"]:
        documents = results["documents"][0]
        metadatas = results["metadatas"][0]
        for doc, meta in zip(documents, metadatas):
            formatted_results.append({
                "text": doc,
                **meta
            })
            
    return formatted_results
