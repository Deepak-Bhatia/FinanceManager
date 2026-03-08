import sqlite3
from pathlib import Path
p = Path(__file__).resolve().parent.parent / 'data' / 'finance.db'
print('DB path:', p)
if not p.exists():
    print('DB not found')
    raise SystemExit(1)
conn = sqlite3.connect(str(p))
c = conn.cursor()
q = """
SELECT id,date,description,amount,type,source,cycle,tags,account_id
FROM transactions
WHERE date='2026-02-25'
   OR description LIKE '%FP EMI%'
   OR amount BETWEEN 21575 AND 21576
ORDER BY date DESC
LIMIT 50
"""
rows = c.execute(q).fetchall()
if not rows:
    print('No matching rows found')
else:
    for r in rows:
        print(r)
conn.close()
