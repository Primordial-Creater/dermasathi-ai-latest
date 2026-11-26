from typing import Optional

from fastapi import (
    APIRouter, Depends, HTTPException,
    Request, Response, Cookie, status,
)
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.db.session import get_db
from app.core.config import settings
from app.core.security import get_password_hash

from app.models.user import User
from app.models.platform import AuthSession

from app.schemas.user import UserCreate, UserLogin, UserResponse, UserUpdate
from app.schemas.token import Token

from app.services.auth_service import AuthService

from app.services.auth_session_service import (
    AuthSessionError,
    create_session,
    resolve_access_token,
    rotate_refresh_token,
    revoke_session,
    revoke_all_sessions,
    REFRESH_TOKEN_DAYS,
    _fingerprint,
    _hash_refresh_token,
)

from app.services.persistence_service import record_activity_event

router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/login",
    auto_error=False,
)

REFRESH_COOKIE = "dermasathi_refresh"
COOKIE_PATH = "/api/v1/auth"


def _client_info(request):
    ip = request.client.host if request.client else None
    agent = request.headers.get("user-agent")
    return ip, agent


def _secure_cookie(request):
    environment = str(
        getattr(settings, "ENVIRONMENT", "development")
    ).lower()

    return (
        request.url.scheme == "https"
        or environment in {"production", "prod"}
    )


def _set_cookie(response, request, token):

    response.set_cookie(
        key=REFRESH_COOKIE,
        value=token,
        max_age=REFRESH_TOKEN_DAYS * 86400,
        httponly=True,
        secure=_secure_cookie(request),
        samesite="lax",
        path=COOKIE_PATH,
    )


def _clear_cookie(response, request):

    response.delete_cookie(
        key=REFRESH_COOKIE,
        path=COOKIE_PATH,
        httponly=True,
        secure=_secure_cookie(request),
        samesite="lax",
    )


def _record_event(
    db, request, code, outcome,
    user=None, session_id=None,
):

    ip, agent = _client_info(request)

    record_activity_event(
        db,
        event_code=code,
        actor_type="patient" if user else "anonymous",
        outcome=outcome,
        user_id=user.id if user else None,
        target_type="auth_session" if session_id else "authentication",
        target_id=str(session_id) if session_id else None,
        request_id=request.headers.get("x-request-id"),
        metadata={"event": code},
        ip_hash=_fingerprint(ip),
        user_agent_hash=_fingerprint(agent),
    )


def _auth_context(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):

    if not token:
        raise HTTPException(
            401,
            "Authentication required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        return resolve_access_token(db, token)
    except AuthSessionError:
        raise HTTPException(
            401,
            "Invalid or inactive authentication session.",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user(context=Depends(_auth_context)):
    return context[0]


def get_current_auth_session(context=Depends(_auth_context)):
    return context[1]


def _token_response(bundle):
    return {
        "access_token": bundle["access_token"],
        "token_type": "bearer",
        "user": bundle["user"],
    }


@router.post(
    "/register",
    response_model=Token,
    status_code=status.HTTP_201_CREATED,
)
def register(
    user_in: UserCreate,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):

    if len(user_in.password.encode("utf-8")) > 72:
        raise HTTPException(422, "Password is too long.")

    if AuthService.get_by_email(db, user_in.email):

        _record_event(
            db, request,
            "auth.registration_rejected",
            "failure",
        )
        db.commit()

        raise HTTPException(
            409,
            "Unable to register with the supplied email address.",
        )

    try:

        user = User(
            email=user_in.email.lower().strip(),
            hashed_password=get_password_hash(user_in.password),
            full_name=user_in.full_name.strip(),
            preferred_language=user_in.preferred_language or "en",
            role="patient",
            is_active=True,
        )

        db.add(user)
        db.flush()

        ip, agent = _client_info(request)

        bundle = create_session(
            db, user,
            ip_address=ip,
            user_agent=agent,
        )

        _record_event(
            db, request,
            "auth.registration_succeeded",
            "success",
            user=user,
            session_id=bundle["session_id"],
        )

        db.commit()
        db.refresh(user)

        _set_cookie(response, request, bundle["refresh_token"])

        return _token_response(bundle)

    except IntegrityError:

        db.rollback()
        raise HTTPException(409, "Unable to register.")

    except Exception:

        db.rollback()
        raise


@router.post("/login", response_model=Token)
def login(
    login_data: UserLogin,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):

    user = AuthService.authenticate(
        db, login_data.email, login_data.password
    )

    if not user:

        _record_event(
            db, request,
            "auth.login_failed",
            "failure",
        )
        db.commit()

        raise HTTPException(401, "Invalid email or password.")

    try:

        ip, agent = _client_info(request)

        bundle = create_session(
            db, user,
            ip_address=ip,
            user_agent=agent,
        )

        _record_event(
            db, request,
            "auth.login_succeeded",
            "success",
            user=user,
            session_id=bundle["session_id"],
        )

        db.commit()

        _set_cookie(response, request, bundle["refresh_token"])

        return _token_response(bundle)

    except Exception:

        db.rollback()
        raise


@router.post("/refresh", response_model=Token)
def refresh(
    request: Request,
    response: Response,
    refresh_token: Optional[str] = Cookie(
        default=None,
        alias=REFRESH_COOKIE,
    ),
    db: Session = Depends(get_db),
):

    if not refresh_token:

        _record_event(
            db, request,
            "auth.refresh_failed",
            "failure",
        )
        db.commit()

        raise HTTPException(401, "Refresh session unavailable.")

    try:

        ip, agent = _client_info(request)

        bundle = rotate_refresh_token(
            db, refresh_token,
            ip_address=ip,
            user_agent=agent,
        )

        user = AuthService.get_by_id(
            db, bundle["user"]["id"]
        )

        _record_event(
            db, request,
            "auth.token_refreshed",
            "success",
            user=user,
            session_id=bundle["session_id"],
        )

        db.commit()

        _set_cookie(response, request, bundle["refresh_token"])

        return _token_response(bundle)

    except AuthSessionError:

        db.rollback()

        _record_event(
            db, request,
            "auth.refresh_failed",
            "failure",
        )

        db.commit()
        _clear_cookie(response, request)

        raise HTTPException(
            401,
            "Refresh session is invalid or expired.",
        )

    except Exception:

        db.rollback()
        raise


@router.post("/logout")
def logout(
    request: Request,
    response: Response,
    token: Optional[str] = Depends(oauth2_scheme),
    refresh_token: Optional[str] = Cookie(
        default=None,
        alias=REFRESH_COOKIE,
    ),
    db: Session = Depends(get_db),
):

    user = None
    access_session = None
    cookie_session = None

    if token:
        try:
            user, access_session = resolve_access_token(db, token)
        except AuthSessionError:
            pass

    if refresh_token:
        try:
            token_hash = _hash_refresh_token(refresh_token)

            cookie_session = (
                db.query(AuthSession)
                .filter(AuthSession.refresh_token_hash == token_hash)
                .with_for_update()
                .one_or_none()
            )
        except AuthSessionError:
            pass

    if (
        access_session is not None
        and cookie_session is not None
        and access_session.id != cookie_session.id
    ):
        raise HTTPException(403, "Authentication session mismatch.")

    target = access_session or cookie_session

    if target is not None:

        if user is None:
            user = AuthService.get_by_id(db, target.user_id)

        revoke_session(db, target, reason="logout")

        _record_event(
            db, request,
            "auth.logout",
            "success",
            user=user,
            session_id=target.id,
        )

        db.commit()

    else:
        db.rollback()

    _clear_cookie(response, request)

    return {"success": True, "message": "Logged out."}


@router.post("/logout-all")
def logout_all(
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_user),
    current_session: AuthSession = Depends(get_current_auth_session),
    db: Session = Depends(get_db),
):

    _record_event(
        db, request,
        "auth.logout_all",
        "success",
        user=current_user,
        session_id=current_session.id,
    )

    revoked = revoke_all_sessions(
        db,
        current_user.id,
        reason="logout_all",
    )

    db.commit()
    _clear_cookie(response, request)

    return {"success": True, "revoked_sessions": revoked}


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=UserResponse)
def update_me(
    user_update: UserUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    try:

        if user_update.full_name is not None:
            current_user.full_name = user_update.full_name.strip()

        if user_update.preferred_language is not None:
            current_user.preferred_language = (
                user_update.preferred_language.strip()
            )

        _record_event(
            db, request,
            "auth.profile_updated",
            "success",
            user=current_user,
        )

        db.commit()
        db.refresh(current_user)

        return current_user

    except Exception:

        db.rollback()
        raise
