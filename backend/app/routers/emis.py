"""
EMI tracking router.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.emi_service import get_all_emis
from app.models.emi_detail import EmiDetail
from app.models.emi_attachment import EmiAttachment
from app.models.account import Account

router = APIRouter(prefix="/api/emis", tags=["emis"])


@router.get("")
def list_emis(db: Session = Depends(get_db)):
    return get_all_emis(db)


# ── Attachment endpoints ───────────────────────────────────────────────────────

@router.get("/attachments")
def list_attachments(db: Session = Depends(get_db)):
    rows = (
        db.query(EmiAttachment, EmiDetail)
        .join(EmiDetail, EmiAttachment.emi_id == EmiDetail.id)
        .all()
    )
    return [
        {
            "id": att.id,
            "emi_id": att.emi_id,
            "cycle": att.cycle,
            "transaction_id": att.transaction_id,
            "emi_product_name": emi.product_name,
            "emi_monthly": round(emi.monthly_emi, 2) if emi.monthly_emi else 0,
            "emi_booking_month": emi.booking_month,
            "created_at": att.created_at.isoformat() if att.created_at else None,
        }
        for att, emi in rows
    ]


class AttachRequest(BaseModel):
    emi_id: int
    cycle: str
    transaction_ids: List[int]


@router.post("/attachments")
def create_attachments(body: AttachRequest, db: Session = Depends(get_db)):
    emi = db.get(EmiDetail, body.emi_id)
    if not emi:
        raise HTTPException(404, "EMI not found")
    created = 0
    for tid in body.transaction_ids:
        exists = (
            db.query(EmiAttachment)
            .filter_by(emi_id=body.emi_id, cycle=body.cycle, transaction_id=tid)
            .first()
        )
        if not exists:
            db.add(EmiAttachment(emi_id=body.emi_id, cycle=body.cycle, transaction_id=tid))
            created += 1
    db.commit()
    return {"attached": created}


@router.delete("/attachments/{attachment_id}")
def delete_attachment(attachment_id: int, db: Session = Depends(get_db)):
    att = db.get(EmiAttachment, attachment_id)
    if not att:
        raise HTTPException(404, "Attachment not found")
    db.delete(att)
    db.commit()
    return {"ok": True}


# ── EMI edit ───────────────────────────────────────────────────────────────────

class EmiUpdate(BaseModel):
    product_name: Optional[str] = None
    duration_months: Optional[int] = None
    booking_month: Optional[str] = None
    loan_expiry: Optional[str] = None
    total_outstanding: Optional[float] = None
    monthly_emi: Optional[float] = None
    principal_component: Optional[float] = None
    interest_component: Optional[float] = None
    loan_amount: Optional[float] = None
    pending_installments: Optional[int] = None


def _serialize_emi(emi: EmiDetail, db: Session) -> dict:
    acct_name = "Unknown"
    if emi.account_id:
        acct = db.get(Account, emi.account_id)
        if acct:
            acct_name = acct.name
    return {
        "id": emi.id,
        "card": acct_name,
        "card_id": emi.account_id,
        "product_name": emi.product_name,
        "duration_months": emi.duration_months,
        "booking_month": emi.booking_month,
        "loan_expiry": emi.loan_expiry,
        "total_outstanding": round(emi.total_outstanding, 2) if emi.total_outstanding else 0,
        "monthly_emi": round(emi.monthly_emi, 2) if emi.monthly_emi else 0,
        "principal_component": round(emi.principal_component, 2) if emi.principal_component else None,
        "interest_component": round(emi.interest_component, 2) if emi.interest_component else None,
        "loan_amount": round(emi.loan_amount, 2) if emi.loan_amount else None,
        "pending_installments": emi.pending_installments,
        "source_file": emi.source_file,
    }


@router.patch("/{emi_id}")
def update_emi(emi_id: int, body: EmiUpdate, db: Session = Depends(get_db)):
    emi = db.get(EmiDetail, emi_id)
    if not emi:
        raise HTTPException(404, "EMI not found")
    for field, val in body.dict(exclude_unset=True).items():
        setattr(emi, field, val)
    db.commit()
    db.refresh(emi)
    return _serialize_emi(emi, db)
