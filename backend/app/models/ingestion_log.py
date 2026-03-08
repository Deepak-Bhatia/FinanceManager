from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.sql import func

from app.database import Base


class IngestionLog(Base):
    __tablename__ = "ingestion_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    folder_name = Column(String, nullable=False)
    file_name = Column(String, nullable=False)
    status = Column(String, nullable=False)  # "success", "error", "skipped"
    message = Column(String, nullable=True)
    transactions_added = Column(Integer, default=0)
    ingested_at = Column(DateTime, server_default=func.now())
