"""
Credit-card analytics router.
"""
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.credit_card_service import (
    get_credit_card_accounts,
    get_available_billing_cycles,
    get_analytics,
)
from app.models.transaction import Transaction
from app.models.category import Category
from app.models.account import Account

router = APIRouter(prefix="/api/creditcards", tags=["creditcards"])


@router.get("/accounts")
def accounts(db: Session = Depends(get_db)):
    return get_credit_card_accounts(db)


@router.get("/cycles")
def cycles(db: Session = Depends(get_db)):
    return get_available_billing_cycles(db)


@router.get("/analytics")
def analytics(
    cycle: str = Query(...),
    account_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    return get_analytics(db, cycle, account_id)


# New endpoint: /api/creditcards/transactions
@router.get("/transactions")
def credit_card_transactions(
    cycle: str = Query(...),
    account_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """Return credit card transactions for a billing cycle (and optionally account)."""
    q = db.query(Transaction).filter(
        Transaction.source == "credit_card_pdf",
        Transaction.cycle == cycle,
    )
    if account_id:
        q = q.filter(Transaction.account_id == account_id)
    txns = q.order_by(Transaction.date.desc(), Transaction.id.desc()).all()

    # Fetch category and account lookups
    cat_ids = list({(t.metadata_record.category_id if t.metadata_record else None) for t in txns if (t.metadata_record and t.metadata_record.category_id)})
    acct_ids = list({t.account_id for t in txns if t.account_id})
    cat_lookup = {}
    acct_lookup = {}
    if cat_ids:
        cats = db.query(Category).filter(Category.id.in_(cat_ids)).all()
        cat_lookup = {c.id: c.name for c in cats}
    if acct_ids:
        accts = db.query(Account).filter(Account.id.in_(acct_ids)).all()
        acct_lookup = {a.id: {"name": a.name, "glyph": a.glyph} for a in accts}

    items = [
        {
            "id": t.id,
            "date": t.date.isoformat(),
            "description": t.description,
            "amount": round(t.amount, 2),
            "type": t.type,
            "category": cat_lookup.get((t.metadata_record.category_id if t.metadata_record else None), "Uncategorized"),
            "account": acct_lookup.get(t.account_id, {}).get("name", "Unknown"),
            "account_glyph": acct_lookup.get(t.account_id, {}).get("glyph"),
            "category_id": (t.metadata_record.category_id if t.metadata_record else None),
            "account_id": t.account_id,
            "notes": t.notes,
            "tags": (t.metadata_record.tags if t.metadata_record else None),
            "source": t.source,
            "source_file": t.source_file,
        }
        for t in txns
    ]
    return {
        "items": items,
        "total": len(items),
        "per_page": 1000,
    }
