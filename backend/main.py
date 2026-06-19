from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.core.config import settings
from app.core.database import init_db, engine
from app.routers import auth, fir, ai, admin, authority


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
    return {"status": "ok", "cors": "open", "build": "fd299ed-plus"}
