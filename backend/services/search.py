from openai import OpenAI
from supabase import create_client

from config import settings

openai_client = OpenAI(api_key=settings.openai_api_key)
sb = create_client(settings.supabase_url, settings.supabase_service_role_key)

EMBEDDING_MODEL = "text-embedding-3-small"


def search_chunks(query: str, top_k: int = 5, project: str = None) -> list[dict]:
    """
    Embed the query and return the top_k most similar chunks from Supabase.
    Optionally filter by project.
    """
    response = openai_client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=query
    )
    query_embedding = response.data[0].embedding

    result = sb.rpc("match_chunks", {
        "query_embedding": query_embedding,
        "match_count": top_k,
        "filter_project": project
    }).execute()

    return result.data