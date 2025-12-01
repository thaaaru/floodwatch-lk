from contextlib import asynccontextmanager
from datetime import datetime
import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from .config import get_settings
from .database import engine, Base
from .routers import weather, alerts, subscribers, districts, intel, whatsapp
from .jobs.scheduler import start_scheduler, stop_scheduler
from .schemas import HealthResponse

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

settings = get_settings()

# Rate limiter
limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle."""
    # Startup
    logger.info("Starting FloodWatch LK Backend...")

    # Create database tables
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created/verified")

    # Start background scheduler
    start_scheduler()

    yield

    # Shutdown
    logger.info("Shutting down FloodWatch LK Backend...")
    stop_scheduler()


# Create FastAPI app
app = FastAPI(
    title="FloodWatch LK API",
    description="Flood monitoring and early warning system for Sri Lanka",
    version="1.0.0",
    lifespan=lifespan
)

# Add rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Configure CORS
allowed_origins = [
    settings.frontend_url,
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "https://frontend-iltbjzuqs-thaaarus-projects.vercel.app",
    "https://frontend-thaaarus-projects.vercel.app",
    "https://staging-floodwatch.vercel.app",
    "https://weather.hackandbuild.dev",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*(-thaaarus-projects)?\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(weather.router)
app.include_router(alerts.router)
app.include_router(subscribers.router)
app.include_router(districts.router)
app.include_router(intel.router)
app.include_router(whatsapp.router)


@app.get("/api/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return HealthResponse(
        status="healthy",
        version="1.0.0",
        timestamp=datetime.utcnow()
    )


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": "FloodWatch LK API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/api/health"
    }


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )
