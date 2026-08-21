"""Usuarios, OTP por email y sesiones. Solo activo si AUTH_MULTI=1 (produccion)."""
from __future__ import annotations

import hashlib
import hmac
import os
import secrets
import smtplib
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage

from .db import get_conn

AUTH_MULTI = os.environ.get("AUTH_MULTI", "").strip() in {"1", "true", "yes"}
OTP_MINUTES = 15
SESSION_DAYS = 30
PBKDF2_ROUNDS = 120_000


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


def hash_otp(code: str) -> str:
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


def ensure_legacy_user() -> None:
    """Crea el usuario elhoss (login existente) si falta."""
    if not AUTH_MULTI:
        return
    from .auth import AUTH_PASSWORD, AUTH_USER
    if not AUTH_PASSWORD:
        return
    conn = get_conn()
    row = conn.execute("SELECT id FROM users WHERE username=?", (AUTH_USER,)).fetchone()
    if not row:
        email = os.environ.get("LEGACY_USER_EMAIL", f"{AUTH_USER}@elhoss.local")
        conn.execute(
            "INSERT INTO users (email, username, password_hash, is_legacy, email_verified) VALUES (?,?,?,?,1)",
            (email.lower(), AUTH_USER, hash_password(AUTH_PASSWORD), 1),
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


def get_user(user_id: int):
    conn = get_conn()
    row = conn.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def create_unverified_user(email: str, username: str, password: str) -> None:
    conn = get_conn()
    conn.execute(
        "INSERT INTO users (email, username, password_hash, is_legacy, email_verified) VALUES (?,?,?,?,0)",
        (email.lower().strip(), username.strip(), hash_password(password), 0),
    )
    conn.commit()
    conn.close()


def mark_verified(email: str) -> None:
    conn = get_conn()
    conn.execute("UPDATE users SET email_verified=1 WHERE email=?", (email.lower().strip(),))
    conn.commit()
    conn.close()


def store_otp(email: str, purpose: str) -> str:
    code = f"{secrets.randbelow(1_000_000):06d}"
    expires = _now() + timedelta(minutes=OTP_MINUTES)
    conn = get_conn()
    conn.execute("UPDATE otp_codes SET used=1 WHERE email=? AND purpose=? AND used=0", (email.lower(), purpose))
    conn.execute(
        "INSERT INTO otp_codes (email, code_hash, purpose, expires_at) VALUES (?,?,?,?)",
        (email.lower().strip(), hash_otp(code), purpose, _iso(expires)),
    )
    conn.commit()
    conn.close()
    return code


def consume_otp(email: str, code: str, purpose: str) -> bool:
    conn = get_conn()
    row = conn.execute(
        "SELECT id, code_hash, expires_at FROM otp_codes WHERE email=? AND purpose=? AND used=0 ORDER BY id DESC LIMIT 1",
        (email.lower().strip(), purpose),
    ).fetchone()
    if not row:
        conn.close()
        return False
    if row["expires_at"] < _iso(_now()):
        conn.close()
        return False
    if not hmac.compare_digest(row["code_hash"], hash_otp(code.strip())):
        conn.close()
        return False
    conn.execute("UPDATE otp_codes SET used=1 WHERE id=?", (row["id"],))
    conn.commit()
    conn.close()
    return True


def create_session(user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    expires = _now() + timedelta(days=SESSION_DAYS)
    conn = get_conn()
    conn.execute("INSERT INTO sessions (token, user_id, expires_at) VALUES (?,?,?)", (token, user_id, _iso(expires)))
    conn.commit()
    conn.close()
    return token


def user_from_token(token: str):
    conn = get_conn()
    row = conn.execute(
        "SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>=?",
        (token, _iso(_now())),
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def send_otp_email(to_email: str, code: str) -> None:
    host = os.environ.get("SMTP_HOST", "").strip()
    port = int(os.environ.get("SMTP_PORT", "587") or "587")
    user = os.environ.get("SMTP_USER", "").strip()
    password = os.environ.get("SMTP_PASSWORD", "").strip()
    sender = os.environ.get("SMTP_FROM", user or "noreply@elhoss.local").strip()
    if not host or not password:
        raise RuntimeError("SMTP no configurado (SMTP_HOST / SMTP_PASSWORD)")
    msg = EmailMessage()
    msg["Subject"] = "Codigo de verificacion — Elhoss"
    msg["From"] = sender
    msg["To"] = to_email
    msg.set_content(
        f"Tu codigo de verificacion es: {code}\n\n"
        f"Caduca en {OTP_MINUTES} minutos. Si no creaste una cuenta, ignora este mensaje.\n"
    )
    with smtplib.SMTP(host, port, timeout=30) as smtp:
        smtp.starttls()
        if user:
            smtp.login(user, password)
        smtp.send_message(msg)
