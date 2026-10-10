# CryptoPulse AI

**An Explainable Multimodal AI System for Cryptocurrency Price Forecasting,
Volatility Analysis and Market Anomaly Detection**

Built in phases rather than all at once, so each part is actually understood
and can be defended in a viva.

```
 Yahoo Finance ──► clean ──► 22 technical features ──┬─► Linear / RF / XGBoost (price)  ─► Model Arena
 (BTC ETH SOL)                                       ├─► LSTM + Ridge/RF/XGB (% return) ─► Walk-forward backtest
                                                     ├─► Volatility levels (per-coin percentiles)
 Crypto news RSS ──► FinBERT sentiment ─────────┐    ├─► Isolation Forest anomalies
                                                ▼    ▼
                                         CryptoPulse Score ◄── SHAP "why this prediction?"
                                                     │
                     PostgreSQL / Supabase ◄── FastAPI ──► React + Tailwind dashboard
```

## Status: Phases 1–22 complete

| Phase | What it does | Where |
|---|---|---|
| 1 | Project structure | this repo layout |
| 2 | Download BTC/ETH/SOL daily OHLCV | `ml/data/download_data.py` |
| 3 | Clean the raw data | `ml/preprocessing/clean_data.py` |
| 4 | Technical indicators (SMA, EMA, RSI, MACD, Bollinger, volatility, momentum) | `ml/features/indicators.py` |
| 5–6 | Next-day task + Linear Regression / Random Forest / XGBoost baselines | `ml/models/train_models.py` |
| 7 | Chronological evaluation (MAE, RMSE, MAPE, direction accuracy/precision/recall/F1) | `ml/evaluation/metrics.py` |
| 8 | LSTM on 30-day sequences, predicting **% return** | `ml/models/train_lstm.py` |
| 9–10 | FinBERT news sentiment + daily sentiment log | `ml/sentiment/` |
| 11 | Volatility classification (Low/Medium/High, per-coin thresholds) | `ml/analysis/volatility_analysis.py` |
| 12 | Anomaly detection (Isolation Forest) | `ml/analysis/anomaly_detection.py` |
| 13 | SHAP explainability | `ml/explainability/shap_explain.py` |
| 14 | CryptoPulse Score (0–100) | `ml/scoring/cryptopulse_score.py` |
| **15** | **FastAPI backend** — 14 endpoints | `backend/app/` |
| **16** | **Database** — SQLite locally, Supabase/PostgreSQL in production | `backend/app/db/` |
| **17** | **React dashboard** — prices, forecast, score, volatility, anomalies, sentiment, live track record | `frontend/cryptopulse-dashboard/` |
| **18** | **"Why this prediction?" page** — SHAP breakdown in $ and % | `src/pages/WhyPrediction.jsx` |
| **19** | **Model Arena page** | `src/pages/ModelArena.jsx` |
| **20** | **Walk-forward backtest** vs a naive baseline | `ml/evaluation/backtest.py` |
| **21** | **Tests** — 60 Python (ML + API) and 11 frontend, run in CI | `tests/`, `src/test/` |
| **22** | **Deployment** — Docker, Render, Vercel, Supabase, GitHub Actions | `docs/DEPLOYMENT.md` |
| 23 | PPT, report, viva | next — see `docs/VIVA_NOTES.md` for the material |

## Run it locally

You need Python 3.10+ and Node 18+.

```bash
# 1. ML pipeline (downloads data, trains everything, ~3-5 min)
cd ml
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
python run_pipeline.py              # add --skip-lstm if tensorflow isn't installed

# 2. Backend API  (new terminal, same venv)
cd backend
pip install -r requirements.txt
python -m app.db.sync               # load pipeline results into the database
uvicorn app.main:app --reload       # http://localhost:8000/docs

# 3. Dashboard  (new terminal)
cd frontend/cryptopulse-dashboard
npm install
npm run dev                         # http://localhost:5173
```

No internet / Yahoo Finance down on demo day? `python run_pipeline.py --sample-data`
runs everything on **synthetic** data (clearly not real prices — never present
those numbers as results).

Sentiment runs separately (it downloads FinBERT, ~440MB, on first run). Run it
once a day to build history, then `python -m app.db.sync` from `backend/`:

```bash
cd ml/sentiment && python log_daily_sentiment.py
```

### Tests

```bash
pip install -r backend/requirements-dev.txt
python -m pytest                                  # from the repo root: 60 tests
cd frontend/cryptopulse-dashboard && npm test     # 11 tests
```

Tests generate their own synthetic data in a temp folder, so they never touch
your real `ml/data/` and don't need internet.

## API

| Endpoint | Returns |
|---|---|
| `GET /api/health` | status + which coins have data |
| `GET /api/overview` | price, 24h change, 30-day sparkline for every coin |
| `GET /api/market/{coin}?days=180` | OHLCV + indicators for the chart |
| `GET /api/prediction/{coin}?model=` | next-day forecast from every model, headline model, honesty check vs naive |
| `GET /api/predictions/history/{coin}` | every forecast served, scored against the real close once known |
| `GET /api/explanation/{coin}?model=` | SHAP contributions for today's forecast |
| `GET /api/pulse/{coin}` | CryptoPulse Score + components |
| `GET /api/volatility/{coin}` | level, percentile, thresholds, history |
| `GET /api/anomaly/{coin}` | today's status + recent anomalies with plain-language reasons |
| `GET /api/sentiment` | latest FinBERT sentiment, history, headlines |
| `GET /api/arena` | Model Arena table + winners |
| `GET /api/backtest/{coin}` | walk-forward results, actual vs predicted, rolling accuracy, illustrative equity |

Errors are consistent JSON: `404 coin_not_found`, `400 bad_request`,
`503 data_not_ready` (with a hint to run the pipeline), `422` for bad query params.

## Findings worth putting in your report

**1. Tree models can't extrapolate (Phase 6).** On the real run, Linear
Regression beat Random Forest and XGBoost on BTC (RMSE $2,641 vs $4,921 /
$5,752). Trees can only output values within the price range seen in
training, so when BTC set new highs they under-predicted. The one "good" F1
score was a model predicting UP almost every day during an uptrend.

**2. So the live system predicts % returns (Phases 8 & 20).** The LSTM and
the dashboard's forecasting models (Ridge, RF, XGBoost trained by the
backtest on scale-free features like `Close/SMA_30 − 1`) predict tomorrow's
return, which stays centred on 0 whatever the price level. On the same data,
the price-level Random Forest forecast a false **−26%** BTC crash; the
return-based one forecast **+0.5%**.

**3. Walk-forward backtest with an honest baseline (Phase 20).** Every
prediction uses only data available at the time; models retrain weekly.
A naive "tomorrow = today" baseline is included — for daily crypto prices it
is very hard to beat on price error, and the dashboard says so openly
("Honesty check"). Any edge is more likely to show in direction accuracy.

**4. Two bugs found and fixed while building Phases 15–22** — both good viva
material because they show the evaluation was checked, not just run:
- *LSTM metrics were on the wrong scale.* `Close` is an LSTM input, so after
  `StandardScaler` the "current price" used to rebuild the predicted price
  was a standardised value (≈ −1…2), not dollars. LSTM MAE/RMSE/MAPE **and**
  direction metrics were invalid (e.g. SOL: MAE $0.05 but MAPE 6.3%).
  Fixed in `train_lstm.py` — **re-run Phase 8 to get correct LSTM numbers.**
- *SHAP crashed on newer versions* (`expected_value` became an array). Fixed.

**5. Lookahead is tested, not assumed.** `tests/ml/test_features.py` checks
that features for day *t* computed from data up to *t* only are identical to
those computed with the full history; `test_prediction.py` checks that
scrambling future days never changes an earlier backtest prediction. Both
tests were verified to **fail** when a leak is deliberately injected.

**6. Sentiment has no history yet.** Free RSS feeds only give today's
headlines, so sentiment can't be a training feature for 2 years of prices.
It feeds the CryptoPulse Score now, and the daily logger (automated in
`daily-refresh.yml`) stores it in the database so it can become a model
feature once enough history exists. Don't fake historical sentiment.

## Project layout

```
CryptoPulse-AI/
├── ml/                     Phases 2-14, 20 (pipeline: python run_pipeline.py)
├── backend/                Phases 15-16 (FastAPI + SQLAlchemy)
│   ├── app/api/routes.py     all endpoints
│   ├── app/services/         market, prediction, explanation, analysis, evaluation
│   ├── app/db/               models, sync, crud
│   ├── Dockerfile, start.sh
├── frontend/cryptopulse-dashboard/   Phases 17-19 (React + Tailwind + Recharts)
├── tests/                  Phase 21 (pytest)
├── docs/                   DEPLOYMENT.md, VIVA_NOTES.md
├── .github/workflows/      CI + daily refresh
└── render.yaml             Render blueprint
```

## A note on the predictions

Forecasts and the CryptoPulse Score are outputs of a student project's models
trained on limited historical data — they are **not financial advice** and
shouldn't be presented as guaranteed or production-grade forecasts. The
equity curves on the Backtest page are illustrative only.
