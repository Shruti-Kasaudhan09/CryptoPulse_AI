"""Phase 15/16 - every API endpoint, error handling and the database."""

import os
import shutil
from datetime import date, timedelta

import pytest

COINS = ["BTC", "ETH", "SOL"]


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "data_ready": True, "coins": COINS}


def test_assets_and_overview(client):
    assert [a["symbol"] for a in client.get("/api/assets").json()] == COINS
    ov = client.get("/api/overview").json()
    assert [o["coin"] for o in ov] == COINS
    assert all(len(o["sparkline"]) == 30 and o["close"] > 0 for o in ov)


@pytest.mark.parametrize("coin", COINS)
def test_market(client, coin):
    d = client.get(f"/api/market/{coin}?days=60").json()
    assert d["coin"] == coin
    assert len(d["series"]) == 60
    assert d["series"][-1]["date"] == d["as_of"]
    assert d["latest"]["low_period"] <= d["latest"]["close"] <= d["latest"]["high_period"]


def test_coin_symbol_is_case_insensitive(client):
    assert client.get("/api/market/btc").json()["coin"] == "BTC"


@pytest.mark.parametrize("path", ["/api/market/DOGE", "/api/prediction/XRP", "/api/pulse/ABC",
                                  "/api/volatility/DOGE", "/api/anomaly/DOGE", "/api/explanation/DOGE",
                                  "/api/backtest/DOGE", "/api/predictions/history/DOGE"])
def test_invalid_coin_is_404(client, path):
    r = client.get(path)
    assert r.status_code == 404
    assert r.json()["error"] == "coin_not_found"


def test_query_validation(client):
    assert client.get("/api/market/BTC?days=5").status_code == 422


def test_prediction(client):
    d = client.get("/api/prediction/BTC").json()
    h = d["headline"]
    assert h["model"] in {"Ridge", "RandomForest", "XGBoost"}
    assert h["direction"] == ("UP" if h["predicted_close"] > d["current_close"] else "DOWN")
    # a next-day return forecast should be modest, not a -25% "crash" artefact
    assert all(abs(m["predicted_return_pct"]) < 20 for m in d["all_models"])
    assert d["agreement"]["total"] == len(d["all_models"])
    assert date.fromisoformat(d["forecast_for"]) == date.fromisoformat(d["as_of"]) + timedelta(days=1)
    assert d["skill_vs_naive"]["naive_rmse"] > 0
    assert "Not financial advice" in d["disclaimer"]


def test_prediction_picks_lowest_backtest_rmse(client, ml_dir):
    import pandas as pd
    bt = pd.read_csv(os.path.join(ml_dir, "saved_models", "backtest_results.csv"))
    sub = bt[(bt["Coin"] == "ETH") & bt["Model"].isin(["Ridge", "RandomForest", "XGBoost"])]
    expected = sub.sort_values("RMSE").iloc[0]["Model"]
    assert client.get("/api/prediction/ETH").json()["headline"]["model"] == expected


def test_prediction_specific_model_and_bad_model(client):
    assert client.get("/api/prediction/SOL?model=Ridge").json()["headline"]["model"] == "Ridge"
    r = client.get("/api/prediction/SOL?model=Magic")
    assert r.status_code == 400 and r.json()["error"] == "bad_request"


@pytest.mark.parametrize("model", ["Ridge", "RandomForest", "XGBoost"])
def test_explanation_shap_values_add_up(client, model):
    d = client.get(f"/api/explanation/BTC?model={model}").json()
    assert d["model"] == model
    # SHAP's defining property: base + contributions == prediction
    assert d["check_sum_pct"] == pytest.approx(d["predicted_return_pct"], abs=1e-4)
    shown = sum(f["contribution_pct"] for f in d["top_features"]) + d["other_contribution_pct"]
    assert d["base_value_pct"] + shown == pytest.approx(d["predicted_return_pct"], abs=1e-4)
    contribs = [abs(f["contribution_pct"]) for f in d["top_features"]]
    assert contribs == sorted(contribs, reverse=True)
    assert sum(g["share_pct"] for g in d["global_importance"]) == pytest.approx(100, abs=0.01)


def test_explanation_defaults_to_headline_model(client):
    assert (client.get("/api/explanation/ETH").json()["model"]
            == client.get("/api/prediction/ETH").json()["headline"]["model"])


def test_explanation_bad_model(client):
    assert client.get("/api/explanation/BTC?model=LSTM").status_code == 400


def test_volatility(client):
    d = client.get("/api/volatility/ETH").json()
    assert d["level"] in {"Low", "Medium", "High"}
    assert d["thresholds"]["low_thresh"] < d["thresholds"]["high_thresh"]
    assert 0 <= d["percentile"] <= 100


def test_anomaly(client):
    d = client.get("/api/anomaly/SOL").json()
    assert 0 < d["total_flagged"] < d["total_days"]
    assert all(a["reason"].startswith("Unusually") for a in d["recent"])
    assert "does NOT imply fraud" in d["note"]


def test_pulse(client):
    d = client.get("/api/pulse/BTC").json()
    assert 0 <= d["score"] <= 100
    assert sum(c["weight"] for c in d["components"]) == pytest.approx(1.0)
    assert d["score"] == pytest.approx(sum(c["contribution"] for c in d["components"]), abs=0.3)
    assert d["sentiment_available"] is False     # no sentiment log in the test data
    assert d["labels"]["sentiment"] == "No data yet"


def test_sentiment_empty_state(client):
    d = client.get("/api/sentiment").json()
    assert d["available"] is False and d["history"] == [] and d["note"]


def test_arena_and_backtest(client):
    a = client.get("/api/arena").json()
    assert set(a["winners"]) == set(COINS)
    assert a["winners"]["BTC"]["lowest_rmse"] == "LinearRegression"
    b = client.get("/api/backtest/BTC").json()
    assert "Naive" in b["models"] and b["n_days"] == len(b["series"]) > 0
    assert {r["Model"] for r in b["summary"]} >= {"Naive", "Ridge", "BuyAndHold"}


def test_predictions_are_logged_once_per_day(client):
    client.get("/api/prediction/SOL")
    client.get("/api/prediction/SOL")
    h = client.get("/api/predictions/history/SOL").json()
    models = [r["model"] for r in h["rows"]]
    assert len(models) == len(set(models))      # no duplicates for the same day
    assert all(r["direction_correct"] is None for r in h["rows"])   # tomorrow hasn't happened


def test_past_prediction_gets_scored(client):
    """A forecast whose target day is in the data is resolved against the real close."""
    from app.db.database import SessionLocal
    from app.db.models import Prediction
    from app.services.data import live_features

    df = live_features("ETH")
    as_of, target = df["Date"].iloc[-3].date(), df["Date"].iloc[-2].date()
    today_close, next_close = float(df["Close"].iloc[-3]), float(df["Close"].iloc[-2])
    right_call = "UP" if next_close > today_close else "DOWN"

    db = SessionLocal()
    db.add(Prediction(symbol="ETH", model="TestModel", as_of_date=as_of, target_date=target,
                      current_close=today_close, predicted_close=today_close, direction=right_call))
    db.commit()
    db.close()

    h = client.get("/api/predictions/history/ETH").json()
    row = next(r for r in h["rows"] if r["model"] == "TestModel")
    assert row["actual_close"] == pytest.approx(next_close)
    assert row["direction_correct"] is True
    assert h["resolved"] >= 1


def test_database_sync(client):
    from sqlalchemy import func, select
    from app.db.database import SessionLocal
    from app.db.models import Anomaly, MarketData, ModelMetric
    from app.db.sync import run_sync

    report = run_sync()
    assert report["BTC"]["market_rows"] > 0
    db = SessionLocal()
    try:
        assert db.scalar(select(func.count()).select_from(MarketData)) == sum(report[c]["market_rows"] for c in COINS)
        assert db.scalar(select(func.count()).select_from(Anomaly)) > 0
        assert db.scalar(select(func.count()).select_from(ModelMetric)) == report["model_metrics"]
    finally:
        db.close()
    # running it twice must not duplicate anything
    assert run_sync()["BTC"]["market_rows"] == report["BTC"]["market_rows"]


def test_missing_pipeline_output_is_503(client, ml_dir):
    path = os.path.join(ml_dir, "saved_models", "model_arena_results.csv")
    backup = path + ".bak"
    shutil.move(path, backup)
    try:
        r = client.get("/api/arena")
        assert r.status_code == 503
        assert r.json()["error"] == "data_not_ready"
    finally:
        shutil.move(backup, path)
