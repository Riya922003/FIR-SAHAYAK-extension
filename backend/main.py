from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from sqlalchemy import text

from app.core.config import settings
from app.core.database import init_db, engine
from app.core.limiter import limiter
from app.core.circuit_breaker import groq_breaker
from app.routers import auth, fir, ai, admin, authority, enrichment


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables (no-op if already exist)
    await init_db()
    # Add new columns if they don't exist yet (safe to run every startup)
    try:
        async with engine.begin() as conn:
            await conn.execute(text(
                "ALTER TABLE firs ADD COLUMN IF NOT EXISTS ai_interview_summary TEXT"
            ))
            await conn.execute(text(
                "ALTER TABLE firs ADD COLUMN IF NOT EXISTS suggested_ipc_sections VARCHAR"
            ))
            await conn.execute(text(
                "ALTER TABLE firs ADD COLUMN IF NOT EXISTS enrichment_status VARCHAR NOT NULL DEFAULT 'pending'"
            ))
            await conn.execute(text(
                "ALTER TABLE firs ADD COLUMN IF NOT EXISTS description_enriched TEXT"
            ))
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS ai_conversations (
                    id VARCHAR PRIMARY KEY,
                    fir_id VARCHAR NOT NULL UNIQUE REFERENCES firs(id),
                    messages JSON NOT NULL DEFAULT '[]',
                    turn_count INTEGER NOT NULL DEFAULT 0,
                    created_at TIMESTAMP NOT NULL,
                    updated_at TIMESTAMP NOT NULL
                )
            """))
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_ai_conversations_fir_id ON ai_conversations(fir_id)"
            ))
        print("[OK] Schema columns verified.")
    except Exception as e:
        print(f"[WARNING] Schema migration skipped: {e}")
    yield


app = FastAPI(
    title=settings.APP_NAME,
    description="Online FIR filing platform with AI assistance, full lifecycle management, and RBAC.",
    version="2.0.0",
    docs_url="/docs",       # Swagger UI
    redoc_url="/redoc",     # ReDoc UI
    lifespan=lifespan,
)

# ── Rate limiting ──────────────────────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# ── CORS ──────────────────────────────────────────────────────────────────────
# Allow all localhost/127.0.0.1 ports for local development.
# In production, set ALLOWED_ORIGINS in .env and remove allow_origin_regex.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
API_PREFIX = "/api/v1"

app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(fir.router, prefix=API_PREFIX)
app.include_router(ai.router, prefix=API_PREFIX)
app.include_router(admin.router, prefix=API_PREFIX)
app.include_router(authority.router, prefix=API_PREFIX)
app.include_router(enrichment.router, prefix=API_PREFIX)


@app.get("/", tags=["Health"])
async def root():
    return {
        "app": settings.APP_NAME,
        "version": "2.0.0",
        "docs": "/docs",
        "status": "running",
    }


@app.get("/health", tags=["Health"])
async def health_check():
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        db_status = "ok"
    except Exception:
        db_status = "error"

    return {
        "status": "ok" if db_status == "ok" else "degraded",
        "db": db_status,
        "groq_circuit": groq_breaker.state(),
        "version": "2.0.0",
    }
