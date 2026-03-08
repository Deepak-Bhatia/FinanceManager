from sqlalchemy import Column, Integer, String

from app.database import Base


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String, unique=True, nullable=False)
    color = Column(String, nullable=True)
    icon = Column(String, nullable=True)


DEFAULT_CATEGORIES = [
    {"name": "Food & Dining", "color": "#FF6384", "icon": "🍽️"},
    {"name": "Groceries", "color": "#36A2EB", "icon": "🛒"},
    {"name": "Transport", "color": "#D97706", "icon": "🚗"},
    {"name": "Utilities", "color": "#0891B2", "icon": "⚡"},
    {"name": "Rent", "color": "#9966FF", "icon": "🏠"},
    {"name": "Entertainment", "color": "#FF9F40", "icon": "🎬"},
    {"name": "Shopping", "color": "#8B5CF6", "icon": "🛍️"},
    {"name": "Health", "color": "#059669", "icon": "💊"},
    {"name": "Education", "color": "#7BC8A4", "icon": "📚"},
    {"name": "Subscriptions", "color": "#F67019", "icon": "🔄"},
    {"name": "Transfer", "color": "#65A30D", "icon": "🔁"},
    {"name": "ATM Withdrawal", "color": "#166A8F", "icon": "🏧"},
    {"name": "EMI", "color": "#8549BA", "icon": "📋"},
    {"name": "Fuel", "color": "#58595B", "icon": "⛽"},
    {"name": "Cashback", "color": "#00A950", "icon": "💰"},
    {"name": "Payment", "color": "#2563EB", "icon": "💳"},
    {"name": "Fees & Charges", "color": "#F53794", "icon": "📑"},
    {"name": "Tax", "color": "#537BC4", "icon": "🏛️"},
    {"name": "Other", "color": "#6B7280", "icon": "📌"},
]
