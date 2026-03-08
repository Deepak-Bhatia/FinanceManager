from sqlalchemy import Column, Integer, String, ForeignKey

from app.database import Base


class CategorizationRule(Base):
    __tablename__ = "categorization_rules"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    keyword = Column(String, nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    priority = Column(Integer, default=0)
