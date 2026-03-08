from sqlalchemy import Column, Integer, String, Float, Date, DateTime, Boolean, ForeignKey
from sqlalchemy.sql import func

from app.database import Base


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    date = Column(Date, nullable=False)
    description = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    type = Column(String, nullable=False)  # "debit" or "credit"
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)
    source = Column(String, nullable=False)  # "credit_card_pdf", "bank_excel", "manual"
    source_file = Column(String, nullable=True)
    cycle = Column(String, nullable=True)  # billing cycle folder e.g. "2026-02"
    month = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)
    is_recurring = Column(Boolean, default=False)
    tags = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
