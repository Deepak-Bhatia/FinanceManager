"""
Categorization service — applies keyword rules to transactions.
"""
from sqlalchemy.orm import Session
from app.models.categorization_rule import CategorizationRule
from app.models.transaction import Transaction
from app.models.transaction_metadata import TransactionMetadata


DEFAULT_RULES = [
    # Food & Dining
    ("SWIGGY", "Food & Dining"),
    ("ZOMATO", "Food & Dining"),
    ("RESTAURANT", "Food & Dining"),
    ("DOMINOS", "Food & Dining"),
    ("MCDONALD", "Food & Dining"),
    ("KFC", "Food & Dining"),
    ("BURGER", "Food & Dining"),
    ("PIZZA", "Food & Dining"),
    ("CAFE", "Food & Dining"),
    ("DINING", "Food & Dining"),
    ("FOOD", "Food & Dining"),
    # Groceries
    ("GROCERY", "Groceries"),
    ("BIGBASKET", "Groceries"),
    ("BLINKIT", "Groceries"),
    ("ZEPTO", "Groceries"),
    ("DMART", "Groceries"),
    ("INSTAMART", "Groceries"),
    # Transport
    ("UBER", "Transport"),
    ("OLA", "Transport"),
    ("RAPIDO", "Transport"),
    ("IRCTC", "Transport"),
    ("METRO", "Transport"),
    # Shopping
    ("AMAZON", "Shopping"),
    ("FLIPKART", "Shopping"),
    ("MYNTRA", "Shopping"),
    ("MEESHO", "Shopping"),
    ("AJIO", "Shopping"),
    # Entertainment
    ("NETFLIX", "Subscriptions"),
    ("HOTSTAR", "Subscriptions"),
    ("SPOTIFY", "Subscriptions"),
    ("PRIME VIDEO", "Subscriptions"),
    ("YOUTUBE", "Subscriptions"),
    ("GOOGLEPLAY", "Subscriptions"),
    ("GOOGLECLOUD", "Subscriptions"),
    ("OPENAI", "Subscriptions"),
    # Utilities
    ("ELECTRICITY", "Utilities"),
    ("AIRTEL", "Utilities"),
    ("JIO", "Utilities"),
    ("BBPS", "Payment"),
    ("BROADBAND", "Utilities"),
    ("GAS", "Utilities"),
    ("WATER", "Utilities"),
    # Fuel
    ("FUEL", "Fuel"),
    ("PETROL", "Fuel"),
    ("PETROLEUM", "Fuel"),
    ("IOCL", "Fuel"),
    ("HPCL", "Fuel"),
    ("BPCL", "Fuel"),
    ("CONVENIENCE FEE ON FUEL", "Fuel"),
    # EMI
    ("EMI", "EMI"),
    ("INSTALLMENT", "EMI"),
    # Payments
    ("PAYMENT RECEIVED", "Payment"),
    ("CC PAYMENT", "Payment"),
    # Fees & Charges
    ("INTEREST", "Fees & Charges"),
    ("PROC FEE", "Fees & Charges"),
    ("FINANCE CHARGE", "Fees & Charges"),
    ("LATE FEE", "Fees & Charges"),
    ("ANNUAL FEE", "Fees & Charges"),
    # Tax
    ("IGST", "Tax"),
    ("SGST", "Tax"),
    ("CGST", "Tax"),
    ("GST", "Tax"),
    # Cashback
    ("CASHBACK", "Cashback"),
    ("REWARD", "Cashback"),
    ("REVERSAL", "Cashback"),
    ("MANUFACTURER CASHBACK", "Cashback"),
]


def seed_rules(db: Session):
    """Seed default categorization rules if none exist."""
    existing = db.query(CategorizationRule).count()
    if existing > 0:
        return

    from app.models.category import Category
    cat_map = {c.name: c.id for c in db.query(Category).all()}

    for priority, (keyword, cat_name) in enumerate(DEFAULT_RULES):
        cat_id = cat_map.get(cat_name)
        if cat_id:
            db.add(CategorizationRule(keyword=keyword, category_id=cat_id, priority=len(DEFAULT_RULES) - priority))
    db.commit()


def categorize_transaction(db: Session, description: str) -> int | None:
    """Apply rules to find the best category for a transaction description."""
    rules = db.query(CategorizationRule).order_by(CategorizationRule.priority.desc()).all()
    desc_upper = description.upper()
    for rule in rules:
        if rule.keyword.upper() in desc_upper:
            return rule.category_id
    return None


def recategorize_all(db: Session) -> int:
    """Re-apply rules to all uncategorized transactions. Returns count updated."""
    # find transactions whose metadata has no category assigned
    rows = db.query(Transaction, TransactionMetadata).join(TransactionMetadata, Transaction.transaction_hash == TransactionMetadata.transaction_hash).filter(TransactionMetadata.category_id.is_(None)).all()
    count = 0
    for txn, meta in rows:
        cat_id = categorize_transaction(db, txn.description)
        if cat_id:
            meta.category_id = cat_id
            count += 1
    db.commit()
    return count
