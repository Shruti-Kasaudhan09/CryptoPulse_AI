"""
models.py - database tables (Phase 16)

    crypto_assets   the coins the system tracks
    market_data     daily OHLCV + key indicators (archive of what the models saw)
    predictions     every forecast the API served, so we can later score them
                    against what actually happened (a live track record)
    sentiment       daily FinBERT sentiment - stored in the DB because it can't
                    be regenerated later (free RSS feeds have no history)
    users           accounts (email + bcrypt password hash, never the password)
    user_data       each user's saved portfolio and Ask-AI chat history
    anomalies       days flagged by Isolation Forest
    model_metrics   Model Arena + backtest results
"""

from datetime import date, datetime, timezone

from sqlalchemy import (
    Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


def _now():
    return datetime.now(timezone.utc)


class CryptoAsset(Base):
    __tablename__ = "crypto_assets"
    symbol: Mapped[str] = mapped_column(String(10), primary_key=True)
    name: Mapped[str] = mapped_column(String(50))


class MarketData(Base):
    __tablename__ = "market_data"
    __table_args__ = (UniqueConstraint("symbol", "date", name="uq_market_symbol_date"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    symbol: Mapped[str] = mapped_column(ForeignKey("crypto_assets.symbol"), index=True)
    date: Mapped[date] = mapped_column(Date, index=True)
    open: Mapped[float] = mapped_column(Float)
    high: Mapped[float] = mapped_column(Float)
    low: Mapped[float] = mapped_column(Float)
    close: Mapped[float] = mapped_column(Float)
    volume: Mapped[float] = mapped_column(Float)
    rsi: Mapped[float | None] = mapped_column(Float, nullable=True)
    macd: Mapped[float | None] = mapped_column(Float, nullable=True)
    volatility: Mapped[float | None] = mapped_column(Float, nullable=True)


class Prediction(Base):
    __tablename__ = "predictions"
    __table_args__ = (UniqueConstraint("symbol", "model", "as_of_date", name="uq_pred"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    symbol: Mapped[str] = mapped_column(String(10), index=True)
    model: Mapped[str] = mapped_column(String(40))
    as_of_date: Mapped[date] = mapped_column(Date)        # the day whose features were used
    target_date: Mapped[date] = mapped_column(Date)       # the day being forecast
    current_close: Mapped[float] = mapped_column(Float)
    predicted_close: Mapped[float] = mapped_column(Float)
    direction: Mapped[str] = mapped_column(String(4))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Sentiment(Base):
    __tablename__ = "sentiment"
    date: Mapped[date] = mapped_column(Date, primary_key=True)
    pos_pct: Mapped[float] = mapped_column(Float)
    neu_pct: Mapped[float] = mapped_column(Float)
    neg_pct: Mapped[float] = mapped_column(Float)
    sentiment_score: Mapped[float] = mapped_column(Float)
    n_articles: Mapped[int] = mapped_column(Integer)


class Anomaly(Base):
    __tablename__ = "anomalies"
    __table_args__ = (UniqueConstraint("symbol", "date", name="uq_anomaly_symbol_date"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    symbol: Mapped[str] = mapped_column(String(10), index=True)
    date: Mapped[date] = mapped_column(Date)
    close: Mapped[float] = mapped_column(Float)
    return_1d: Mapped[float] = mapped_column(Float)
    score: Mapped[float] = mapped_column(Float)
    is_anomaly: Mapped[bool] = mapped_column(Boolean, default=True)


class ModelMetric(Base):
    __tablename__ = "model_metrics"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    symbol: Mapped[str] = mapped_column(String(10), index=True)
    model: Mapped[str] = mapped_column(String(40))
    evaluation: Mapped[str] = mapped_column(String(20))   # "holdout" or "backtest"
    mae: Mapped[float | None] = mapped_column(Float, nullable=True)
    rmse: Mapped[float | None] = mapped_column(Float, nullable=True)
    mape: Mapped[float | None] = mapped_column(Float, nullable=True)
    direction_accuracy: Mapped[float | None] = mapped_column(Float, nullable=True)
    direction_f1: Mapped[float | None] = mapped_column(Float, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(60))
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class UserData(Base):
    __tablename__ = "user_data"
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    portfolio_json: Mapped[str] = mapped_column(Text, default="[]")
    chat_json: Mapped[str] = mapped_column(Text, default="[]")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)
