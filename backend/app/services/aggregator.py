"""
Aggregator service — computes dashboard data from transactions.
"""
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from app.models.transaction import Transaction
from app.models.transaction_metadata import TransactionMetadata
from app.models.category import Category
from app.models.account import Account

_IGNORE_FILTER = ~func.lower(TransactionMetadata.tags).like('%ignore%')


def _apply_ignore_filter(q, hide_ignored: bool):
    """Outerjoin to metadata and exclude 'ignore'-tagged rows when requested."""
    q = q.outerjoin(TransactionMetadata, Transaction.transaction_hash == TransactionMetadata.transaction_hash)
    if hide_ignored:
        q = q.filter(or_(TransactionMetadata.tags == None, _IGNORE_FILTER))
    return q


def get_summary(db: Session, month: int = None, year: int = None, hide_ignored: bool = True):
    """Total income, expense, savings for a given month/year."""
    q = db.query(Transaction)
    q = _apply_ignore_filter(q, hide_ignored)
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


def get_by_category(db: Session, month: int = None, year: int = None, hide_ignored: bool = True):
    """Spending grouped by category."""
    q = db.query(
        Category.name,
        Category.color,
        func.sum(Transaction.amount).label("total"),
        func.count(Transaction.id).label("count"),
    ).outerjoin(
        TransactionMetadata, Transaction.transaction_hash == TransactionMetadata.transaction_hash
    ).outerjoin(
        Category, TransactionMetadata.category_id == Category.id
    ).filter(Transaction.type == "debit")

    if hide_ignored:
        q = q.filter(or_(TransactionMetadata.tags == None, _IGNORE_FILTER))
    if month:
        q = q.filter(Transaction.month == month)
    if year:
        q = q.filter(Transaction.year == year)

    rows = q.group_by(Category.name, Category.color).all()
    return [
        {"category": r.name or "Uncategorized", "color": r.color or "#999999", "total": round(r.total, 2), "count": r.count}
        for r in rows
    ]


def get_monthly_trend(db: Session, year: int = None, hide_ignored: bool = True):
    """Month-over-month income and expense totals."""
    q = db.query(
        Transaction.year,
        Transaction.month,
        Transaction.type,
        func.sum(Transaction.amount).label("total"),
    )
    if year:
        q = q.filter(Transaction.year == year)
    q = _apply_ignore_filter(q, hide_ignored)

    rows = q.group_by(Transaction.year, Transaction.month, Transaction.type).all()

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


def get_top_merchants(db: Session, month: int = None, year: int = None, limit: int = 10, hide_ignored: bool = True):
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
    q = _apply_ignore_filter(q, hide_ignored)

    rows = q.group_by(Transaction.description).order_by(func.sum(Transaction.amount).desc()).limit(limit).all()
    return [{"description": r.description, "total": round(r.total, 2), "count": r.count} for r in rows]


def get_income_vs_expense(db: Session, year: int = None, hide_ignored: bool = True):
    """Monthly income vs expense (same as trend but structured for charts)."""
    return get_monthly_trend(db, year, hide_ignored)


def get_uncategorized_top(db: Session, month: int = None, year: int = None, hide_ignored: bool = True, limit: int = 10):
    """Top debit transactions with no category assigned (either no metadata row or category_id IS NULL)."""
    q = db.query(
        Transaction.id,
        Transaction.date,
        Transaction.description,
        Transaction.custom_description,
        Transaction.amount,
        Account.name.label("account_name"),
        TransactionMetadata.tags,
    ).outerjoin(
        TransactionMetadata, Transaction.transaction_hash == TransactionMetadata.transaction_hash
    ).outerjoin(
        Account, Transaction.account_id == Account.id
    ).filter(
        Transaction.type == "debit",
        TransactionMetadata.category_id == None,  # no metadata row OR category_id is NULL
    )

    if hide_ignored:
        q = q.filter(or_(TransactionMetadata.tags == None, _IGNORE_FILTER))
    if month:
        q = q.filter(Transaction.month == month)
    if year:
        q = q.filter(Transaction.year == year)

    rows = q.order_by(Transaction.amount.desc()).limit(limit).all()
    return [
        {
            "id": r.id,
            "date": str(r.date),
            "description": r.custom_description or r.description,
            "amount": round(r.amount, 2),
            "account": r.account_name or "Unknown",
        }
        for r in rows
    ]


_RECURRING_KEYWORDS = {"emi", "recurring", "subscription", "salary", "rent", "insurance", "sip"}


def get_by_tag(db: Session, month: int = None, year: int = None, hide_ignored: bool = True):
    """Spending breakdown by individual tag."""
    q = db.query(
        Transaction.amount,
        TransactionMetadata.tags,
    ).outerjoin(
        TransactionMetadata, Transaction.transaction_hash == TransactionMetadata.transaction_hash
    ).filter(Transaction.type == "debit")

    if hide_ignored:
        q = q.filter(or_(TransactionMetadata.tags == None, _IGNORE_FILTER))
    if month:
        q = q.filter(Transaction.month == month)
    if year:
        q = q.filter(Transaction.year == year)

    rows = q.all()
    tag_totals: dict = {}
    for amount, tags in rows:
        if not tags or not tags.strip():
            tag_list = ["Untagged"]
        else:
            tag_list = [t.strip() for t in tags.split(",") if t.strip() and t.strip().lower() != "ignore"]
            if not tag_list:
                tag_list = ["Untagged"]
        for tag in tag_list:
            if tag not in tag_totals:
                tag_totals[tag] = {"total": 0.0, "count": 0}
            tag_totals[tag]["total"] += float(amount)
            tag_totals[tag]["count"] += 1

    result = [
        {"tag": tag, "total": round(data["total"], 2), "count": data["count"]}
        for tag, data in tag_totals.items()
    ]
    result.sort(key=lambda x: x["total"], reverse=True)
    return result


def get_recurring_vs_impulsive(db: Session, month: int = None, year: int = None, hide_ignored: bool = True):
    """Recurring vs impulsive spend breakdown."""
    q = db.query(
        Transaction.amount,
        TransactionMetadata.tags,
    ).outerjoin(
        TransactionMetadata, Transaction.transaction_hash == TransactionMetadata.transaction_hash
    ).filter(Transaction.type == "debit")

    if hide_ignored:
        q = q.filter(or_(TransactionMetadata.tags == None, _IGNORE_FILTER))
    if month:
        q = q.filter(Transaction.month == month)
    if year:
        q = q.filter(Transaction.year == year)

    rows = q.all()
    recurring = 0.0
    impulsive = 0.0
    for amount, tags in rows:
        tag_set: set = set()
        if tags:
            tag_set = {t.strip().lower() for t in tags.split(",") if t.strip()}
        if tag_set & _RECURRING_KEYWORDS:
            recurring += float(amount)
        else:
            impulsive += float(amount)

    return [
        {"type": "Recurring", "amount": round(recurring, 2)},
        {"type": "Impulsive", "amount": round(impulsive, 2)},
    ]


def get_account_summary(db: Session, month: int = None, year: int = None, hide_ignored: bool = True):
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
    q = _apply_ignore_filter(q, hide_ignored)

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
