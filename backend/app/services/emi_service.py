"""
EMI tracking service — reads structured EMI details extracted during parsing.
"""
import re
from typing import Dict, Any

from sqlalchemy.orm import Session

from app.models.emi_detail import EmiDetail
from app.models.account import Account


def get_all_emis(db: Session) -> Dict[str, Any]:
    """Return all EMI details from the emi_details table."""
    all_emis = db.query(EmiDetail).order_by(EmiDetail.id.desc()).all()

    if not all_emis:
        return {"emis": [], "summary": {"total_emi_count": 0, "active_count": 0, "completed_count": 0, "total_monthly": 0, "total_outstanding": 0}}

    # Account lookup
    acct_ids = list({e.account_id for e in all_emis if e.account_id})
    acct_lookup = {}
    if acct_ids:
        accts = db.query(Account).filter(Account.id.in_(acct_ids)).all()
        acct_lookup = {a.id: a.name for a in accts}

    emi_list = []
    for e in all_emis:
        emi_list.append({
            "id": e.id,
            "card": acct_lookup.get(e.account_id, "Unknown"),
            "card_id": e.account_id,
            "product_name": e.product_name,
            "duration_months": e.duration_months,
            "booking_month": e.booking_month,
            "loan_expiry": e.loan_expiry,
            "total_outstanding": round(e.total_outstanding, 2) if e.total_outstanding else 0,
            "monthly_emi": round(e.monthly_emi, 2) if e.monthly_emi else 0,
            "principal_component": round(e.principal_component, 2) if e.principal_component else None,
            "interest_component": round(e.interest_component, 2) if e.interest_component else None,
            "loan_amount": round(e.loan_amount, 2) if e.loan_amount else None,
            "pending_installments": e.pending_installments,
            "source_file": e.source_file,
        })

    total_monthly = sum(e["monthly_emi"] for e in emi_list)
    total_outstanding = sum(e["total_outstanding"] for e in emi_list)

    return {
        "emis": emi_list,
        "summary": {
            "total_emi_count": len(emi_list),
            "active_count": len(emi_list),  # all stored EMIs are from current statements
            "completed_count": 0,
            "total_monthly": round(total_monthly, 2),
            "total_outstanding": round(total_outstanding, 2),
        },
    }
