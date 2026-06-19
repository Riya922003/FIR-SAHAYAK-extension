from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import init_db
from app.routers import auth, fir, ai, admin, authority


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    yield
    # Shutdown (add cleanup here if needed)


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
