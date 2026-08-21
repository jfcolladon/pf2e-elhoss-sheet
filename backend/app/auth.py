"""Auth opcional. Local: sin AUTH_PASSWORD, abierto.

Produccion:
- AUTH_PASSWORD: HTTP Basic del usuario legado (elhoss).
- AUTH_MULTI=1: cuentas user/admin y sesiones Bearer. Sin registro publico.
"""
from __future__ import annotations

import base64
import hmac
import os

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

AUTH_USER = os.environ.get("AUTH_USER", "elhoss").strip() or "elhoss"
AUTH_PASSWORD = os.environ.get("AUTH_PASSWORD", "").strip()
AUTH_MULTI = os.environ.get("AUTH_MULTI", "").strip() in {"1", "true", "yes"}

OPEN_PATHS = frozenset({
    "/api/v1/health",
    "/api/v1/auth/login",
})


def auth_required() -> bool:
    return bool(AUTH_PASSWORD)


def _is_open(path: str) -> bool:
    if path in OPEN_PATHS:
        return True
    # Con cuentas nuevas, la SPA y sus assets deben cargar sin el popup nativo del navegador.
    if AUTH_MULTI and not path.startswith("/api/"):
        return True
    return False


def _unauthorized() -> Response:
    headers = {}
    # WWW-Authenticate: Basic hace que el navegador muestre su propio dialogo
    # y tape el formulario "Crear cuenta". Solo se usa si no hay multi-tenant.
    if not AUTH_MULTI:
        headers["WWW-Authenticate"] = 'Basic realm="Elhoss", charset="UTF-8"'
    return Response(
        "Se requiere autenticacion",
        status_code=401,
        headers=headers,
        media_type="text/plain; charset=utf-8",
    )


def _credentials_ok(user: str, password: str) -> bool:
    user_ok = hmac.compare_digest(user, AUTH_USER)
    pass_ok = hmac.compare_digest(password, AUTH_PASSWORD)
    return user_ok and pass_ok


class BasicAuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request.state.user = None
        if not AUTH_PASSWORD:
            return await call_next(request)
        if request.method == "OPTIONS":
            return await call_next(request)
        if _is_open(request.url.path):
            return await call_next(request)

        header = request.headers.get("authorization") or ""
        if header.lower().startswith("bearer ") and AUTH_MULTI:
            token = header.split(" ", 1)[1].strip()
            from .users import user_from_token
            user = user_from_token(token)
            if user and user.get("email_verified"):
                request.state.user = user
                return await call_next(request)
            return _unauthorized()

        if header.lower().startswith("basic "):
            try:
                raw = base64.b64decode(header.split(" ", 1)[1].strip()).decode("utf-8")
                user, sep, password = raw.partition(":")
            except Exception:
                user, sep, password = "", "", ""
            if sep and _credentials_ok(user, password):
                if AUTH_MULTI:
                    from .users import get_user_by_username
                    request.state.user = get_user_by_username(AUTH_USER)
                return await call_next(request)
            if AUTH_MULTI and sep:
                from .users import get_user_by_username, verify_password
                row = get_user_by_username(user)
                if row and row.get("email_verified") and verify_password(password, row["password_hash"]):
                    request.state.user = row
                    return await call_next(request)
        return _unauthorized()
