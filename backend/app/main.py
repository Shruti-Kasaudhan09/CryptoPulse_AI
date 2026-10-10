"""
main.py - FastAPI application entry point (Phase 15)

Run locally:
    cd backend
    uvicorn app.main:app --reload

Interactive API docs: http://localhost:8000/docs
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import router
from app.config import CORS_ORIGINS
from app.db.database import init_db
from app.services.auth import AuthConflict, AuthError
from app.services.data import BadRequest, CoinNotFound, DataNotReady


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="CryptoPulse AI API",
    description="Explainable multimodal AI for crypto forecasting, volatility and anomaly "
                "detection. Student project - not financial advice.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_methods=["GET", "POST", "PUT"],
    allow_headers=["*"],
)


@app.exception_handler(CoinNotFound)
async def coin_not_found(_req: Request, exc: CoinNotFound):
    return JSONResponse(status_code=404, content={"error": "coin_not_found", "detail": str(exc)})


@app.exception_handler(BadRequest)
async def bad_request(_req: Request, exc: BadRequest):
    return JSONResponse(status_code=400, content={"error": "bad_request", "detail": str(exc)})


@app.exception_handler(AuthError)
async def auth_error(_req: Request, exc: AuthError):
    return JSONResponse(status_code=401, content={"error": "unauthorized", "detail": str(exc)})


@app.exception_handler(AuthConflict)
async def auth_conflict(_req: Request, exc: AuthConflict):
    return JSONResponse(status_code=409, content={"error": "conflict", "detail": str(exc)})


@app.exception_handler(DataNotReady)
async def data_not_ready(_req: Request, exc: DataNotReady):
    return JSONResponse(status_code=503, content={"error": "data_not_ready", "detail": str(exc)})


@app.get("/")
def root():
    return {"name": "CryptoPulse AI API", "docs": "/docs", "health": "/api/health"}


app.include_router(router)
