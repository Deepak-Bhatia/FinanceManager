from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.config import DATABASE_URL


engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    from app.models.transaction import Transaction  # noqa: F401
    from app.models.transaction_metadata import TransactionMetadata  # noqa: F401
    from app.models.category import Category  # noqa: F401
    from app.models.account import Account  # noqa: F401
    from app.models.categorization_rule import CategorizationRule  # noqa: F401
    from app.models.ingestion_log import IngestionLog  # noqa: F401
    from app.models.emi_detail import EmiDetail  # noqa: F401
    from app.models.emi_attachment import EmiAttachment  # noqa: F401
    from app.models.audit_log import AuditLog  # noqa: F401

    Base.metadata.create_all(bind=engine)

    # Column migrations for existing DBs
    with engine.connect() as conn:
        for ddl in [
            "ALTER TABLE accounts ADD COLUMN glyph TEXT",
            "ALTER TABLE accounts ADD COLUMN nickname TEXT",
            "ALTER TABLE transaction_metadata ADD COLUMN tags_meta TEXT",
        ]:
            try:
                conn.execute(text(ddl))
                conn.commit()
            except Exception:
                pass  # column already exists

    # Data migration: backfill tags_meta as "manual" for all rows that have tags but no tags_meta
    import json as _json
    with engine.connect() as conn:
        rows = conn.execute(text(
            "SELECT id, tags FROM transaction_metadata WHERE tags IS NOT NULL AND tags != '' AND (tags_meta IS NULL OR tags_meta = '')"
        )).fetchall()
        for row in rows:
            tag_list = [t.strip() for t in row[1].split(',') if t.strip()]
            meta = _json.dumps([{"name": t, "type": "manual"} for t in tag_list])
            conn.execute(
                text("UPDATE transaction_metadata SET tags_meta = :meta WHERE id = :id"),
                {"meta": meta, "id": row[0]},
            )
        conn.commit()
