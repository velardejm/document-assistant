import uuid
from openai import OpenAI
from supabase import create_client

from config import settings
from services.search import search_chunks
from services.prompt_builder import build_prompt

openai_client = OpenAI(api_key=settings.openai_api_key)
sb = create_client(settings.supabase_url, settings.supabase_service_role_key)


def create_session(title: str, project: str = None) -> dict:
    session = {
        "id": str(uuid.uuid4()),
        "title": title,
        "project": project,
    }
    result = sb.table("chat_sessions").insert(session).execute()
    return result.data[0]


def get_session(session_id: str) -> dict | None:
    result = sb.table("chat_sessions") \
        .select("*") \
        .eq("id", session_id) \
        .execute()
    return result.data[0] if result.data else None


def list_sessions() -> list[dict]:
    result = sb.table("chat_sessions") \
        .select("*") \
        .order("updated_at", desc=True) \
        .execute()
    return result.data


def get_messages(session_id: str) -> list[dict]:
    result = sb.table("chat_messages") \
        .select("*") \
        .eq("session_id", session_id) \
        .order("created_at") \
        .execute()
    return result.data


def save_message(session_id: str, role: str, content: str, sources: list = None) -> dict:
    message = {
        "session_id": session_id,
        "role": role,
        "content": content,
        "sources": sources,
    }
    result = sb.table("chat_messages").insert(message).execute()

    # Update session updated_at
    sb.table("chat_sessions") \
        .update({"updated_at": "now()"}) \
        .eq("id", session_id) \
        .execute()

    return result.data[0]


def ask_in_session(
    query: str,
    session_id: str,
    project: str = None,
    top_k: int = 5,
    model: str = "gpt-4o-mini",
    temperature: float = 0.2,
) -> dict:
    """
    Send a message in a session. Retrieves relevant chunks, builds prompt
    with rolling window of last 6 messages, calls GPT, saves to Supabase.
    """
    # Get last 6 messages for rolling context
    all_messages = get_messages(session_id)
    recent_messages = all_messages[-6:] if len(all_messages) > 6 else all_messages

    # Retrieve relevant chunks and build system prompt
    chunks = search_chunks(query, top_k=top_k, project=project)
    system_prompt = build_prompt(query, chunks)

    # Build GPT message history
    gpt_messages = [{"role": "system", "content": system_prompt}]
    for m in recent_messages:
        gpt_messages.append({"role": m["role"], "content": m["content"]})
    gpt_messages.append({"role": "user", "content": query})

    # Call GPT
    response = openai_client.chat.completions.create(
        model=model,
        temperature=temperature,
        messages=gpt_messages
    )

    answer = response.choices[0].message.content
    sources = [
        {
            "clause_ref": c["clause_ref"],
            "filename": c["filename"],
            "project": c["project"],
            "similarity": round(c["similarity"], 4),
        }
        for c in chunks
    ]

    # Save both messages to Supabase
    save_message(session_id, "user", query)
    save_message(session_id, "assistant", answer, sources=sources)

    return {"answer": answer, "sources": sources}