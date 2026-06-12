"""Refresca las tablas de catalogo (SRD + house rules) en la base de /data
desde el seed del build, preservando la tabla de personajes."""
import os
import sqlite3

SEED = os.environ.get("SEED_DB", "/seed/app.db")
LIVE = os.environ.get("DB_PATH", "/data/app.db")
TABLES = ("srd_items", "psionic_powers", "wild_talent_entries", "house_rules")


def main():
    src = sqlite3.connect(SEED)
    dst = sqlite3.connect(LIVE)
    for t in TABLES:
        dst.execute(f"DROP TABLE IF EXISTS {t}")
    dst.commit()
    sql = "\n".join(
        line for line in src.iterdump()
        if any(t in line for t in TABLES)
    )
    dst.executescript(sql)
    dst.commit()
    for t in TABLES:
        n = dst.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
        print(f"{t}: {n}")
    print("class-option:", dst.execute("SELECT COUNT(*) FROM srd_items WHERE type='class-option'").fetchone()[0])
    src.close()
    dst.close()


if __name__ == "__main__":
    main()
