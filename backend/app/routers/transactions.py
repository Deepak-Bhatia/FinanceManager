"""
Transaction CRUD router.
"""
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models.transaction import Transaction
from app.models.account import Account
from app.models.audit_log import AuditLog
from app.models.category import Category

router = APIRouter(prefix="/api/transactions", tags=["transactions"])


class TransactionUpdate(BaseModel):
    description: Optional[str] = None
    amount: Optional[float] = None
    type: Optional[str] = None
    category_id: Optional[int] = None
    notes: Optional[str] = None
    tags: Optional[str] = None
    is_recurring: Optional[bool] = None


class TransactionCreate(BaseModel):
    date: str
    description: str
    amount: float
    type: str = "debit"
    category_id: Optional[int] = None
    account_id: Optional[int] = None
    notes: Optional[str] = None


@router.get("")
def list_transactions(
    month: Optional[int] = Query(None),
    year: Optional[int] = Query(None),
    category_id: Optional[int] = Query(None),
    account_id: Optional[int] = Query(None),
    account_type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """List transactions with optional filters and pagination."""
    q = db.query(Transaction)
    if month:
        q = q.filter(Transaction.month == month)
    if year:
        q = q.filter(Transaction.year == year)
    if category_id:
        q = q.filter(Transaction.category_id == category_id)
    if account_id:
        q = q.filter(Transaction.account_id == account_id)
    if account_type:
        q = q.join(Account, Transaction.account_id == Account.id).filter(Account.type == account_type)
    if search:
        q = q.filter(Transaction.description.ilike(f"%{search}%"))

    total = q.count()
    total_income = q.filter(Transaction.type == "credit").with_entities(func.sum(Transaction.amount)).scalar() or 0
    total_expense = q.filter(Transaction.type == "debit").with_entities(func.sum(Transaction.amount)).scalar() or 0
    items = q.order_by(Transaction.date.desc()).offset((page - 1) * per_page).limit(per_page).all()

    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_income": round(total_income, 2),
        "total_expense": round(total_expense, 2),
        "net_savings": round(total_income - total_expense, 2),
        "items": [_serialize(t) for t in items],
    }


@router.get("/{txn_id}")
def get_transaction(txn_id: int, db: Session = Depends(get_db)):
    txn = db.query(Transaction).get(txn_id)
    if not txn:
        raise HTTPException(404, "Transaction not found")
    return _serialize(txn)


@router.post("")
def create_transaction(body: TransactionCreate, db: Session = Depends(get_db)):
    from datetime import date as dt_date
    txn = Transaction(
        date=dt_date.fromisoformat(body.date),
        description=body.description,
        amount=body.amount,
        type=body.type,
        category_id=body.category_id,
        account_id=body.account_id,
        notes=body.notes,
        source="manual",
        source_file="",
        month=dt_date.fromisoformat(body.date).month,
        year=dt_date.fromisoformat(body.date).year,
    )
    db.add(txn)
    db.commit()
    db.refresh(txn)
    return _serialize(txn)


@router.patch("/{txn_id}")
def update_transaction(txn_id: int, body: TransactionUpdate, db: Session = Depends(get_db)):
    txn = db.query(Transaction).get(txn_id)
    if not txn:
        raise HTTPException(404, "Transaction not found")

    changes = body.dict(exclude_unset=True)
    for field, val in changes.items():
        old_val = getattr(txn, field)
        if old_val != val:
            if field == "category_id":
                old_cat = db.query(Category).get(old_val) if old_val else None
                new_cat = db.query(Category).get(val) if val else None
                old_name = old_cat.name if old_cat else "Uncategorized"
                new_name = new_cat.name if new_cat else "Uncategorized"
                db.add(AuditLog(
                    event_type="category_change",
                    summary=f"Category changed from '{old_name}' to '{new_name}' on txn #{txn_id}: {txn.description}",
                    details=f'{{"transaction_id": {txn_id}, "field": "category_id", "old": "{old_name}", "new": "{new_name}"}}',
                ))
            elif field == "type":
                db.add(AuditLog(
                    event_type="type_change",
                    summary=f"Type changed from '{old_val}' to '{val}' on txn #{txn_id}: {txn.description}",
                    details=f'{{"transaction_id": {txn_id}, "field": "type", "old": "{old_val}", "new": "{val}"}}',
                ))
            else:
                db.add(AuditLog(
                    event_type="field_change",
                    summary=f"{field} changed on txn #{txn_id}: {txn.description}",
                    details=f'{{"transaction_id": {txn_id}, "field": "{field}", "old": "{old_val}", "new": "{val}"}}',
                ))
        setattr(txn, field, val)
    db.commit()
    db.refresh(txn)
    return _serialize(txn)


@router.delete("/{txn_id}")
def delete_transaction(txn_id: int, db: Session = Depends(get_db)):
    txn = db.query(Transaction).get(txn_id)
    if not txn:
        raise HTTPException(404, "Transaction not found")
    db.delete(txn)
    db.commit()
    return {"deleted": True}


def _serialize(t: Transaction) -> dict:
    return {
        "id": t.id,
        "date": t.date.isoformat() if t.date else None,
        "description": t.description,
        "amount": t.amount,
        "type": t.type,
        "category_id": t.category_id,
        "account_id": t.account_id,
        "source": t.source,
        "source_file": t.source_file,
        "month": t.month,
        "year": t.year,
        "is_recurring": t.is_recurring,
        "tags": t.tags,
        "notes": t.notes,
        "created_at": t.created_at.isoformat() if t.created_at else None,
    }
