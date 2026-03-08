from app.database import SessionLocal
from app.models.transaction import Transaction, compute_transaction_hash
from app.models.transaction_metadata import TransactionMetadata


def main():
    db = SessionLocal()
    try:
        txns = db.query(Transaction).filter(Transaction.transaction_hash == None).all()
        print('Found', len(txns), 'transactions without transaction_hash')
        for t in txns:
            try:
                th = compute_transaction_hash(t.date, t.description, t.amount)
                t.transaction_hash = th
                # ensure metadata row exists
                meta = db.query(TransactionMetadata).filter(TransactionMetadata.transaction_hash == th).first()
                if not meta:
                    meta = TransactionMetadata(transaction_hash=th, category_id=None, tags=None)
                    db.add(meta)
            except Exception as e:
                print('Error for txn', t.id, e)
        db.commit()
        print('Backfill complete')
    finally:
        db.close()

if __name__ == '__main__':
    main()
