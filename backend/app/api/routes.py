"""
routes.py - every HTTP endpoint the dashboard uses (Phase 15)

    GET /api/health
    GET /api/assets
    GET /api/overview
    GET /api/market/{coin}
    GET /api/prediction/{coin}?model=
    GET /api/predictions/history/{coin}
    GET /api/sentiment
    GET /api/volatility/{coin}
    GET /api/anomaly/{coin}
    GET /api/explanation/{coin}?model=
    GET /api/pulse/{coin}
    GET /api/arena
    GET /api/backtest/{coin}
    POST /api/portfolio          analyse the user's own holdings
    POST /api/ask                Ask CryptoPulse (AI assistant)
    GET  /api/ask/status         which assistant mode is active
    POST /api/auth/signup | /api/auth/login   ->  {token, user}
    GET  /api/auth/me
    GET/PUT /api/me/portfolio    the signed-in user's saved holdings
    GET/PUT /api/me/chat         the signed-in user's Ask-AI history
"""

import json


from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.config import LLM, SUPPORTED_COINS
from app.db import crud
from app.db.database import get_db
from app.db.models import User, UserData
from app.services import auth
from app.services import analysis, assistant, evaluation, explanation, market, prediction
from app.services.data import BadRequest, available_coins, normalise_coin
from app.services.portfolio import analyse_portfolio

router = APIRouter(prefix="/api")


@router.get("/health")
def health():
    coins = available_coins()
    return {"status": "ok", "data_ready": bool(coins), "coins": coins}


@router.get("/assets")
def assets():
    ready = set(available_coins())
    return [{"symbol": s, "name": n, "data_ready": s in ready} for s, n in SUPPORTED_COINS.items()]


@router.get("/overview")
def overview():
    return market.get_overview()


@router.get("/market/{coin}")
def market_data(coin: str, days: int = Query(180, ge=30, le=730)):
    return market.get_market(coin, days)


@router.get("/prediction/{coin}")
def predict(coin: str, model: str | None = None, db: Session = Depends(get_db)):
    result = prediction.get_prediction(coin, model)
    try:
        crud.log_prediction(db, result)
    except Exception:
        db.rollback()  # logging must never break the prediction itself
    return result


@router.get("/predictions/history/{coin}")
def prediction_history(coin: str, limit: int = Query(60, ge=1, le=500),
                       db: Session = Depends(get_db)):
    return crud.prediction_history(db, normalise_coin(coin), limit)


@router.get("/sentiment")
def sentiment(days: int = Query(60, ge=1, le=365), db: Session = Depends(get_db)):
    history = crud.sentiment_history(db, days)
    latest = history[-1] if history else None
    return {
        "available": latest is not None,
        "latest": latest,
        "history": history,
        "headlines": crud.latest_headlines(),
        "model": "ProsusAI/finbert",
        "note": None if latest else "No sentiment logged yet - run ml/sentiment/log_daily_sentiment.py "
                                    "daily, then backend sync.",
    }


@router.get("/sentiment/{coin}")
def sentiment_for_coin(coin: str, days: int = Query(60, ge=1, le=365), db: Session = Depends(get_db)):
    # headlines are market-wide (crypto news feeds), so every coin shares them
    normalise_coin(coin)
    return sentiment(days, db)


@router.get("/volatility/{coin}")
def volatility(coin: str, days: int = Query(180, ge=30, le=730)):
    return analysis.get_volatility(coin, days)


@router.get("/anomaly/{coin}")
def anomaly(coin: str, days: int = Query(180, ge=30, le=730)):
    return analysis.get_anomalies(coin, days)


@router.get("/explanation/{coin}")
def explain(coin: str, model: str | None = None, top_n: int = Query(10, ge=3, le=25)):
    return explanation.get_explanation(coin, model, top_n)


@router.get("/pulse/{coin}")
def pulse(coin: str, db: Session = Depends(get_db)):
    raw, available = crud.latest_sentiment_raw(db)
    return analysis.get_pulse(coin, raw, available)


@router.get("/arena")
def arena(coin: str | None = None):
    return evaluation.get_arena(coin)


@router.get("/backtest/{coin}")
def backtest(coin: str):
    return evaluation.get_backtest(coin)


# ------------------------------------------------------------ user features
class Holding(BaseModel):
    coin: str
    amount: float
    buy_price: float | None = None


class PortfolioIn(BaseModel):
    holdings: list[Holding] = Field(..., max_length=20)


@router.post("/portfolio")
def portfolio(body: PortfolioIn, db: Session = Depends(get_db)):
    raw, available = crud.latest_sentiment_raw(db)
    return analyse_portfolio([h.model_dump() for h in body.holdings], raw, available)


class ChatTurn(BaseModel):
    role: str
    content: str


class AskIn(BaseModel):
    question: str = Field(..., max_length=1000)
    coin: str = "BTC"
    history: list[ChatTurn] = Field(default_factory=list, max_length=20)
    portfolio: list[Holding] = Field(default_factory=list, max_length=20)


@router.get("/ask/status")
def ask_status(coin: str = "BTC"):
    return {
        "mode": "ai" if LLM["enabled"] else "offline",
        "provider": LLM["provider"] if LLM["enabled"] else None,
        "model": LLM["model"] if LLM["enabled"] else None,
        "suggestions": assistant.suggestions_for(normalise_coin(coin)),
    }


@router.post("/ask")
def ask(body: AskIn, db: Session = Depends(get_db)):
    try:
        return assistant.ask(
            body.question, body.coin,
            history=[t.model_dump() for t in body.history],
            portfolio=[h.model_dump() for h in body.portfolio],
            sentiment=crud.latest_sentiment_raw(db),
            sentiment_history=crud.sentiment_history(db, 60),
        )
    except ValueError as e:
        raise BadRequest(str(e))


# ------------------------------------------------------------ accounts
class SignupIn(BaseModel):
    name: str = Field(..., max_length=60)
    email: str = Field(..., max_length=254)
    password: str = Field(..., max_length=128)


class LoginIn(BaseModel):
    email: str = Field(..., max_length=254)
    password: str = Field(..., max_length=128)


@router.post("/auth/signup", status_code=201)
def signup(body: SignupIn, db: Session = Depends(get_db)):
    try:
        return auth.signup(db, body.name, body.email, body.password)
    except ValueError as e:
        raise BadRequest(str(e))


@router.post("/auth/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    return auth.login(db, body.email, body.password)


@router.get("/auth/me")
def me(user: User = Depends(auth.current_user)):
    return auth.public_user(user)


def _user_data(db: Session, user: User) -> UserData:
    row = db.get(UserData, user.id)
    if row is None:
        row = UserData(user_id=user.id, portfolio_json="[]", chat_json="[]")
        db.add(row)
        db.commit()
    return row


class PortfolioSave(BaseModel):
    holdings: list[Holding] = Field(default_factory=list, max_length=20)


@router.get("/me/portfolio")
def my_portfolio(user: User = Depends(auth.current_user), db: Session = Depends(get_db)):
    return {"holdings": json.loads(_user_data(db, user).portfolio_json or "[]")}


@router.put("/me/portfolio")
def save_my_portfolio(body: PortfolioSave, user: User = Depends(auth.current_user), db: Session = Depends(get_db)):
    for h in body.holdings:
        normalise_coin(h.coin)
        if not h.amount > 0 or (h.buy_price is not None and not h.buy_price > 0):
            raise BadRequest("Amounts and buy prices must be greater than 0.")
    row = _user_data(db, user)
    row.portfolio_json = json.dumps([h.model_dump() for h in body.holdings])
    db.commit()
    return {"saved": len(body.holdings)}


class ChatSave(BaseModel):
    messages: list[dict] = Field(default_factory=list, max_length=60)


@router.get("/me/chat")
def my_chat(user: User = Depends(auth.current_user), db: Session = Depends(get_db)):
    return {"messages": json.loads(_user_data(db, user).chat_json or "[]")}


@router.put("/me/chat")
def save_my_chat(body: ChatSave, user: User = Depends(auth.current_user), db: Session = Depends(get_db)):
    data = json.dumps(body.messages[-60:])
    if len(data) > 500_000:
        raise BadRequest("Chat history is too large.")
    row = _user_data(db, user)
    row.chat_json = data
    db.commit()
    return {"saved": len(body.messages)}
