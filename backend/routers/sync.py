from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from supabase import create_client

from config import settings
from services.drive_sync import sync_drive
from services.embedder import delete_chunks_for_file

router = APIRouter(prefix="/sync", tags=["sync"])
sb = create_client(settings.supabase_url, settings.supabase_service_role_key)


class SyncRequest(BaseModel):
    skip_pages_map: dict[str, int] = {}


@router.post("")
def run_sync(req: SyncRequest = SyncRequest()):
    try:
        result = sync_drive(skip_pages_map=req.skip_pages_map)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(e)}")
    return result


@router.get("/status")
def sync_status():
    result = sb.table("sync_log") \
        .select("*") \
        .order("started_at", desc=True) \
        .limit(5) \
        .execute()
    return result.data


@router.get("/documents")
def list_documents():
    result = sb.table("ingested_files") \
        .select("*") \
        .order("ingested_at", desc=True) \
        .execute()
    return result.data

@router.get("/projects")
def list_projects():
    result = sb.table("ingested_files") \
        .select("project") \
        .execute()
    projects = sorted(set(row["project"] for row in result.data if row["project"]))
    return projects


@router.delete("/documents/{file_id}")
def delete_document(file_id: str):
    existing = sb.table("ingested_files").select("id").eq("id", file_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Document not found")

    delete_chunks_for_file(file_id)
    sb.table("ingested_files").delete().eq("id", file_id).execute()

    return {"status": "ok", "deleted": file_id}