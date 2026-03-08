"""
Aggregator service — computes dashboard data from transactions.
"""
from sqlalchemy.orm import Session
from sqlalchemy import func, extract, or_

from app.models.transaction import Transaction
from app.models.transaction_metadata import TransactionMetadata
from app.models.category import Category
from app.models.account import Account


def get_summary(db: Session, month: int = None, year: int = None):
    """Total income, expense, savings for a given month/year."""
    q = db.query(Transaction)
    # Exclude transactions that have been explicitly tagged as 'ignore'
    q = q.outerjoin(TransactionMetadata, Transaction.transaction_hash == TransactionMetadata.transaction_hash).filter(
        or_(TransactionMetadata.tags == None, ~func.lower(TransactionMetadata.tags).like('%ignore%'))
    )
    if month:
        q = q.filter(Transaction.month == month)
    if year:
        q = q.filter(Transaction.year == year)

    total_income = q.filter(Transaction.type == "credit").with_entities(func.sum(Transaction.amount)).scalar() or 0
    total_expense = q.filter(Transaction.type == "debit").with_entities(func.sum(Transaction.amount)).scalar() or 0
    txn_count = q.count()

    return {
        "total_income": round(total_income, 2),
        "total_expense": round(total_expense, 2),
        "net_savings": round(total_income - total_expense, 2),
        "transaction_count": txn_count,
        "month": month,
        "year": year,
    }


def get_by_category(db: Session, month: int = None, year: int = None):
    """Spending grouped by category."""
    q = db.query(
        Category.name,
        Category.color,
        func.sum(Transaction.amount).label("total"),
        func.count(Transaction.id).label("count"),
    ).join(TransactionMetadata, Transaction.transaction_hash == TransactionMetadata.transaction_hash).outerjoin(Category, TransactionMetadata.category_id == Category.id)

    # Exclude ignored transactions
    q = q.filter(Transaction.type == "debit").filter(
        or_(TransactionMetadata.tags == None, ~func.lower(TransactionMetadata.tags).like('%ignore%'))
    )
    if month:
        q = q.filter(Transaction.month == month)
    if year:
        q = q.filter(Transaction.year == year)

    rows = q.group_by(Category.name, Category.color).all()
    return [
        {"category": r.name or "Uncategorized", "color": r.color or "#999999", "total": round(r.total, 2), "count": r.count}
        for r in rows
    ]


def get_monthly_trend(db: Session, year: int = None):
    """Month-over-month income and expense totals."""
    q = db.query(
        Transaction.year,
        Transaction.month,
        Transaction.type,
        func.sum(Transaction.amount).label("total"),
    )
    if year:
        q = q.filter(Transaction.year == year)
    # Exclude ignored transactions
    q = q.outerjoin(TransactionMetadata, Transaction.transaction_hash == TransactionMetadata.transaction_hash).filter(
        or_(TransactionMetadata.tags == None, ~func.lower(TransactionMetadata.tags).like('%ignore%'))
    )

    rows = q.group_by(Transaction.year, Transaction.month, Transaction.type).all()

    # Pivot into monthly data
    monthly = {}
    for r in rows:
        key = f"{r.year}-{r.month:02d}"
        if key not in monthly:
            monthly[key] = {"month": key, "income": 0, "expense": 0}
        if r.type == "credit":
            monthly[key]["income"] = round(r.total, 2)
        else:
            monthly[key]["expense"] = round(r.total, 2)

    return sorted(monthly.values(), key=lambda x: x["month"])


def get_top_merchants(db: Session, month: int = None, year: int = None, limit: int = 10):
    """Top N merchants/payees by spending amount."""
    q = db.query(
        Transaction.description,
        func.sum(Transaction.amount).label("total"),
        func.count(Transaction.id).label("count"),
    ).filter(Transaction.type == "debit")

    if month:
        q = q.filter(Transaction.month == month)
    if year:
        q = q.filter(Transaction.year == year)
    # Exclude ignored transactions
    q = q.outerjoin(TransactionMetadata, Transaction.transaction_hash == TransactionMetadata.transaction_hash).filter(
        or_(TransactionMetadata.tags == None, ~func.lower(TransactionMetadata.tags).like('%ignore%'))
    )

    rows = q.group_by(Transaction.description).order_by(func.sum(Transaction.amount).desc()).limit(limit).all()
    return [{"description": r.description, "total": round(r.total, 2), "count": r.count} for r in rows]


def get_income_vs_expense(db: Session, year: int = None):
    """Monthly income vs expense (same as trend but structured for charts)."""
    return get_monthly_trend(db, year)


def get_account_summary(db: Session, month: int = None, year: int = None):
    """Spending breakdown by account/card."""
    q = db.query(
        Account.name,
        Account.bank,
        Transaction.type,
        func.sum(Transaction.amount).label("total"),
        func.count(Transaction.id).label("count"),
    ).outerjoin(Account, Transaction.account_id == Account.id)

    if month:
        q = q.filter(Transaction.month == month)
    if year:
        q = q.filter(Transaction.year == year)
    # Exclude ignored transactions
    q = q.outerjoin(TransactionMetadata, Transaction.transaction_hash == TransactionMetadata.transaction_hash).filter(
        or_(TransactionMetadata.tags == None, ~func.lower(TransactionMetadata.tags).like('%ignore%'))
    )

    rows = q.group_by(Account.name, Account.bank, Transaction.type).all()

    accounts = {}
    for r in rows:
        name = r.name or "Unknown"
        if name not in accounts:
            accounts[name] = {"account": name, "bank": r.bank or "", "debit": 0, "credit": 0, "count": 0}
        if r.type == "debit":
            accounts[name]["debit"] = round(r.total, 2)
        else:
            accounts[name]["credit"] = round(r.total, 2)
        accounts[name]["count"] += r.count

    return list(accounts.values())
