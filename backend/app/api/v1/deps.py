"""
Shared API dependencies for DermaSathiAI.

Provides the session-aware authentication dependency used across all
protected endpoints. This ensures every authenticated request validates
the underlying session (active, not revoked, not expired) rather than
just decoding the JWT payload.
"""

from fastapi import Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.v1.endpoints.auth_session_endpoints import (
    get_current_user as _session_get_current_user,
)

__all__ = ["get_current_user", "get_db"]

get_current_user = _session_get_current_user
