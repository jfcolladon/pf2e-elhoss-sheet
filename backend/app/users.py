"""Usuarios y sesiones. Solo activo si AUTH_MULTI=1 (produccion).

Roles: user (hoja propia) y admin (crear usuarios; hoja propia, nunca las ajenas).
Sin registro publico ni SMTP.
"""
from __future__ import annotations

import hashlib
import hmac
import os
import re
import secrets
from datetime import datetime, timedelta, timezone

from .db import get_conn

AUTH_MULTI = os.environ.get("AUTH_MULTI", "").strip() in {"1", "true", "yes"}
SESSION_DAYS = 30
PBKDF2_ROUNDS = 120_000
USERNAME_RE = re.compile(r"^[a-zA-Z0-9._-]{3,32}$")
ROLES = frozenset({"user", "admin"})


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


def hash_password(password: str, salt: str | None = None) -> str:
    salt = salt or secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), PBKDF2_ROUNDS)
    return f"{salt}${dk.hex()}"


def verify_password(password: str, stored: str) -> bool:
    if "$" not in stored:
        return False
    salt, _hex = stored.split("$", 1)
    return hmac.compare_digest(hash_password(password, salt), stored)


def user_role(user: dict | None) -> str:
    if not user:
        return "user"
    role = str(user.get("role") or "user").lower()
    return role if role in ROLES else "user"


def is_admin(user: dict | None) -> bool:
    return user_role(user) == "admin"


def ensure_users() -> None:
    """elhoss queda como usuario comun; hojas huerfanas pasan a elhoss."""
    if not AUTH_MULTI:
        return
    from .auth import AUTH_PASSWORD, AUTH_USER
    if not AUTH_PASSWORD:
        return
    conn = get_conn()
    row = conn.execute("SELECT id FROM users WHERE username=?", (AUTH_USER,)).fetchone()
    if not row:
        email = f"{AUTH_USER}@elhoss.local"
        conn.execute(
            "INSERT INTO users (email, username, password_hash, is_legacy, email_verified, role) "
            "VALUES (?,?,?,?,1,'user')",
            (email.lower(), AUTH_USER, hash_password(AUTH_PASSWORD), 0),
        )
    else:
        conn.execute(
            "UPDATE users SET is_legacy=0, role='user', email_verified=1, password_hash=? WHERE username=?",
            (hash_password(AUTH_PASSWORD), AUTH_USER),
        )
    conn.execute("UPDATE users SET is_legacy=0 WHERE is_legacy!=0")
    conn.execute(
        "UPDATE users SET role='user' WHERE role IS NULL OR role='' OR (username=? AND role!='user')",
        (AUTH_USER,),
    )
    owner = conn.execute("SELECT id FROM users WHERE username=?", (AUTH_USER,)).fetchone()
    if owner:
        conn.execute(
            "UPDATE characters SET user_id=? WHERE user_id IS NULL",
            (owner["id"],),
        )
    conn.commit()
    conn.close()


def get_user_by_username(username: str):
    conn = get_conn()
    row = conn.execute("SELECT * FROM users WHERE username=?", (username,)).fetchone()
    conn.close()
    return dict(row) if row else None


def get_user_by_email(email: str):
    conn = get_conn()
    row = conn.execute("SELECT * FROM users WHERE email=?", (email.lower().strip(),)).fetchone()
    conn.close()
    return dict(row) if row else None


def list_users() -> list[dict]:
    conn = get_conn()
    rows = conn.execute(
        "SELECT id, username, role, created_at FROM users ORDER BY username"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def create_player_user(username: str, password: str, role: str = "user") -> dict:
    username = username.strip()
    role = (role or "user").lower()
    if role not in ROLES:
        raise ValueError("Rol invalido")
    if not USERNAME_RE.match(username):
        raise ValueError("Usuario: 3-32 letras, numeros, punto, _ o -")
    if len(password) < 8:
        raise ValueError("La contraseña debe tener al menos 8 caracteres")
    email = f"{username.lower()}@players.elhoss.local"
    conn = get_conn()
    conn.execute(
        "INSERT INTO users (email, username, password_hash, is_legacy, email_verified, role) "
        "VALUES (?,?,?,?,1,?)",
        (email, username, hash_password(password), 0, role),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM users WHERE username=?", (username,)).fetchone()
    conn.close()
    return dict(row)


def upsert_user(username: str, password: str, role: str = "user") -> dict:
    existing = get_user_by_username(username)
    if not existing:
        return create_player_user(username, password, role)
    role = (role or "user").lower()
    if role not in ROLES:
        raise ValueError("Rol invalido")
    conn = get_conn()
    conn.execute(
        "UPDATE users SET password_hash=?, role=?, is_legacy=0, email_verified=1 WHERE username=?",
        (hash_password(password), role, username.strip()),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM users WHERE username=?", (username.strip(),)).fetchone()
    conn.close()
    return dict(row)


def create_session(user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    expires = _now() + timedelta(days=SESSION_DAYS)
    conn = get_conn()
    conn.execute(
        "INSERT INTO sessions (user_id, token, expires_at) VALUES (?,?,?)",
        (user_id, token, _iso(expires)),
    )
    conn.commit()
    conn.close()
    return token


def user_from_token(token: str):
    if not token:
        return None
    conn = get_conn()
    row = conn.execute(
        "SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>=?",
        (token, _iso(_now())),
    ).fetchone()
    conn.close()
    return dict(row) if row else None


# compat con imports previos
def ensure_legacy_user() -> None:
    ensure_users()
