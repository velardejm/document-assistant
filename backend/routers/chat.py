from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from supabase import create_client

from config import settings
from services.prompt_builder import ask
from services.session_manager import (
    create_session,
    get_session,
    list_sessions,
    get_messages,
    ask_in_session,
)

router = APIRouter(prefix="/chat", tags=["chat"])
sb = create_client(settings.supabase_url, settings.supabase_service_role_key)


def get_app_settings() -> dict:
    result = sb.table("app_settings").select("*").eq("id", 1).execute()
    return result.data[0] if result.data else {}


# ─── Quick Question ───────────────────────────────────────────────────────────

class QuickQuestionRequest(BaseModel):
    query: str
    project: str | None = None
    top_k: int = 5


@router.post("/quick")
def quick_question(req: QuickQuestionRequest):
    if not req.query.strip():
        raise HTTPException(status_code=422, detail="Query cannot be empty")

    app_settings = get_app_settings()
    model = app_settings.get("model", "gpt-4o-mini")
    temperature = app_settings.get("temperature", 0.2)
    top_k = app_settings.get("top_k", req.top_k)

    try:
        result = ask(
            query=req.query,
            project=req.project,
            top_k=top_k,
            model=model,
            temperature=temperature,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {str(e)}")

    return {
        "query": req.query,
        "answer": result["answer"],
        "sources": result["sources"],
    }


# ─── Conversation Mode ────────────────────────────────────────────────────────

class CreateSessionRequest(BaseModel):
    title: str = "New Session"
    project: str | None = None


class SessionMessageRequest(BaseModel):
    query: str


@router.post("/session")
def new_session(req: CreateSessionRequest):
    session = create_session(title=req.title, project=req.project)
    return session


@router.get("/sessions")
def all_sessions():
    return list_sessions()


@router.get("/session/{session_id}")
def get_session_with_messages(session_id: str):
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    messages = get_messages(session_id)
    return {"session": session, "messages": messages}


@router.post("/session/{session_id}/message")
def send_message(session_id: str, req: SessionMessageRequest):
    if not req.query.strip():
        raise HTTPException(status_code=422, detail="Query cannot be empty")

    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    app_settings = get_app_settings()
    model = app_settings.get("model", "gpt-4o-mini")
    temperature = app_settings.get("temperature", 0.2)
    top_k = app_settings.get("top_k", 5)

    try:
        result = ask_in_session(
            query=req.query,
            session_id=session_id,
            project=session.get("project"),
            top_k=top_k,
            model=model,
            temperature=temperature,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Message failed: {str(e)}")

    return {
        "query": req.query,
        "answer": result["answer"],
        "sources": result["sources"],
    }