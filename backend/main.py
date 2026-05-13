from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from routers import ingest, chat, sync

app = FastAPI(
    title="Contract Assistant",
    version="0.1.0",
    docs_url="/docs" if settings.app_env == "development" else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingest.router)
app.include_router(chat.router)
app.include_router(sync.router)


@app.get("/health")
def health():
    return {"status": "ok", "env": settings.app_env}