import sqlite3
import os
import hashlib
from datetime import date

DB = os.path.abspath(os.path.join(os.path.dirname(os.path.dirname(__file__)), '..', 'data', 'finance.db'))
print('DB path:', DB)
if not os.path.exists(DB):
    print('DB not found')
    exit(1)
conn = sqlite3.connect(DB)
cur = conn.cursor()
rows = cur.execute("SELECT id, date, description, amount FROM transactions WHERE transaction_hash IS NULL").fetchall()
print('rows to update:', len(rows))
for rid, rdate, desc, amount in rows:
    try:
        # date stored as YYYY-MM-DD string
        key = f"{rdate}|{(desc or '').strip().upper()}|{float(amount):.2f}"
        th = hashlib.sha256(key.encode('utf-8')).hexdigest()
        cur.execute("UPDATE transactions SET transaction_hash = ? WHERE id = ?", (th, rid))
        # ensure metadata
        meta = cur.execute("SELECT id FROM transaction_metadata WHERE transaction_hash = ?", (th,)).fetchone()
        if not meta:
            cur.execute("INSERT INTO transaction_metadata (transaction_hash, category_id, tags, updated_at) VALUES (?, ?, ?, datetime('now'))", (th, None, None))
    except Exception as e:
        print('error', rid, e)
conn.commit()
conn.close()
print('done')
