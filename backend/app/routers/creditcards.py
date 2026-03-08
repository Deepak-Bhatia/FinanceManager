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
