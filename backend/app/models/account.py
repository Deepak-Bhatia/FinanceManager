from sqlalchemy import Column, Integer, String

from app.database import Base


class Account(Base):
    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String, unique=True, nullable=False)
    type = Column(String, nullable=False)  # "savings", "current", "credit_card"
    bank = Column(String, nullable=False)
