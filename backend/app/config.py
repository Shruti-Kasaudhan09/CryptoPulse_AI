"""
config.py
----------
All settings come from environment variables so the same code runs locally,
in tests, and on Render/Railway without edits.

    CRYPTOPULSE_ML_DIR  folder holding data/ and saved_models/ (default: ../ml).
                        The ML *code* is always imported from ../ml.
    DATABASE_URL        SQLAlchemy URL. Default: a local SQLite file.
                        For Supabase/PostgreSQL use:
                        postgresql+psycopg2://user:pass@host:5432/postgres
    CORS_ORIGINS        comma-separated list of allowed frontend URLs
"""

import os

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT_DIR = os.path.dirname(BACKEND_DIR)


def _load_dotenv(path):
    """Minimal .env reader (KEY=VALUE per line) so no extra dependency is needed.
    Real environment variables always win over the file."""
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_dotenv(os.path.join(BACKEND_DIR, ".env"))

ML_CODE_DIR = os.path.join(PROJECT_DIR, "ml")
ML_DIR = os.path.abspath(os.environ.get("CRYPTOPULSE_ML_DIR", os.path.join(PROJECT_DIR, "ml")))
DATA_DIR = os.path.join(ML_DIR, "data")
MODELS_DIR = os.path.join(ML_DIR, "saved_models")

DATABASE_URL = os.environ.get(
    "DATABASE_URL", f"sqlite:///{os.path.join(BACKEND_DIR, 'cryptopulse.db')}"
)
# Supabase/Heroku-style URLs start with postgres:// which SQLAlchemy 2 rejects
# Supabase/Heroku-style URLs start with postgres:// (rejected by SQLAlchemy 2) or
# postgresql:// (which newer SQLAlchemy maps to psycopg v3). Pin the installed driver.
for _prefix in ("postgres://", "postgresql://"):
    if DATABASE_URL.startswith(_prefix):
        DATABASE_URL = DATABASE_URL.replace(_prefix, "postgresql+psycopg2://", 1)
        break
CORS_ORIGINS = [
    o.strip() for o in os.environ.get(
        "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",") if o.strip()
]

SUPPORTED_COINS = {
    "BTC": "Bitcoin",
    "ETH": "Ethereum",
    "SOL": "Solana",
}

# Live forecasting models: trained by ml/evaluation/backtest.py on % returns
# from scale-free features ({COIN}_{Model}_returns.joblib). The Phase 6
# price-level models are shown in the Model Arena only.
FORECAST_MODELS = ["Ridge", "RandomForest", "XGBoost"]

# ---- Ask CryptoPulse (AI assistant) --------------------------------------
# Any OpenAI-compatible chat API with tool calling works. Set LLM_PROVIDER and
# LLM_API_KEY (in backend/.env or the environment); LLM_MODEL / LLM_BASE_URL
# override the defaults. Without a key the assistant runs in offline mode.
LLM_PRESETS = {
    "gemini": ("https://generativelanguage.googleapis.com/v1beta/openai", "gemini-2.5-flash"),
    "groq": ("https://api.groq.com/openai/v1", "llama-3.3-70b-versatile"),
    "openai": ("https://api.openai.com/v1", "gpt-4o-mini"),
}
_provider = os.environ.get("LLM_PROVIDER", "gemini").strip().lower()
_base, _model = LLM_PRESETS.get(_provider, LLM_PRESETS["gemini"])
_key = os.environ.get("LLM_API_KEY", "").strip()
LLM = {
    "provider": _provider,
    "api_key": _key,
    "base_url": os.environ.get("LLM_BASE_URL", _base),
    "model": os.environ.get("LLM_MODEL", _model),
    "enabled": bool(_key) and os.environ.get("LLM_DISABLED", "") != "1",
}

DISCLAIMER = (
    "Output of a student project's models trained on limited historical data. "
    "Not financial advice."
)
