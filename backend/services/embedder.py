import time
import uuid
from openai import OpenAI
from supabase import create_client

from config import settings

openai_client = OpenAI(api_key=settings.openai_api_key)
sb = create_client(settings.supabase_url, settings.supabase_service_role_key)

BATCH_SIZE = 100
EMBEDDING_MODEL = "text-embedding-3-small"


def embed_batch(texts: list[str]) -> list[list[float]]:
    response = openai_client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=texts
    )
    return [item.embedding for item in response.data]


def embed_and_store(
    chunks: list[dict],
    file_id: str,
    filename: str,
    project: str,
) -> int:
    """
    Embed all chunks and insert them into Supabase.
    Returns the number of rows inserted.
    """
    rows = []

    for i in range(0, len(chunks), BATCH_SIZE):
        batch = chunks[i:i + BATCH_SIZE]
        texts = [c["content"] for c in batch]
        embeddings = embed_batch(texts)

        for chunk, embedding in zip(batch, embeddings):
            rows.append({
                "file_id": file_id,
                "project": project,
                "filename": filename,
                "clause_ref": chunk["clause_ref"],
                "content": chunk["content"],
                "char_start": chunk["char_start"],
                "char_end": chunk["char_end"],
                "embedding": embedding,
            })

        time.sleep(0.5)  # avoid rate limiting

    # Insert in batches
    for i in range(0, len(rows), BATCH_SIZE):
        sb.table("contract_chunks").insert(rows[i:i + BATCH_SIZE]).execute()

    return len(rows)


def delete_chunks_for_file(file_id: str) -> None:
    """Delete all chunks for a given file — used when re-ingesting a modified file."""
    sb.table("contract_chunks").delete().eq("file_id", file_id).execute()