"""
auth.py - Sign up / Sign in (email + password)

  - Passwords are hashed with bcrypt (salted, deliberately slow). The plain
    password is never stored or logged.
  - After signing in, the browser gets a signed JWT (valid 7 days) and sends
    it as "Authorization: Bearer <token>" on requests that need an account.
  - The market dashboard stays public; accounts are only used to save the
    user's portfolio and chat history so they follow them across devices.
"""

import os
import re
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, Header
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import BACKEND_DIR
from app.db.database import get_db
from app.db.models import User

TOKEN_DAYS = 7
ALGORITHM = "HS256"
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class AuthError(Exception):
    """401 - missing/invalid credentials or token."""


class AuthConflict(Exception):
    """409 - e.g. email already registered."""


def _secret() -> str:
    """JWT signing key: JWT_SECRET env var in production; for local dev a random
    key is generated once and kept in backend/.secret_key (git-ignored) so
    users stay signed in across restarts."""
    env = os.environ.get("JWT_SECRET")
    if env:
        return env
    path = os.path.join(BACKEND_DIR, ".secret_key")
    if not os.path.exists(path):
        with open(path, "w") as f:
            f.write(secrets.token_hex(32))
    with open(path) as f:
        return f.read().strip()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8")[:72], bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8")[:72], hashed.encode())
    except ValueError:
        return False


def make_token(user: User) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": str(user.id), "name": user.name, "iat": now, "exp": now + timedelta(days=TOKEN_DAYS)}
    return jwt.encode(payload, _secret(), algorithm=ALGORITHM)


def public_user(user: User) -> dict:
    return {"id": user.id, "name": user.name, "email": user.email,
            "created_at": user.created_at.isoformat() if user.created_at else None}


def validate_signup(name: str, email: str, password: str):
    name = (name or "").strip()
    email = (email or "").strip().lower()
    if not 1 <= len(name) <= 60:
        raise ValueError("Please enter your name (up to 60 characters).")
    if not EMAIL_RE.match(email) or len(email) > 254:
        raise ValueError("Please enter a valid email address.")
    if len(password or "") < 8:
        raise ValueError("Password must be at least 8 characters.")
    if len(password) > 128:
        raise ValueError("Password is too long (max 128 characters).")
    return name, email


def signup(db: Session, name: str, email: str, password: str) -> dict:
    name, email = validate_signup(name, email, password)
    if db.scalar(select(User.id).where(func.lower(User.email) == email)):
        raise AuthConflict("An account with this email already exists. Try signing in.")
    user = User(name=name, email=email, password_hash=hash_password(password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"token": make_token(user), "user": public_user(user)}


def login(db: Session, email: str, password: str) -> dict:
    email = (email or "").strip().lower()
    user = db.scalar(select(User).where(func.lower(User.email) == email))
    # same message whether the email or the password was wrong - don't reveal which
    if not user or not verify_password(password or "", user.password_hash):
        raise AuthError("Incorrect email or password.")
    return {"token": make_token(user), "user": public_user(user)}


def _user_from_header(authorization: str | None, db: Session) -> User | None:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = jwt.decode(token, _secret(), algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise AuthError("Your session has expired. Please sign in again.")
    except jwt.InvalidTokenError:
        raise AuthError("Invalid session. Please sign in again.")
    user = db.get(User, int(payload["sub"]))
    if not user:
        raise AuthError("Account not found. Please sign in again.")
    return user


def current_user(authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> User:
    """FastAPI dependency: the signed-in user, or 401."""
    user = _user_from_header(authorization, db)
    if user is None:
        raise AuthError("Please sign in to use this feature.")
    return user
