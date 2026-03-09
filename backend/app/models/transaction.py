from sqlalchemy import Column, Integer, String, Float, Date, DateTime, Boolean, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import hashlib

from app.database import Base


def compute_transaction_hash(txn_date: Date, description: str, amount: float) -> str:
    """Deterministic hash based on date, normalized description and amount."""
    desc = (description or "").strip().upper()
    # collapse whitespace
    desc = " ".join(desc.split())
    key = f"{txn_date.isoformat()}|{desc}|{amount:.2f}"
    return hashlib.sha256(key.encode("utf-8")).hexdigest()


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    transaction_hash = Column(String, nullable=False, unique=True, index=True)
    date = Column(Date, nullable=False)
    description = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    type = Column(String, nullable=False)  # "debit" or "credit"
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)
    source = Column(String, nullable=False)  # "credit_card_pdf", "bank_excel", "manual"
    source_file = Column(String, nullable=True)
    cycle = Column(String, nullable=True)  # billing cycle folder e.g. "2026-02"
    month = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)
    is_recurring = Column(Boolean, default=False)
    notes = Column(String, nullable=True)
    custom_description = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    # relationship to metadata (one-to-one)
    metadata_record = relationship("TransactionMetadata", primaryjoin="Transaction.transaction_hash==foreign(TransactionMetadata.transaction_hash)", uselist=False, back_populates="transaction", lazy="joined")

# Ensure the TransactionMetadata module is imported so SQLAlchemy can resolve
# the relationship when mappers are configured in contexts where imports
# occur in different orders (e.g., scripts that import models directly).
try:
    from app.models import transaction_metadata  # noqa: F401
except Exception:
    # Import errors here are safe to ignore at module import time; mapper
    # resolution will occur during SQLAlchemy configuration when possible.
    pass
