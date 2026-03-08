"""
Credit card analytics service — billing cycle based aggregations.
"""
import re
from typing import List, Dict, Any, Optional

from sqlalchemy.orm import Session

from app.models.transaction import Transaction
from app.models.category import Category
from app.models.account import Account

# Keywords that indicate EMI / loan-based transactions
EMI_KEYWORDS = re.compile(
    r"\bEMI\b|FLEXI\s*PAY|BAJAJ\s*FINSERV|ZESTMONEY|LAZYPAY|LOAN\s*EMI|SMARTEMI|SMART\s*EMI",
    re.IGNORECASE,
)


def _is_emi(description: str) -> bool:
    return bool(EMI_KEYWORDS.search(description))


def get_credit_card_accounts(db: Session) -> List[Dict[str, Any]]:
    """List all credit card accounts."""
    accounts = db.query(Account).filter(Account.type == "credit_card").all()
    return [{"id": a.id, "name": a.name, "bank": a.bank} for a in accounts]


def get_available_billing_cycles(db: Session) -> List[Dict[str, Any]]:
    """Return distinct cycles that have credit card transactions."""
    rows = (
        db.query(Transaction.cycle)
        .filter(Transaction.source == "credit_card_pdf", Transaction.cycle.isnot(None))
        .group_by(Transaction.cycle)
        .order_by(Transaction.cycle.desc())
        .all()
    )
    return [{"cycle": r.cycle} for r in rows]


def get_analytics(
    db: Session,
    cycle: str,
    account_id: Optional[int] = None,
) -> Dict[str, Any]:
    """Compute all credit card analytics for a billing cycle."""
    # Base query: credit card transactions for this cycle
    base = db.query(Transaction).filter(
        Transaction.source == "credit_card_pdf",
        Transaction.cycle == cycle,
    )
    if account_id:
        base = base.filter(Transaction.account_id == account_id)

    all_txns = base.all()
    debits = [t for t in all_txns if t.type == "debit"]
    credits = [t for t in all_txns if t.type == "credit"]

    total_spend = sum(t.amount for t in debits)
    total_credits = sum(t.amount for t in credits)

    # --- By Category ---
    cat_map: Dict[int, Dict] = {}
    for t in debits:
        cid = (t.metadata_record.category_id if t.metadata_record and t.metadata_record.category_id else None) or 0
        if cid not in cat_map:
            cat_map[cid] = {"total": 0, "count": 0}
        cat_map[cid]["total"] += t.amount
        cat_map[cid]["count"] += 1

    # Fetch category names
    cat_ids = [cid for cid in cat_map if cid != 0]
    cat_lookup = {}
    if cat_ids:
        cats = db.query(Category).filter(Category.id.in_(cat_ids)).all()
        cat_lookup = {c.id: {"name": c.name, "color": c.color} for c in cats}

    by_category = []
    for cid, data in cat_map.items():
        info = cat_lookup.get(cid, {"name": "Uncategorized", "color": "#999999"})
        by_category.append({
            "category": info["name"],
            "color": info["color"],
            "total": round(data["total"], 2),
            "count": data["count"],
        })
    by_category.sort(key=lambda x: x["total"], reverse=True)

    # --- By Card ---
    card_map: Dict[int, Dict] = {}
    for t in debits:
        aid = t.account_id or 0
        if aid not in card_map:
            card_map[aid] = {"total": 0, "count": 0}
        card_map[aid]["total"] += t.amount
        card_map[aid]["count"] += 1

    acct_ids = [aid for aid in card_map if aid != 0]
    acct_lookup = {}
    if acct_ids:
        accts = db.query(Account).filter(Account.id.in_(acct_ids)).all()
        acct_lookup = {a.id: {"name": a.name, "bank": a.bank} for a in accts}

    by_card = []
    for aid, data in card_map.items():
        info = acct_lookup.get(aid, {"name": "Unknown", "bank": "Unknown"})
        by_card.append({
            "card": info["name"],
            "bank": info["bank"],
            "total": round(data["total"], 2),
            "count": data["count"],
        })
    by_card.sort(key=lambda x: x["total"], reverse=True)

    # --- Own vs Other ---
    # Currently all transactions are primary cardholder ("own").
    # Supplementary card tagging can be added later.
    own_vs_other = {
        "own": round(total_spend, 2),
        "other": 0,
    }

    # --- Regular vs EMI ---
    emi_total = 0
    regular_total = 0
    for t in debits:
        if _is_emi(t.description):
            emi_total += t.amount
        else:
            regular_total += t.amount

    regular_vs_emi = {
        "regular": round(regular_total, 2),
        "emi": round(emi_total, 2),
    }

    # --- All Spends (sorted by amount desc) ---
    all_sorted = sorted(debits, key=lambda t: t.amount, reverse=True)
    acct_ids_all = list({t.account_id for t in all_sorted if t.account_id})
    acct_lookup_all = {}
    if acct_ids_all:
        accts = db.query(Account).filter(Account.id.in_(acct_ids_all)).all()
        acct_lookup_all = {a.id: a.name for a in accts}
    cat_ids_all = list({(t.metadata_record.category_id if t.metadata_record else None) for t in all_sorted if (t.metadata_record and t.metadata_record.category_id)})
    cat_lookup_all = {}
    if cat_ids_all:
        cats = db.query(Category).filter(Category.id.in_(cat_ids_all)).all()
        cat_lookup_all = {c.id: c.name for c in cats}

    all_spends_data = []
    for t in all_sorted:
        cid = (t.metadata_record.category_id if t.metadata_record else None)
        all_spends_data.append({
            "id": t.id,
            "date": t.date.isoformat(),
            "description": t.description,
            "amount": round(t.amount, 2),
            "card": acct_lookup_all.get(t.account_id, "Unknown"),
            "card_id": t.account_id,
            "category": cat_lookup_all.get(cid, "Uncategorized"),
            "is_emi": _is_emi(t.description),
            "tags": (t.metadata_record.tags if t.metadata_record else None),
            "source": t.source,
            "source_file": t.source_file,
        })

    # Derive cycle label from the cycle string and actual transaction dates
    dates = [t.date for t in all_txns if t.date]
    start = min(dates) if dates else None
    end = max(dates) if dates else None
    cycle_label = cycle
    if start and end:
        cycle_label = f"{start.strftime('%d %b')} – {end.strftime('%d %b %Y')}"

    return {
        "billing_cycle": {
            "cycle": cycle,
            "start": start.isoformat() if start else None,
            "end": end.isoformat() if end else None,
            "label": cycle_label,
        },
        "summary": {
            "total_spend": round(total_spend, 2),
            "total_credits": round(total_credits, 2),
            "net": round(total_spend - total_credits, 2),
            "transaction_count": len(all_txns),
            "debit_count": len(debits),
        },
        "by_category": by_category,
        "by_card": by_card,
        "own_vs_other": own_vs_other,
        "regular_vs_emi": regular_vs_emi,
        "all_spends": all_spends_data,
    }
