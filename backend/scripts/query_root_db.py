import sqlite3
from pathlib import Path
p = Path(r'D:/GIT gmail/FinanceManager/data/finance.db')
print('DB path:', p)
if not p.exists():
    print('DB not found at', p)
    raise SystemExit(1)
conn = sqlite3.connect(str(p))
c = conn.cursor()
q = """
SELECT id,date,description,amount,type,source,cycle,tags,account_id
FROM transactions
WHERE date='2026-02-25'
    OR description LIKE '%EMI%'
    OR amount > 20000
ORDER BY date DESC
LIMIT 200
"""

print('\nNow searching for amounts between 21500 and 21600:')
q2 = """
SELECT id,date,description,amount,type,source,cycle,tags,account_id
FROM transactions
WHERE amount BETWEEN 21500 AND 21600
ORDER BY date DESC
LIMIT 50
"""
rows2 = c.execute(q2).fetchall()
if not rows2:
    print('No rows in 21500-21600 range')
else:
    for r in rows2:
        print(r)

print('\nSearch descriptions containing "SBI" or "FP EMI":')
q3 = """
SELECT id,date,description,amount,type,source,cycle,tags,account_id
FROM transactions
WHERE description LIKE '%SBI%'
   OR description LIKE '%FP EMI%'
   OR description LIKE '%EMI 01/%'
ORDER BY date DESC
LIMIT 200
"""
rows3 = c.execute(q3).fetchall()
if not rows3:
    print('No rows matching SBI/FP EMI patterns')
else:
    for r in rows3:
        print(r)

print('\nListing accounts with "SBI" in name:')
acc_q = """
SELECT id,name,bank,type
FROM accounts
WHERE name LIKE '%SBI%'
LIMIT 20
"""
accs = c.execute(acc_q).fetchall()
if not accs:
    print('No SBI accounts')
else:
    for a in accs:
        print(a)

print('\nTransactions with source_file = "SBI.pdf":')
q4 = """
SELECT id,date,description,amount,type,source,cycle,tags,account_id,source_file
FROM transactions
WHERE source_file = 'SBI.pdf'
ORDER BY date DESC
LIMIT 200
"""
rows4 = c.execute(q4).fetchall()
if not rows4:
    print('No transactions with source_file SBI.pdf')
else:
    for r in rows4:
        print(r)
rows = c.execute(q).fetchall()
if not rows:
    print('No matching rows found')
else:
    for r in rows:
        print(r)
conn.close()
