"""
EMI tracking router.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.emi_service import get_all_emis

router = APIRouter(prefix="/api/emis", tags=["emis"])


@router.get("")
def list_emis(db: Session = Depends(get_db)):
    return get_all_emis(db)
