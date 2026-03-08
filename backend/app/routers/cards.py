"""
Card details router.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.card_details_service import get_card_details

router = APIRouter(prefix="/api/cards", tags=["cards"])


@router.get("")
def list_cards(db: Session = Depends(get_db)):
    return get_card_details(db)
