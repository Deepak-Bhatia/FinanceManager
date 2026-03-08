"""
Card details service — credit card metadata, cycles, and fee/spend requirements.
"""
from typing import List, Dict, Any
from datetime import date

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.transaction import Transaction
from app.models.account import Account

# Card metadata: cycle dates, annual fee details, spend requirements
# This is config data — ideally from a DB table, but for now hardcoded per known cards.
CARD_METADATA: Dict[str, Dict[str, Any]] = {
    "Airtel Axis Card": {
        "network": "Visa",
        "cycle_start": 1,
        "cycle_end": 28,
        "annual_fee": 500,
        "fee_waiver": "Spend ₹2,00,000 in a year",
        "fee_waiver_amount": 200000,
        "fee_waiver_period": "yearly",
        "is_free": False,
        "notes": "Cashback on Airtel services, bill payments",
    },
    "AMEX Card": {
        "network": "Amex",
        "cycle_start": 7,
        "cycle_end": 6,
        "annual_fee": 6500,
        "fee_waiver": "Spend ₹1,50,000 in first 90 days for welcome benefit",
        "fee_waiver_amount": 150000,
        "fee_waiver_period": "quarterly",
        "is_free": False,
        "notes": "Membership Rewards points, lounge access",
    },
    "ICICI Coral Card": {
        "network": "Visa",
        "cycle_start": 15,
        "cycle_end": 14,
        "annual_fee": 500,
        "fee_waiver": "Spend ₹1,50,000 in a year",
        "fee_waiver_amount": 150000,
        "fee_waiver_period": "yearly",
        "is_free": False,
        "notes": "2 reward points per ₹100 spend",
    },
    "HDFC Swiggy Card": {
        "network": "Visa",
        "cycle_start": 1,
        "cycle_end": 28,
        "annual_fee": 500,
        "fee_waiver": "Spend ₹2,00,000 in a year",
        "fee_waiver_amount": 200000,
        "fee_waiver_period": "yearly",
        "is_free": False,
        "notes": "10% cashback on Swiggy, 5% on online spends",
    },
    "HSBC Platinum Card": {
        "network": "Visa",
        "cycle_start": 1,
        "cycle_end": 28,
        "annual_fee": 0,
        "fee_waiver": None,
        "fee_waiver_amount": None,
        "fee_waiver_period": None,
        "is_free": True,
        "notes": "Lifetime free card",
    },
    "ICICI Amazon Pay Card": {
        "network": "Visa",
        "cycle_start": 15,
        "cycle_end": 14,
        "annual_fee": 0,
        "fee_waiver": None,
        "fee_waiver_amount": None,
        "fee_waiver_period": None,
        "is_free": True,
        "notes": "Lifetime free, 5% on Amazon with Prime, 1% elsewhere",
    },
    "HDFC Regalia Gold Card": {
        "network": "Visa",
        "cycle_start": 1,
        "cycle_end": 28,
        "annual_fee": 2500,
        "fee_waiver": "Spend ₹3,00,000 in a year",
        "fee_waiver_amount": 300000,
        "fee_waiver_period": "yearly",
        "is_free": False,
        "notes": "4 reward points per ₹150, lounge access",
    },
    "SBI Card": {
        "network": "Visa",
        "cycle_start": 1,
        "cycle_end": 28,
        "annual_fee": 499,
        "fee_waiver": "Spend ₹1,00,000 in a year",
        "fee_waiver_amount": 100000,
        "fee_waiver_period": "yearly",
        "is_free": False,
        "notes": "Reward points on all purchases",
    },
}


def get_card_details(db: Session) -> Dict[str, Any]:
    """Return all credit cards with their metadata and spend statistics."""
    accounts = db.query(Account).filter(Account.type == "credit_card").all()

    # Get yearly spend per card for fee waiver tracking
    current_year = date.today().year
    yearly_spends = (
        db.query(
            Transaction.account_id,
            func.sum(Transaction.amount).label("total"),
        )
        .filter(
            Transaction.source == "credit_card_pdf",
            Transaction.type == "debit",
            Transaction.year == current_year,
        )
        .group_by(Transaction.account_id)
        .all()
    )
    yearly_map = {r.account_id: round(r.total, 2) for r in yearly_spends}

    # Get monthly spend per card (latest month available)
    monthly_spends = (
        db.query(
            Transaction.account_id,
            Transaction.year,
            Transaction.month,
            func.sum(Transaction.amount).label("total"),
            func.count(Transaction.id).label("count"),
        )
        .filter(
            Transaction.source == "credit_card_pdf",
            Transaction.type == "debit",
        )
        .group_by(Transaction.account_id, Transaction.year, Transaction.month)
        .all()
    )

    # Build monthly history per card
    monthly_map: Dict[int, List[Dict]] = {}
    for r in monthly_spends:
        if r.account_id not in monthly_map:
            monthly_map[r.account_id] = []
        monthly_map[r.account_id].append({
            "year": r.year, "month": r.month,
            "total": round(r.total, 2), "count": r.count,
        })

    # Total spend per card (all time)
    total_spends = (
        db.query(
            Transaction.account_id,
            func.sum(Transaction.amount).label("total"),
            func.count(Transaction.id).label("count"),
        )
        .filter(
            Transaction.source == "credit_card_pdf",
            Transaction.type == "debit",
        )
        .group_by(Transaction.account_id)
        .all()
    )
    total_map = {r.account_id: {"total": round(r.total, 2), "count": r.count} for r in total_spends}

    cards = []
    for a in accounts:
        meta = CARD_METADATA.get(a.name, {})
        yearly_spend = yearly_map.get(a.id, 0)
        waiver_amount = meta.get("fee_waiver_amount")
        waiver_progress = None
        waiver_met = None
        if waiver_amount:
            waiver_progress = round(min(yearly_spend / waiver_amount * 100, 100), 1)
            waiver_met = yearly_spend >= waiver_amount

        totals = total_map.get(a.id, {"total": 0, "count": 0})

        cards.append({
            "id": a.id,
            "name": a.name,
            "bank": a.bank,
            "network": meta.get("network", "Unknown"),
            "cycle_start": meta.get("cycle_start", 1),
            "cycle_end": meta.get("cycle_end", 28),
            "annual_fee": meta.get("annual_fee", 0),
            "is_free": meta.get("is_free", False),
            "fee_waiver": meta.get("fee_waiver"),
            "fee_waiver_amount": waiver_amount,
            "fee_waiver_period": meta.get("fee_waiver_period"),
            "notes": meta.get("notes", ""),
            "yearly_spend": yearly_spend,
            "waiver_progress": waiver_progress,
            "waiver_met": waiver_met,
            "total_spend": totals["total"],
            "total_transactions": totals["count"],
            "monthly_history": sorted(
                monthly_map.get(a.id, []),
                key=lambda m: (m["year"], m["month"]),
                reverse=True,
            ),
        })

    cards.sort(key=lambda c: c["total_spend"], reverse=True)

    return {
        "cards": cards,
        "summary": {
            "total_cards": len(cards),
            "free_cards": sum(1 for c in cards if c["is_free"]),
            "paid_cards": sum(1 for c in cards if not c["is_free"]),
            "total_annual_fees": sum(c["annual_fee"] for c in cards if not c["is_free"] and not c.get("waiver_met")),
        },
    }


def update_card_metadata(card_name: str, updates: Dict[str, Any]) -> bool:
    """Update card metadata in memory. In future, move to DB."""
    if card_name in CARD_METADATA:
        CARD_METADATA[card_name].update(updates)
        return True
    return False
