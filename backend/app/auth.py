"""HTTP Basic Auth opcional. Si AUTH_PASSWORD está vacío, no se exige login (dev local)."""
from __future__ import annotations

import base64
import hmac
import os

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

AUTH_USER = os.environ.get("AUTH_USER", "elhoss").strip() or "elhoss"
AUTH_PASSWORD = os.environ.get("AUTH_PASSWORD", "").strip()
OPEN_PATHS = frozenset({"/api/v1/health"})


def auth_required() -> bool:
    return bool(AUTH_PASSWORD)


def _unauthorized() -> Response:
    return Response(
        "Se requiere autenticacion",
        status_code=401,
        headers={"WWW-Authenticate": 'Basic realm="Elhoss", charset="UTF-8"'},
        media_type="text/plain; charset=utf-8",
    )


def _credentials_ok(user: str, password: str) -> bool:
    user_ok = hmac.compare_digest(user, AUTH_USER)
    pass_ok = hmac.compare_digest(password, AUTH_PASSWORD)
    return user_ok and pass_ok


class BasicAuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if not AUTH_PASSWORD:
            return await call_next(request)
        if request.method == "OPTIONS":
            return await call_next(request)
        if request.url.path in OPEN_PATHS:
            return await call_next(request)
        header = request.headers.get("authorization") or ""
        if header.lower().startswith("basic "):
            try:
                raw = base64.b64decode(header.split(" ", 1)[1].strip()).decode("utf-8")
                user, sep, password = raw.partition(":")
                if sep and _credentials_ok(user, password):
                    return await call_next(request)
            except Exception:
                pass
        return _unauthorized()
