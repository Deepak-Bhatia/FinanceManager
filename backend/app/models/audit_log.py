from sqlalchemy import Column, Integer, String, DateTime, Text
from sqlalchemy.sql import func

from app.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    event_type = Column(String, nullable=False)  # "parse", "category_change", "type_change", "delete"
    summary = Column(String, nullable=False)
    details = Column(Text, nullable=True)  # JSON string for extra info
    created_at = Column(DateTime, server_default=func.now())
