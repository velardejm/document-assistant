# Contract Assistant — Project Checkpoint

## What We've Built So Far

### Phase 1 — Environment ✓
- Project structure under `contract-assistant/backend/`
- `pyproject.toml` with all dependencies managed by `uv`
- `.env` / `.env.example` for configuration
- `config.py` using pydantic-settings to load environment variables
- `main.py` — FastAPI app with CORS and `/health` route confirmed running

### Phase 2 — Supabase ✓
- pgvector extension enabled
- All tables created (see schema below)
- `match_chunks` vector similarity search function created
- Connection verified from Python

### Phase 3 — Ingestion Pipeline ✓
- Tested extraction, chunking, and embedding in notebooks
- Three service modules written and working
- Ingest router wired up and tested via Swagger
- Full pipeline confirmed: Drive → extract → chunk → embed → Supabase

---

## Architecture

```
User Request (POST /ingest)
        │
        ▼
   routers/ingest.py
        │
        ├── services/extractor.py
        │     └── Google Drive API → download file → extract text
        │           ├── PDF → pdfplumber (skip TOC pages)
        │           └── DOCX → python-docx
        │
        ├── services/chunker.py
        │     └── clean text → split on clause numbers (X.X pattern)
        │           └── sub-chunk if > 1500 tokens
        │
        └── services/embedder.py
              └── OpenAI text-embedding-3-small (batches of 100)
                    └── insert into Supabase contract_chunks
```

---

## Supabase Schema

### `contract_chunks`
Stores the text chunks and their vector embeddings.

| Column | Type | Description |
|---|---|---|
| id | uuid | Primary key |
| file_id | uuid | References ingested_files |
| project | text | e.g. "QMC Heritage" |
| filename | text | e.g. "Contract C2024-49.pdf" |
| clause_ref | text | e.g. "1.2.3" |
| content | text | The chunk text |
| char_start | integer | Character position in source |
| char_end | integer | Character position in source |
| embedding | vector(1536) | OpenAI embedding |
| created_at | timestamptz | Auto |

### `ingested_files`
Tracks every file that has been processed.

| Column | Type | Description |
|---|---|---|
| id | uuid | Primary key |
| drive_file_id | text | Google Drive file ID |
| filename | text | Original filename |
| project | text | Project folder name |
| mime_type | text | File MIME type |
| chunk_count | integer | Number of chunks created |
| drive_modified | timestamptz | Last modified time in Drive |
| ingested_at | timestamptz | When we ingested it |

### `chat_sessions`
One row per conversation mode session.

| Column | Type | Description |
|---|---|---|
| id | uuid | Primary key |
| title | text | Session title |
| project | text | Optional project filter |
| created_at | timestamptz | Auto |
| updated_at | timestamptz | Auto |

### `chat_messages`
Individual messages within a session.

| Column | Type | Description |
|---|---|---|
| id | uuid | Primary key |
| session_id | uuid | References chat_sessions |
| role | text | "user" or "assistant" |
| content | text | Message text |
| sources | jsonb | Clause references cited |
| created_at | timestamptz | Auto |

### `app_settings`
Single-row user-configurable settings.

| Column | Type | Description |
|---|---|---|
| id | integer | Always 1 (single row) |
| model | text | e.g. "gpt-4o-mini" |
| temperature | float | Default 0.2 |
| top_k | integer | Chunks retrieved per query |
| system_prompt | text | LLM system prompt |
| updated_at | timestamptz | Auto |

### `sync_log`
History of every sync job.

| Column | Type | Description |
|---|---|---|
| id | uuid | Primary key |
| started_at | timestamptz | Auto |
| finished_at | timestamptz | When sync completed |
| files_added | integer | New files ingested |
| files_updated | integer | Modified files re-ingested |
| files_skipped | integer | Unchanged files skipped |
| status | text | "running" / "complete" / "error" |
| error | text | Error message if failed |

---

## File Structure (Current)

```
contract-assistant/
├── .gitignore
└── backend/
    ├── pyproject.toml
    ├── .env
    ├── .env.example
    ├── config.py
    ├── main.py
    ├── supabase_setup.sql
    ├── notebooks/
    │   ├── 00_test_supabase.ipynb
    │   ├── 01_test_extraction.ipynb
    │   ├── 02_test_chunking.ipynb
    │   ├── 03_test_embeddings.ipynb
    │   └── 04_test_drive_sync.ipynb
    ├── routers/
    │   ├── __init__.py
    │   └── ingest.py
    └── services/
        ├── __init__.py
        ├── extractor.py
        ├── chunker.py
        └── embedder.py
```

---

## Key Decisions Made

| Decision | Reason |
|---|---|
| Skip first 8 pages on PDF extraction | Pages 1-8 are TOC — same clause numbers, no real content |
| Chunk on `X.X` number pattern, not "Clause" keyword | Contract uses numbered format without the word "Clause" |
| Batch embeddings in groups of 100 | Reduces API calls, avoids rate limiting |
| Store `file_id` on every chunk | Enables clean delete + re-ingest when a file changes |
| Fake `file_id` in notebooks, real one in router | Notebooks are for testing logic only — router owns the real data |

---

## Next Steps

### Immediate — Phase 5 (Retrieval + Quick Question)
- [ ] `05_test_retrieval.ipynb` — test vector similarity search against Supabase
- [ ] `services/search.py` — search logic module
- [ ] `services/prompt_builder.py` — assemble prompt from retrieved chunks
- [ ] `routers/chat.py` — `POST /chat/quick` endpoint
- [ ] Test: ask a question, get answer with clause citations

### Then — Frontend (Partial)
- [ ] Next.js project scaffold
- [ ] Single chat page — input box, answer display, clause references
- [ ] Wire up to `POST /chat/quick`

### Later
- [ ] Phase 4 — Drive sync (auto-detect new/modified files)
- [ ] Phase 6 — Conversation mode with session history
- [ ] Phase 7 — Settings (model, temperature, top_k)
- [ ] Phase 8 — Full frontend (all pages)
