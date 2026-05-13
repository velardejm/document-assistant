from openai import OpenAI

from config import settings
from services.search import search_chunks

openai_client = OpenAI(api_key=settings.openai_api_key)


def build_prompt(query: str, chunks: list[dict]) -> str:
    context = ""
    for chunk in chunks:
        context += f"Clause {chunk['clause_ref']}:\n{chunk['content']}\n\n"

    prompt = f"""You are a contract assistant helping a Quantity Surveyor analyse contract documents.
Answer the question using only the clauses provided below.
Always cite the clause reference in your answer.
If the answer is not found in the clauses, say so clearly.

---
{context}
---

Question: {query}

Answer:"""
    return prompt


def ask(
    query: str,
    project: str = None,
    top_k: int = 5,
    model: str = "gpt-4o-mini",
    temperature: float = 0.2,
) -> dict:
    """
    Full pipeline: search → build prompt → call GPT → return answer + sources.
    """
    chunks = search_chunks(query, top_k=top_k, project=project)
    prompt = build_prompt(query, chunks)

    response = openai_client.chat.completions.create(
        model=model,
        temperature=temperature,
        messages=[
            {"role": "user", "content": prompt}
        ]
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

    return {
        "answer": answer,
        "sources": sources,
    }