from sqlalchemy import create_engine
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
    from app.models.category import Category  # noqa: F401
    from app.models.account import Account  # noqa: F401
    from app.models.categorization_rule import CategorizationRule  # noqa: F401
    from app.models.ingestion_log import IngestionLog  # noqa: F401
    from app.models.emi_detail import EmiDetail  # noqa: F401

    Base.metadata.create_all(bind=engine)
