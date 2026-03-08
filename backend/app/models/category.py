from sqlalchemy import Column, Integer, String

from app.database import Base


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String, unique=True, nullable=False)
    color = Column(String, nullable=True)
    icon = Column(String, nullable=True)


DEFAULT_CATEGORIES = [
    {"name": "Food & Dining", "color": "#FF6384"},
    {"name": "Groceries", "color": "#36A2EB"},
    {"name": "Transport", "color": "#FFCE56"},
    {"name": "Utilities", "color": "#4BC0C0"},
    {"name": "Rent", "color": "#9966FF"},
    {"name": "Entertainment", "color": "#FF9F40"},
    {"name": "Shopping", "color": "#E7E9ED"},
    {"name": "Health", "color": "#C9CBCF"},
    {"name": "Education", "color": "#7BC8A4"},
    {"name": "Subscriptions", "color": "#F67019"},
    {"name": "Transfer", "color": "#ACC236"},
    {"name": "ATM Withdrawal", "color": "#166A8F"},
    {"name": "EMI", "color": "#8549BA"},
    {"name": "Fuel", "color": "#58595B"},
    {"name": "Cashback", "color": "#00A950"},
    {"name": "Payment", "color": "#4DC9F6"},
    {"name": "Fees & Charges", "color": "#F53794"},
    {"name": "Tax", "color": "#537BC4"},
    {"name": "Other", "color": "#999999"},
]
