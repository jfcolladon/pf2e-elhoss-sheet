"""Crear o actualizar un usuario. Uso: python etl/create_user.py USERNAME PASSWORD [user|admin]"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db import init_db
from app.users import upsert_user


def main() -> int:
    if len(sys.argv) < 3:
        print("Uso: python etl/create_user.py USERNAME PASSWORD [user|admin]", file=sys.stderr)
        return 2
    username, password = sys.argv[1], sys.argv[2]
    role = sys.argv[3] if len(sys.argv) > 3 else "user"
    init_db()
    row = upsert_user(username, password, role)
    print(f"ok {row['username']} role={row.get('role')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
