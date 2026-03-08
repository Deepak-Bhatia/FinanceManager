from app.parsers.pdf_parser import detect_and_parse
from pathlib import Path
p = Path(r'D:/GIT gmail/FinanceManager/input/2026-02/SBI.pdf')
print('Parsing', p)
res = detect_and_parse(str(p))
print('Transactions parsed:', len(res.transactions))
for t in res.transactions:
    print(t)
print('\nEMI details parsed:', len(res.emi_details))
for e in res.emi_details:
    print(e)
