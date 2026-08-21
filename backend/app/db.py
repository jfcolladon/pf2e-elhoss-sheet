import os
import sqlite3

DB_PATH = os.environ.get("DB_PATH", os.path.join(os.path.dirname(__file__), "..", "..", "data", "app.db"))


def get_conn() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(os.path.abspath(DB_PATH)), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


SCHEMA = """
CREATE TABLE IF NOT EXISTS srd_items (
    uid TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    name_lower TEXT NOT NULL,
    level INTEGER,
    source TEXT,
    allowed INTEGER NOT NULL DEFAULT 0,
    rarity TEXT,
    category TEXT,
    traits TEXT,
    summary TEXT,
    data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_srd_type ON srd_items(type);
CREATE INDEX IF NOT EXISTS idx_srd_name ON srd_items(name_lower);
CREATE INDEX IF NOT EXISTS idx_srd_allowed ON srd_items(allowed);

CREATE TABLE IF NOT EXISTS psionic_powers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    name_lower TEXT NOT NULL,
    discipline TEXT NOT NULL,
    rank INTEGER NOT NULL,
    tier TEXT,
    cost_raw TEXT,
    cost INTEGER,
    actions TEXT,
    range TEXT,
    area TEXT,
    duration TEXT,
    save TEXT,
    trigger TEXT,
    traits TEXT,
    description TEXT,
    heightened TEXT
);
CREATE INDEX IF NOT EXISTS idx_pp_disc ON psionic_powers(discipline, rank);

CREATE TABLE IF NOT EXISTS wild_talent_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rank INTEGER NOT NULL,
    name TEXT NOT NULL,
    tier TEXT,
    cost INTEGER,
    prob_min INTEGER,
    prob_max INTEGER
);

CREATE TABLE IF NOT EXISTS house_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    data TEXT
);

CREATE TABLE IF NOT EXISTS characters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    user_id INTEGER
);

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    is_legacy INTEGER NOT NULL DEFAULT 0,
    email_verified INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS otp_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    purpose TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at TEXT NOT NULL
);
"""


def init_db(conn: sqlite3.Connection | None = None):
    own = conn is None
    if own:
        conn = get_conn()
    conn.executescript(SCHEMA)
    cols = {r[1] for r in conn.execute("PRAGMA table_info(characters)").fetchall()}
    if "user_id" not in cols:
        conn.execute("ALTER TABLE characters ADD COLUMN user_id INTEGER")
    conn.commit()
    if own:
        conn.close()
