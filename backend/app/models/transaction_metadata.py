from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.database import Base


class TransactionMetadata(Base):
    __tablename__ = "transaction_metadata"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    transaction_hash = Column(String, nullable=False, unique=True, index=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    tags = Column(String, nullable=True)
    tags_meta = Column(Text, nullable=True)  # JSON: [{"name": "food", "type": "manual"|"auto"}]
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # backref to transaction
    transaction = relationship("Transaction", primaryjoin="foreign(TransactionMetadata.transaction_hash)==Transaction.transaction_hash", back_populates="metadata_record")

