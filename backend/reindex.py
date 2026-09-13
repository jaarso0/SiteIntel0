"""Re-embed every indexed chunk with the current EMBED_MODEL.

Run after changing the embedding model:  python reindex.py
Chunks are copied from the other siteintel_kb* collections (documents and metadata are
stored alongside the vectors), so nothing needs to be re-crawled. Old collections are
left in place; pass --drop-old to delete them once you're happy with the new one.
"""
import sys

import chromadb

from rag.embedder import MODEL_NAME, embed_passages
from rag.retriever import DB_PATH, collection_name

BATCH = 64


def main(drop_old: bool) -> None:
    client = chromadb.PersistentClient(path=DB_PATH)
    target_name = collection_name()
    target = client.get_or_create_collection(target_name)
    sources = [c.name for c in client.list_collections()
               if c.name.startswith("siteintel_kb") and c.name != target_name]

    print(f"embedding model: {MODEL_NAME}\ntarget collection: {target_name}")
    for name in sources:
        source = client.get_collection(name)
        data = source.get(include=["documents", "metadatas"])
        ids, docs, metas = data["ids"], data["documents"], data["metadatas"]
        print(f"{name}: re-embedding {len(ids)} chunks")
        for i in range(0, len(ids), BATCH):
            target.upsert(
                ids=ids[i:i + BATCH],
                documents=docs[i:i + BATCH],
                metadatas=metas[i:i + BATCH],
                embeddings=embed_passages(docs[i:i + BATCH]),
            )
        if drop_old:
            client.delete_collection(name)
            print(f"{name}: deleted")

    print(f"{target_name} now holds {target.count()} chunks")


if __name__ == "__main__":
    main(drop_old="--drop-old" in sys.argv)
