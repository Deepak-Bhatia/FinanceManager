import sqlite3
import os

DB = os.path.join(os.path.dirname(os.path.dirname(__file__)), '..', 'data', 'finance.db')
DB = os.path.abspath(DB)
print('DB path:', DB)
if not os.path.exists(DB):
    print('DB file not found, nothing to do')
    exit(0)

conn = sqlite3.connect(DB)
cur = conn.cursor()
# Check if transactions.transaction_hash exists
cols = [r[1] for r in cur.execute("PRAGMA table_info('transactions')").fetchall()]
print('transactions columns:', cols)
if 'transaction_hash' not in cols:
    print('Adding transaction_hash column')
    cur.execute("ALTER TABLE transactions ADD COLUMN transaction_hash TEXT")
else:
    print('transaction_hash column already present')

# Create transaction_metadata table if missing
tables = [r[0] for r in cur.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
print('tables:', tables)
if 'transaction_metadata' not in tables:
    print('Creating transaction_metadata table')
    cur.execute('''
    CREATE TABLE transaction_metadata (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_hash TEXT NOT NULL UNIQUE,
        category_id INTEGER,
        tags TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME
    )
    ''')
else:
    print('transaction_metadata table already exists')

conn.commit()
conn.close()
print('Done')
