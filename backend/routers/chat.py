from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from supabase import create_client

from config import settings
from services.prompt_builder import ask

router = APIRouter(prefix="/chat", tags=["chat"])
sb = create_client(settings.supabase_url, settings.supabase_service_role_key)


class QuickQuestionRequest(BaseModel):
    query: str
    project: str | None = None
    top_k: int = 5


@router.post("/quick")
def quick_question(req: QuickQuestionRequest):
    if not req.query.strip():
        raise HTTPException(status_code=422, detail="Query cannot be empty")

    # Get model settings from Supabase
    settings_row = sb.table("app_settings").select("*").eq("id", 1).execute()
    app_settings = settings_row.data[0] if settings_row.data else {}

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