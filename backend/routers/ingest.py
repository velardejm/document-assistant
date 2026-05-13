import uuid
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from supabase import create_client

from config import settings
from services.extractor import get_drive_service, extract_text
from services.chunker import chunk_by_clauses
from services.embedder import embed_and_store, delete_chunks_for_file

router = APIRouter(prefix="/ingest", tags=["ingest"])
sb = create_client(settings.supabase_url, settings.supabase_service_role_key)


class IngestRequest(BaseModel):
    drive_file_id: str
    filename: str
    project: str
    skip_pages: int = 0


@router.post("")
def ingest_document(req: IngestRequest):
    # Check if file already ingested
    existing = sb.table("ingested_files") \
        .select("id") \
        .eq("drive_file_id", req.drive_file_id) \
        .execute()

    if existing.data:
        file_id = existing.data[0]["id"]
        # Delete old chunks before re-ingesting
        delete_chunks_for_file(file_id)
        sb.table("ingested_files").delete().eq("id", file_id).execute()

    # Extract text
    try:
        service = get_drive_service()
        text = extract_text(
            service,
            req.drive_file_id,
            req.filename,
            skip_pages=req.skip_pages
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")

    # Chunk
    chunks = chunk_by_clauses(text)
    if not chunks:
        raise HTTPException(status_code=422, detail="No chunks extracted from document")

    # Create ingested_files record
    file_id = str(uuid.uuid4())
    sb.table("ingested_files").insert({
        "id": file_id,
        "drive_file_id": req.drive_file_id,
        "filename": req.filename,
        "project": req.project,
        "chunk_count": len(chunks),
    }).execute()

    # Embed and store
    try:
        inserted = embed_and_store(
            chunks=chunks,
            file_id=file_id,
            filename=req.filename,
            project=req.project,
        )
    except Exception as e:
        # Clean up ingested_files record if embedding fails
        sb.table("ingested_files").delete().eq("id", file_id).execute()
        raise HTTPException(status_code=500, detail=f"Embedding failed: {str(e)}")

    return {
        "status": "ok",
        "file_id": file_id,
        "filename": req.filename,
        "project": req.project,
        "chunks_inserted": inserted,
    }