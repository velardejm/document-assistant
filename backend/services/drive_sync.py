from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from supabase import create_client

from config import settings
from services.extractor import get_drive_service
from services.chunker import chunk_by_clauses
from services.embedder import embed_and_store, delete_chunks_for_file

import uuid

sb = create_client(settings.supabase_url, settings.supabase_service_role_key)

SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]

SUPPORTED_MIME_TYPES = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
}


def list_drive_files(service) -> list[dict]:
    """
    List all files in the contracts/ folder structure on Drive.
    Returns a flat list with project folder name attached to each file.
    """
    # Find root contracts folder
    root = service.files().list(
        q=f"name='{settings.google_drive_root_folder}' and mimeType='application/vnd.google-apps.folder' and trashed=false",
        fields="files(id, name)"
    ).execute().get("files", [])

    if not root:
        raise ValueError(f"Root folder '{settings.google_drive_root_folder}' not found in Drive")

    root_id = root[0]["id"]

    # List project subfolders
    subfolders = service.files().list(
        q=f"'{root_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false",
        fields="files(id, name)"
    ).execute().get("files", [])

    all_files = []

    for folder in subfolders:
        files = service.files().list(
            q=f"'{folder['id']}' in parents and trashed=false",
            fields="files(id, name, mimeType, modifiedTime)"
        ).execute().get("files", [])

        for f in files:
            if f["mimeType"] in SUPPORTED_MIME_TYPES:
                all_files.append({
                    "drive_file_id": f["id"],
                    "filename": f["name"],
                    "project": folder["name"],
                    "mime_type": f["mimeType"],
                    "drive_modified": f["modifiedTime"],
                })

    return all_files


def get_ingested_files() -> dict:
    """Return a dict of drive_file_id -> ingested_file row for quick lookup."""
    result = sb.table("ingested_files").select("*").execute()
    return {row["drive_file_id"]: row for row in result.data}


def sync_drive(skip_pages_map: dict = None) -> dict:
    """
    Compare Drive files against ingested_files table.
    New files → ingest. Modified files → re-ingest. Unchanged → skip.
    
    skip_pages_map: optional dict of filename -> skip_pages override
    e.g. {"Contract C2024-49.pdf": 8}
    """
    if skip_pages_map is None:
        skip_pages_map = {}

    service = get_drive_service()
    drive_files = list_drive_files(service)
    ingested = get_ingested_files()

    added = []
    updated = []
    skipped = []
    errors = []

    # Log sync start
    log = sb.table("sync_log").insert({"status": "running"}).execute().data[0]
    log_id = log["id"]

    from services.extractor import extract_text

    for file in drive_files:
        fid = file["drive_file_id"]
        existing = ingested.get(fid)

        needs_ingest = False
        is_update = False

        if not existing:
            needs_ingest = True
        elif file["drive_modified"] != existing.get("drive_modified"):
            needs_ingest = True
            is_update = True

        if not needs_ingest:
            skipped.append(file["filename"])
            continue

        try:
            skip_pages = skip_pages_map.get(file["filename"], 0)
            text = extract_text(service, fid, file["filename"], skip_pages=skip_pages)
            chunks = chunk_by_clauses(text)

            if is_update and existing:
                delete_chunks_for_file(existing["id"])
                sb.table("ingested_files").delete().eq("id", existing["id"]).execute()

            file_id = str(uuid.uuid4())
            sb.table("ingested_files").insert({
                "id": file_id,
                "drive_file_id": fid,
                "filename": file["filename"],
                "project": file["project"],
                "mime_type": file["mime_type"],
                "chunk_count": len(chunks),
                "drive_modified": file["drive_modified"],
            }).execute()

            embed_and_store(
                chunks=chunks,
                file_id=file_id,
                filename=file["filename"],
                project=file["project"],
            )

            if is_update:
                updated.append(file["filename"])
            else:
                added.append(file["filename"])

        except Exception as e:
            errors.append({"filename": file["filename"], "error": str(e)})

    # Update sync log
    sb.table("sync_log").update({
        "status": "complete" if not errors else "error",
        "finished_at": "now()",
        "files_added": len(added),
        "files_updated": len(updated),
        "files_skipped": len(skipped),
        "error": str(errors) if errors else None,
    }).eq("id", log_id).execute()

    return {
        "added": added,
        "updated": updated,
        "skipped": skipped,
        "errors": errors,
    }