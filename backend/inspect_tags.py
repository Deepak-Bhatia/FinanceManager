from app.database import SessionLocal
from app.models.transaction import Transaction


def main():
    db = SessionLocal()
    txns = db.query(Transaction).limit(10).all()
    for t in txns:
        tags = t.metadata_record.tags if t.metadata_record else None
        print(f"{t.id}\t{t.description[:60]}\t{tags}")

if __name__ == '__main__':
    main()
