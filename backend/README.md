# backend/

FastAPI backend (Phase 15) + database (Phase 16). It imports the ML functions
from `../ml` directly, so the dashboard always shows the same numbers the
pipeline scripts print.

```bash
pip install -r requirements.txt
python -m app.db.sync            # after running ml/run_pipeline.py
uvicorn app.main:app --reload    # docs at http://localhost:8000/docs
```

| Path | Purpose |
|---|---|
| `app/main.py` | app, CORS, error handlers (404 / 400 / 503) |
| `app/api/routes.py` | every endpoint |
| `app/services/market.py` | price + indicator series |
| `app/services/prediction.py` | live forecasts from the return models + LSTM |
| `app/services/explanation.py` | SHAP ("why this prediction?") |
| `app/services/analysis.py` | volatility, anomalies, CryptoPulse Score |
| `app/services/evaluation.py` | Model Arena + backtest data |
| `app/db/models.py` | tables: crypto_assets, market_data, predictions, sentiment, anomalies, model_metrics |
| `app/db/sync.py` | loads pipeline CSVs into the database |
| `app/db/crud.py` | prediction logging + track record, sentiment |

Settings (all via environment variables, see `.env.example`):
`DATABASE_URL` (default: local SQLite), `CORS_ORIGINS`, `CRYPTOPULSE_ML_DIR`.

Deployment: see `../docs/DEPLOYMENT.md`.
