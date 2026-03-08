from app.config import DATA_DIR
from app.database import engine
from sqlalchemy import text
import shutil
import datetime
from pathlib import Path

DB_FILE = DATA_DIR / 'finance.db'
if not DB_FILE.exists():
    print(f"DB file not found: {DB_FILE}")
    raise SystemExit(1)

backup_name = DB_FILE.with_name(f"finance.db.bak.{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}")
shutil.copy2(DB_FILE, backup_name)
print(f"Backup created: {backup_name}")

with engine.begin() as conn:
    conn.execute(text("DELETE FROM transactions"))
    try:
        conn.execute(text("DELETE FROM sqlite_sequence WHERE name='transactions'"))
    except Exception:
        # sqlite_sequence may not exist or DB not sqlite
        pass

print("All rows deleted from 'transactions' table.")
print("Done.")
