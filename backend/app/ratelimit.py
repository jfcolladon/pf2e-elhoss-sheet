"""Limites por IP. Un proceso (uvicorn sin workers extra); memoria acotada.

Caddy debe mandar X-Real-IP con la IP real del cliente (no confiar en X-Forwarded-For).
"""
from __future__ import annotations

import time
from threading import Lock

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

# Login / HTTP Basic: frena brute-force. 8 intentos cada 10 min por IP.
LOGIN_BURST = 8
LOGIN_WINDOW_S = 600.0

# Sin sesion (SPA, health, 401): frena bajar el JS en bucle y quemar salida.
ANON_BURST = 60
ANON_WINDOW_S = 60.0

# Con Bearer: autosave (~50/min) + catalogo. Dos usuarios en el mismo NAT entran.
AUTH_BURST = 300
AUTH_WINDOW_S = 60.0

_MAX_KEYS = 4000


def _looks_ip(value: str) -> bool:
    if not value or len(value) > 45 or " " in value:
        return False
    if value.count(".") == 3:
        return all(p.isdigit() and 0 <= int(p) <= 255 for p in value.split("."))
    return ":" in value


def client_ip(request: Request) -> str:
    real = (request.headers.get("x-real-ip") or "").strip()
    if real:
        real = real.split(",")[0].strip()
        if _looks_ip(real):
            return real
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


class _Bucket:
    __slots__ = ("tokens", "updated")

    def __init__(self, burst: float, now: float):
        self.tokens = burst
        self.updated = now


class _Limiter:
    def __init__(self) -> None:
        self._lock = Lock()
        self._login: dict[str, _Bucket] = {}
        self._anon: dict[str, _Bucket] = {}
        self._auth: dict[str, _Bucket] = {}

    def _take(self, store: dict[str, _Bucket], key: str, burst: float, window: float, now: float) -> bool:
        rate = burst / window
        b = store.get(key)
        if b is None:
            if len(store) >= _MAX_KEYS:
                oldest = min(store, key=lambda k: store[k].updated)
                del store[oldest]
            b = _Bucket(burst, now)
            store[key] = b
        elapsed = max(0.0, now - b.updated)
        b.tokens = min(burst, b.tokens + elapsed * rate)
        b.updated = now
        if b.tokens < 1.0:
            return False
        b.tokens -= 1.0
        return True

    def allow(self, ip: str, login: bool, authed: bool) -> tuple[bool, str]:
        now = time.monotonic()
        with self._lock:
            if login and not self._take(self._login, ip, LOGIN_BURST, LOGIN_WINDOW_S, now):
                return False, "login"
            store = self._auth if authed else self._anon
            burst, window = (AUTH_BURST, AUTH_WINDOW_S) if authed else (ANON_BURST, ANON_WINDOW_S)
            if not self._take(store, ip, burst, window, now):
                return False, "auth" if authed else "anon"
        return True, ""


_limiter = _Limiter()


def _too_many(kind: str) -> Response:
    if kind == "login":
        msg = "Demasiados intentos de acceso. Esperá unos minutos."
        retry = "60"
    else:
        msg = "Demasiadas peticiones. Esperá un minuto."
        retry = "30"
    return JSONResponse(
        {"detail": msg},
        status_code=429,
        headers={"Retry-After": retry},
    )


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method == "OPTIONS":
            return await call_next(request)
        path = request.url.path
        header = (request.headers.get("authorization") or "").lower()
        login = request.method == "POST" and path == "/api/v1/auth/login"
        authed = header.startswith("bearer ") or header.startswith("basic ")
        ok, kind = _limiter.allow(client_ip(request), login=login, authed=authed)
        if not ok:
            return _too_many(kind)
        return await call_next(request)
