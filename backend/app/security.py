"""Authentication helpers: PBKDF2 password hashes and signed JWT access tokens."""
import hashlib, hmac, os, base64, secrets
from datetime import datetime, timedelta, timezone
import jwt
from fastapi import HTTPException, status
from app.config import settings

def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    rounds = 310_000
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, rounds)
    return f"pbkdf2_sha256${rounds}${base64.b64encode(salt).decode()}${base64.b64encode(digest).decode()}"

def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, rounds, salt, digest = stored.split("$")
        if scheme != "pbkdf2_sha256": return False
        actual = hashlib.pbkdf2_hmac("sha256", password.encode(), base64.b64decode(salt), int(rounds))
        return hmac.compare_digest(actual, base64.b64decode(digest))
    except Exception:
        return False

def create_access_token(user_id: str, username: str, role: str) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode({"sub":user_id,"username":username,"role":role,"iat":now,"exp":now+timedelta(minutes=settings.access_token_minutes)}, settings.jwt_secret, algorithm="HS256")

def extract_bearer_token(raw_auth: str | None, query_token: str | None = None) -> str | None:
    """Extract clean JWT token handling multiple 'Bearer' prefixes and query param fallback."""
    candidate = raw_auth or query_token
    if not candidate:
        return None
    token = candidate.strip()
    while token.lower().startswith("bearer "):
        token = token[7:].strip()
    return token if token else None

def decode_token(token: str) -> dict:
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token is missing")
    token = token.strip()
    while token.lower().startswith("bearer "):
        token = token[7:].strip()
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Access token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid access token")

