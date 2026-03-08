from app.database import SessionLocal
from app.models.ingestion_log import IngestionLog

if __name__ == '__main__':
    db = SessionLocal()
    logs = db.query(IngestionLog).order_by(IngestionLog.id.desc()).limit(20).all()
    for lg in logs:
        msg = lg.message or ''
        print(f"{lg.id}\t{lg.file_name}\t{lg.status}\t{msg[:1000]}")
