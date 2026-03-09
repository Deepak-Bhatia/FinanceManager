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
from app.models.transaction_metadata import TransactionMetadata
from app.models.transaction import compute_transaction_hash
from app.models.account import Account
from app.models.audit_log import AuditLog
from app.models.category import Category
from app.models.emi_attachment import EmiAttachment

router = APIRouter(prefix="/api/transactions", tags=["transactions"])


class TransactionUpdate(BaseModel):
    description: Optional[str] = None
    amount: Optional[float] = None
    type: Optional[str] = None
    category_id: Optional[int] = None
    notes: Optional[str] = None
    tags: Optional[str] = None
    tags_meta: Optional[str] = None  # JSON: [{"name": "food", "type": "manual"|"auto"}]
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
    txn_type: Optional[str] = Query(None, alias="type"),
    search: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
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
        q = q.join(TransactionMetadata, Transaction.transaction_hash == TransactionMetadata.transaction_hash).filter(TransactionMetadata.category_id == category_id)
    if account_id:
        q = q.filter(Transaction.account_id == account_id)
    if account_type:
        q = q.join(Account, Transaction.account_id == Account.id).filter(Account.type == account_type)
    if txn_type:
        q = q.filter(Transaction.type == txn_type)
    if search:
        q = q.filter(Transaction.description.ilike(f"%{search}%"))
    if tag:
        meta_q = db.query(TransactionMetadata.transaction_hash).filter(
            TransactionMetadata.tags.ilike(f"%{tag}%")
        ).subquery()
        q = q.filter(Transaction.transaction_hash.in_(meta_q))

    total = q.count()
    total_income = q.filter(Transaction.type == "credit").with_entities(func.sum(Transaction.amount)).scalar() or 0
    total_expense = q.filter(Transaction.type == "debit").with_entities(func.sum(Transaction.amount)).scalar() or 0
    items_list = q.order_by(Transaction.date.desc()).offset((page - 1) * per_page).limit(per_page).all()

    # Build account glyph map for this page
    acct_ids = list({t.account_id for t in items_list if t.account_id})
    acct_glyph_map: dict = {}
    if acct_ids:
        accts = db.query(Account).filter(Account.id.in_(acct_ids)).all()
        acct_glyph_map = {a.id: a.glyph for a in accts}

    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_income": round(total_income, 2),
        "total_expense": round(total_expense, 2),
        "net_savings": round(total_income - total_expense, 2),
        "items": [_serialize(t, acct_glyph_map.get(t.account_id)) for t in items_list],
    }


@router.get("/{txn_id}")
def get_transaction(txn_id: int, db: Session = Depends(get_db)):
    txn = db.get(Transaction, txn_id)
    if not txn:
        raise HTTPException(404, "Transaction not found")
    return _serialize(txn)


@router.post("")
def create_transaction(body: TransactionCreate, db: Session = Depends(get_db)):
    from datetime import date as dt_date
    txn_date = dt_date.fromisoformat(body.date)
    txn = Transaction(
        transaction_hash=compute_transaction_hash(txn_date, body.description, body.amount),
        date=txn_date,
        description=body.description,
        amount=body.amount,
        type=body.type,
        account_id=body.account_id,
        notes=body.notes,
        source="manual",
        source_file="",
        month=txn_date.month,
        year=txn_date.year,
    )
    db.add(txn)
    db.commit()
    db.refresh(txn)

    # create or update metadata if provided
    if body.category_id is not None or getattr(body, "tags", None) is not None:
        meta = db.query(TransactionMetadata).filter(TransactionMetadata.transaction_hash == txn.transaction_hash).first()
        if not meta:
            meta = TransactionMetadata(transaction_hash=txn.transaction_hash)
            db.add(meta)
            db.flush()
        if body.category_id is not None:
            meta.category_id = body.category_id
        if getattr(body, "tags", None) is not None:
            meta.tags = body.tags
        db.commit()

    return _serialize(txn)


@router.patch("/{txn_id}")
def update_transaction(txn_id: int, body: TransactionUpdate, db: Session = Depends(get_db)):
    txn = db.get(Transaction, txn_id)
    if not txn:
        raise HTTPException(404, "Transaction not found")

    changes = body.dict(exclude_unset=True)
    import json as _json

    for field, val in changes.items():
        # special handling for metadata fields
        if field in ("category_id", "tags", "tags_meta"):
            # get or create metadata row
            meta = db.query(TransactionMetadata).filter(TransactionMetadata.transaction_hash == txn.transaction_hash).first()
            old_val = getattr(meta, field) if meta else None
            if old_val != val:
                if field == "category_id":
                    old_cat = db.get(Category, old_val) if old_val else None
                    new_cat = db.get(Category, val) if val else None
                    old_name = old_cat.name if old_cat else "Uncategorized"
                    new_name = new_cat.name if new_cat else "Uncategorized"
                    db.add(AuditLog(
                        event_type="category_change",
                        summary=f"Category changed from '{old_name}' to '{new_name}' on txn #{txn_id}: {txn.description}",
                        details=f'{{"transaction_id": {txn_id}, "field": "category_id", "old": "{old_name}", "new": "{new_name}"}}',
                    ))
                elif field == "tags":
                    db.add(AuditLog(
                        event_type="field_change",
                        summary=f"tags changed on txn #{txn_id}: {txn.description}",
                        details=f'{{"transaction_id": {txn_id}, "field": "tags", "old": "{old_val}", "new": "{val}"}}',
                    ))
                if not meta:
                    meta = TransactionMetadata(transaction_hash=txn.transaction_hash)
                    db.add(meta)
                    db.flush()
                setattr(meta, field, val)
                # When tags change and tags_meta not explicitly provided, rebuild tags_meta as all-manual
                if field == "tags" and "tags_meta" not in changes:
                    tag_list = [t.strip() for t in (val or '').split(',') if t.strip()]
                    # preserve existing types for tags that already exist
                    existing_types: dict = {}
                    try:
                        existing_types = {e["name"]: e["type"] for e in _json.loads(old_val or '[]') if isinstance(e, dict)} if old_val else {}
                    except Exception:
                        pass
                    new_meta = [{"name": t, "type": existing_types.get(t, "manual")} for t in tag_list]
                    meta.tags_meta = _json.dumps(new_meta)
        else:
            old_val = getattr(txn, field)
            if old_val != val:
                if field == "type":
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
    txn = db.get(Transaction, txn_id)
    if not txn:
        raise HTTPException(404, "Transaction not found")
    db.query(EmiAttachment).filter(EmiAttachment.transaction_id == txn_id).delete()
    db.query(TransactionMetadata).filter(TransactionMetadata.transaction_hash == txn.transaction_hash).delete()
    db.delete(txn)
    db.commit()
    return {"deleted": True}


def _serialize(t: Transaction, account_glyph: Optional[str] = None) -> dict:
    import json as _json
    raw_meta = (t.metadata_record.tags_meta if t.metadata_record else None)
    try:
        tags_meta = _json.loads(raw_meta) if raw_meta else []
    except Exception:
        tags_meta = []
    return {
        "id": t.id,
        "transaction_hash": t.transaction_hash,
        "date": t.date.isoformat() if t.date else None,
        "description": t.description,
        "amount": t.amount,
        "type": t.type,
        "category_id": (t.metadata_record.category_id if t.metadata_record else None),
        "account_id": t.account_id,
        "account_glyph": account_glyph,
        "source": t.source,
        "source_file": t.source_file,
        "month": t.month,
        "year": t.year,
        "is_recurring": t.is_recurring,
        "tags": (t.metadata_record.tags if t.metadata_record else None),
        "tags_meta": tags_meta,
        "notes": t.notes,
        "created_at": t.created_at.isoformat() if t.created_at else None,
    }
