from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func

from app.database import Base


class EmiAttachment(Base):
    __tablename__ = "emi_attachments"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    emi_id = Column(Integer, ForeignKey("emi_details.id"), nullable=False)
    cycle = Column(String, nullable=False)          # e.g. "Feb 2026"
    transaction_id = Column(Integer, ForeignKey("transactions.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now())
