# DERMASATHIAI_AUTH_SESSION_SERVICE_V1

"""
Database-backed authentication session management.

Security properties:
- Access JWTs contain a session identifier (sid).
- Every authenticated request must resolve an active session.
- Refresh tokens are random opaque values.
- Only SHA-256 refresh-token hashes are persisted.
- Refresh tokens rotate on use.
- Session revocation invalidates associated access tokens.
- Client fingerprints are HMAC-SHA256, not raw IP/user-agent values.
- This module never commits transactions.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets

from datetime import datetime, timezone, timedelta
from typing import Optional

from jose import jwt, JWTError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.user import User
from app.models.platform import AuthSession


ACCESS_TOKEN_MINUTES = 15
REFRESH_TOKEN_DAYS = 30


class AuthSessionError(Exception):
    """Authentication session validation or lifecycle error."""


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _secret() -> str:

    value = str(settings.SECRET_KEY)

    if len(value.encode("utf-8")) < 32:
        raise AuthSessionError(
            "Authentication signing key is not sufficiently strong."
        )

    return value


def _hash_refresh_token(token: str) -> str:

    if not isinstance(token, str) or len(token) < 40:
        raise AuthSessionError("Invalid refresh token.")

    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _fingerprint(value: Optional[str]) -> Optional[str]:

    if not value:
        return None

    return hmac.new(
        _secret().encode("utf-8"),
        value.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def _create_access_token(user_id: int, session_id: int) -> str:

    now = _now()

    payload = {
        "sub": str(user_id),
        "sid": int(session_id),
        "iat": now,
        "exp": now + timedelta(minutes=ACCESS_TOKEN_MINUTES),
        "jti": secrets.token_urlsafe(18),
    }

    return jwt.encode(
        payload,
        _secret(),
        algorithm=settings.ALGORITHM,
    )


def _token_bundle(
    user: User,
    auth_session: AuthSession,
    refresh_token: str,
) -> dict:

    return {
        "access_token": _create_access_token(
            user.id,
            auth_session.id,
        ),
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_MINUTES * 60,
        "session_id": auth_session.id,
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "preferred_language": user.preferred_language,
        },
    }


def create_session(
    db: Session,
    user: User,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> dict:

    if user is None or not user.is_active:
        raise AuthSessionError("Active user account required.")

    refresh_token = secrets.token_urlsafe(48)
    now = _now()

    auth_session = AuthSession(
        user_id=user.id,
        refresh_token_hash=_hash_refresh_token(refresh_token),
        expires_at=now + timedelta(days=REFRESH_TOKEN_DAYS),
        ip_hash=_fingerprint(ip_address),
        user_agent_hash=_fingerprint(user_agent),
    )

    db.add(auth_session)
    db.flush()

    return _token_bundle(
        user,
        auth_session,
        refresh_token,
    )


def resolve_access_token(
    db: Session,
    access_token: str,
) -> tuple[User, AuthSession]:

    try:

        payload = jwt.decode(
            access_token,
            _secret(),
            algorithms=[settings.ALGORITHM],
        )

        user_id = int(payload["sub"])
        session_id = int(payload["sid"])

    except (JWTError, KeyError, TypeError, ValueError):

        raise AuthSessionError("Invalid or expired access token.")

    now = _now()

    auth_session = (
        db.query(AuthSession)
        .filter(
            AuthSession.id == session_id,
            AuthSession.user_id == user_id,
            AuthSession.revoked_at.is_(None),
            AuthSession.expires_at > now,
        )
        .one_or_none()
    )

    if auth_session is None:
        raise AuthSessionError("Authentication session is inactive.")

    user = (
        db.query(User)
        .filter(
            User.id == user_id,
            User.is_active.is_(True),
        )
        .one_or_none()
    )

    if user is None:
        raise AuthSessionError("User account is inactive.")

    return user, auth_session


def rotate_refresh_token(
    db: Session,
    refresh_token: str,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> dict:

    token_hash = _hash_refresh_token(refresh_token)
    now = _now()

    old_session = (
        db.query(AuthSession)
        .filter(
            AuthSession.refresh_token_hash == token_hash,
        )
        .with_for_update()
        .one_or_none()
    )

    if old_session is None:
        raise AuthSessionError("Refresh token is invalid.")

    if old_session.revoked_at is not None:
        raise AuthSessionError("Refresh token has already been used or revoked.")

    if old_session.expires_at <= now:
        raise AuthSessionError("Refresh token has expired.")

    user = (
        db.query(User)
        .filter(
            User.id == old_session.user_id,
            User.is_active.is_(True),
        )
        .one_or_none()
    )

    if user is None:
        raise AuthSessionError("User account is inactive.")

    old_session.revoked_at = now
    old_session.last_used_at = now
    old_session.revoke_reason = "token_rotated"

    # New session and old-session revocation are committed together
    # by the caller. Both changes are in the same transaction.
    return create_session(
        db,
        user,
        ip_address=ip_address,
        user_agent=user_agent,
    )


def revoke_session(
    db: Session,
    auth_session: AuthSession,
    reason: str = "logout",
) -> bool:

    if auth_session is None:
        return False

    if auth_session.revoked_at is not None:
        return False

    auth_session.revoked_at = _now()
    auth_session.revoke_reason = reason[:80]

    db.flush()

    return True


def revoke_all_sessions(
    db: Session,
    user_id: int,
    except_session_id: Optional[int] = None,
    reason: str = "logout_all",
) -> int:

    query = db.query(AuthSession).filter(
        AuthSession.user_id == user_id,
        AuthSession.revoked_at.is_(None),
    )

    if except_session_id is not None:
        query = query.filter(
            AuthSession.id != except_session_id
        )

    sessions = query.with_for_update().all()

    now = _now()

    for auth_session in sessions:
        auth_session.revoked_at = now
        auth_session.revoke_reason = reason[:80]

    db.flush()

    return len(sessions)
