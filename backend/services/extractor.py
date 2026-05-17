import io
import json
import fitz  # pymupdf
from docx import Document
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.http import MediaIoBaseDownload

from config import settings

SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]


def get_drive_service():
    # Production: read credentials from environment variables
    if settings.google_credentials_json and settings.google_token_json:
        token_data = json.loads(settings.google_token_json)
        creds = Credentials(
            token=token_data.get("token"),
            refresh_token=token_data.get("refresh_token"),
            token_uri=token_data.get("token_uri"),
            client_id=token_data.get("client_id"),
            client_secret=token_data.get("client_secret"),
            scopes=token_data.get("scopes"),
        )
    else:
        # Local dev: read from files
        creds = Credentials.from_authorized_user_file(settings.google_token_file, SCOPES)

    if creds.expired and creds.refresh_token:
        creds.refresh(Request())

    return build("drive", "v3", credentials=creds)


def download_file(service, file_id: str) -> bytes:
    request = service.files().get_media(fileId=file_id)
    buffer = io.BytesIO()
    downloader = MediaIoBaseDownload(buffer, request)
    done = False
    while not done:
        _, done = downloader.next_chunk()
    return buffer.getvalue()


def extract_text_from_pdf(file_bytes: bytes, skip_pages: int = 0) -> str:
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    pages = []
    for i, page in enumerate(doc):
        if i < skip_pages:
            continue
        text = page.get_text()
        if text.strip():
            pages.append(text)
    return "\n".join(pages)


def extract_text_from_docx(file_bytes: bytes) -> str:
    doc = Document(io.BytesIO(file_bytes))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    return "\n".join(paragraphs)


def extract_text(service, file_id: str, filename: str, skip_pages: int = 0) -> str:
    file_bytes = download_file(service, file_id)
    ext = filename.lower().split(".")[-1]

    if ext == "pdf":
        return extract_text_from_pdf(file_bytes, skip_pages=skip_pages)
    elif ext == "docx":
        return extract_text_from_docx(file_bytes)
    else:
        raise ValueError(f"Unsupported file type: {ext}")