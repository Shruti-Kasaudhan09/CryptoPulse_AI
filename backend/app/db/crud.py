"""
crud.py - database reads/writes used by the API
"""

import os
from datetime import date

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Prediction, Sentiment
from app.services.data import data_path, live_features, read_csv


# -------------------------------------------------------------- predictions
def log_prediction(db: Session, pred: dict) -> None:
    """Stores the headline + every model's forecast once per (coin, model, day)."""
    as_of = date.fromisoformat(pred["as_of"])
    target = date.fromisoformat(pred["forecast_for"])
    for m in pred["all_models"]:
        exists = db.scalar(select(Prediction.id).where(
            Prediction.symbol == pred["coin"],
            Prediction.model == m["model"],
            Prediction.as_of_date == as_of,
        ))
        if exists:
            continue
        db.add(Prediction(
            symbol=pred["coin"], model=m["model"], as_of_date=as_of, target_date=target,
            current_close=pred["current_close"], predicted_close=m["predicted_close"],
            direction=m["direction"],
        ))
    db.commit()


def prediction_history(db: Session, coin: str, limit: int = 60) -> dict:
    """
    Every forecast the API has served for this coin, matched against the
    actual close once that day has happened. Over time this becomes a
    genuine out-of-sample track record - the strongest evidence you can show.
    """
    rows = db.scalars(
        select(Prediction).where(Prediction.symbol == coin)
        .order_by(Prediction.as_of_date.desc(), Prediction.model).limit(limit)
    ).all()

    actual = {}
    try:
        df = live_features(coin)
        actual = {d.date(): float(c) for d, c in zip(df["Date"], df["Close"])}
    except Exception:
        pass

    out, resolved, hits = [], 0, 0
    for r in rows:
        act = actual.get(r.target_date)
        correct = None
        if act is not None:
            correct = (act > r.current_close) == (r.direction == "UP")
            resolved += 1
            hits += int(correct)
        out.append({
            "model": r.model, "as_of": r.as_of_date.isoformat(),
            "target_date": r.target_date.isoformat(), "current_close": r.current_close,
            "predicted_close": r.predicted_close, "direction": r.direction,
            "actual_close": act, "direction_correct": correct,
        })
    return {
        "coin": coin,
        "resolved": resolved,
        "direction_hit_rate_pct": round(hits / resolved * 100, 1) if resolved else None,
        "rows": out,
    }


# --------------------------------------------------------------- sentiment
def _sentiment_from_csv() -> pd.DataFrame | None:
    path = data_path("daily_sentiment_log.csv")
    if not os.path.exists(path):
        return None
    df = read_csv(path, "")
    return df if len(df) else None


def sentiment_history(db: Session, days: int = 60) -> list:
    rows = db.scalars(select(Sentiment).order_by(Sentiment.date.desc()).limit(days)).all()
    if rows:
        return [{"date": r.date.isoformat(), "pos_pct": r.pos_pct, "neu_pct": r.neu_pct,
                 "neg_pct": r.neg_pct, "sentiment_score": r.sentiment_score,
                 "n_articles": r.n_articles} for r in reversed(rows)]
    df = _sentiment_from_csv()
    if df is None:
        return []
    return df.tail(days).to_dict(orient="records")


def latest_headlines(limit: int = 12) -> list:
    path = data_path("latest_sentiment.csv")
    if not os.path.exists(path):
        return []
    df = read_csv(path, "")
    cols = [c for c in ("source", "title", "link", "label", "confidence") if c in df.columns]
    return df[cols].head(limit).to_dict(orient="records")


def latest_sentiment_raw(db: Session) -> tuple[float, bool]:
    hist = sentiment_history(db, days=1)
    if hist:
        return float(hist[-1]["sentiment_score"]), True
    return 0.0, False
