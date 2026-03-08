"""
Ingestion service — orchestrates parsing files from input folders.
"""
import os
from pathlib import Path
from typing import List, Dict, Any
import re

from sqlalchemy.orm import Session

from app.config import INPUT_DIR
from app.models.transaction import Transaction
from app.models.account import Account
from app.models.ingestion_log import IngestionLog
from app.models.emi_detail import EmiDetail
from datetime import date
import calendar
from app.parsers.pdf_parser import detect_and_parse
from app.parsers.excel_parser import ExcelParser
from app.parsers.base import ParseResult
from app.services.categorizer import categorize_transaction
from app.models.audit_log import AuditLog
import pdfplumber


excel_parser = ExcelParser()


def get_available_folders() -> List[Dict[str, Any]]:
    """List all month folders in input directory."""
    folders = []
    if not INPUT_DIR.exists():
        return folders

    for item in sorted(INPUT_DIR.iterdir()):
        if item.is_dir():
            files = [f.name for f in item.iterdir() if f.is_file()]
            folders.append({
                "name": item.name,
                "path": str(item),
                "files": files,
                "file_count": len(files),
            })
    return folders


def _get_or_create_account(db: Session, name: str, bank: str, acct_type: str = "credit_card") -> int:
    """Get or create an account, return its ID."""
    account = db.query(Account).filter(Account.name == name).first()
    if not account:
        account = Account(name=name, type=acct_type, bank=bank)
        db.add(account)
        db.flush()
    return account.id


def _is_duplicate(db: Session, txn_date, description: str, amount: float, account_id: int) -> bool:
    """Check if a similar transaction already exists."""
    return db.query(Transaction).filter(
        Transaction.date == txn_date,
        Transaction.description == description,
        Transaction.amount == amount,
        Transaction.account_id == account_id,
    ).first() is not None


def ingest_folder(db: Session, folder_name: str) -> Dict[str, Any]:
    """Parse all files in a given month folder and add transactions to DB."""
    folder_path = INPUT_DIR / folder_name
    if not folder_path.exists():
        return {"status": "error", "message": f"Folder '{folder_name}' not found"}

    results = {
        "folder": folder_name,
        "files_processed": 0,
        "transactions_added": 0,
        "transactions_skipped": 0,
        "errors": [],
        "details": [],
    }

    for file_path in sorted(folder_path.iterdir()):
        if not file_path.is_file():
            continue

        fname = file_path.name
        ext = file_path.suffix.lower()

        # Pre-scan PDF for IGST/GST debug matches so we can attach them to IngestionLog
        debug_matches = []
        if ext == ".pdf":
            try:
                with pdfplumber.open(file_path) as pdf:
                    full_text = "\n".join(p.extract_text() or "" for p in pdf.pages)
                igst_pat_local = re.compile(r"(IGST|GST).*?@.*?(?:\d+\.?\d*%?)\s*[,;:\-\s]*([\d,]+\.\d{2})", re.IGNORECASE)
                for m in igst_pat_local.finditer(full_text):
                    debug_matches.append(f"RAW_IGST_MATCH: {m.group(0).strip()} amt={m.group(2).strip()}")
            except Exception:
                debug_matches = []

        try:
            if ext == ".pdf":
                result = detect_and_parse(str(file_path))
                parsed = result.transactions
                emi_details_parsed = result.emi_details
            elif ext in (".xlsx", ".xls", ".csv"):
                parsed = excel_parser.parse(str(file_path))
                emi_details_parsed = []
            else:
                continue

            added = 0
            skipped = 0

            for p in parsed:
                acct_type = "savings" if p.source == "savings_pdf" else "credit_card"
                account_id = _get_or_create_account(db, p.account_name, p.bank, acct_type)

                if _is_duplicate(db, p.date, p.description, p.amount, account_id):
                    skipped += 1
                    continue

                category_id = categorize_transaction(db, p.description)

                txn = Transaction(
                    date=p.date,
                    description=p.description,
                    amount=p.amount,
                    type=p.type,
                    category_id=category_id,
                    account_id=account_id,
                    source=p.source,
                    source_file=fname,
                    cycle=folder_name,
                    month=p.date.month,
                    year=p.date.year,
                )
                db.add(txn)
                added += 1

            # Save EMI details
            emi_added = 0
            emi_txn_added = 0
            for ed in emi_details_parsed:
                account_id = _get_or_create_account(db, ed.account_name, ed.bank)
                # Check for existing EMI detail (same product + account + booking month)
                existing = db.query(EmiDetail).filter(
                    EmiDetail.account_id == account_id,
                    EmiDetail.product_name == ed.product_name,
                    EmiDetail.booking_month == ed.booking_month,
                ).first()
                if not existing:
                    emi = EmiDetail(
                        account_id=account_id,
                        product_name=ed.product_name,
                        duration_months=ed.duration_months,
                        booking_month=ed.booking_month,
                        loan_expiry=ed.loan_expiry,
                        total_outstanding=ed.total_outstanding,
                        monthly_emi=ed.monthly_emi,
                        principal_component=ed.principal_component,
                        interest_component=ed.interest_component,
                        loan_amount=ed.loan_amount,
                        pending_installments=ed.pending_installments,
                        source_file=fname,
                    )
                    db.add(emi)
                    emi_added += 1
                else:
                    emi = existing

                # Also create a transaction record for the EMI installment for the booking month.
                # Parse booking_month like "Feb.'26" or fallback to folder_name if parsing fails.
                try:
                    bm = (getattr(ed, 'booking_month', None) or getattr(emi, 'booking_month', '')).strip()
                    # Expect formats like "Feb.'26" or "Feb 26"
                    # Extract month abbreviation and year digits
                    parts = bm.replace("\u2019", "'").replace("\u2018", "'").split()
                    if len(parts) == 1 and "'" in parts[0]:
                        # e.g. "Feb.'26"
                        m_abbr = parts[0].split("'")[0].strip().strip('.')
                        y_tail = parts[0].split("'")[-1].strip()
                    elif len(parts) >= 2:
                        m_abbr = parts[0].strip().strip('.')
                        y_tail = parts[1].strip().strip('.')
                    else:
                        raise ValueError('unknown booking_month')
                    m_abbr = m_abbr[:3]
                    month_num = list(calendar.month_abbr).index(m_abbr.capitalize())
                    year_num = int(y_tail)
                    if year_num < 100:
                        year_num += 2000
                    txn_date = date(year_num, month_num, 1)
                except Exception:
                    # fallback: use folder_name (expected 'YYYY-MM') as first day
                    try:
                        y, m = folder_name.split('-')
                        txn_date = date(int(y), int(m), 1)
                    except Exception:
                        txn_date = date.today()

                emi_desc = f"{getattr(ed, 'product_name', getattr(emi, 'product_name', 'EMI'))} EMI"
                monthly_amount = getattr(ed, 'monthly_emi', None) or getattr(emi, 'monthly_emi', None)
                # Avoid duplicate transaction rows
                if monthly_amount is None:
                    continue
                if not _is_duplicate(db, txn_date, emi_desc, monthly_amount, account_id):
                    txn = Transaction(
                        date=txn_date,
                        description=emi_desc,
                        amount=monthly_amount,
                        type='debit',
                        category_id=None,
                        account_id=account_id,
                        source=getattr(ed, 'source', 'credit_card_pdf'),
                        source_file=fname,
                        cycle=folder_name,
                        month=txn_date.month,
                        year=txn_date.year,
                        is_recurring=True,
                    )
                    db.add(txn)
                    emi_txn_added += 1

            # Build the base ingestion log message
            base_msg = f"Parsed {len(parsed)} transactions, added {added}, skipped {skipped} duplicates, {emi_added} EMI details, {emi_txn_added} EMI transactions"
            if debug_matches:
                debug_summary = "\nDEBUG_IGST_MATCHES:\n" + "\n".join(debug_matches)
                message = base_msg + debug_summary
            else:
                message = base_msg

            db.add(IngestionLog(
                folder_name=folder_name,
                file_name=fname,
                status="success",
                message=message,
                transactions_added=added + emi_txn_added,
            ))

            results["files_processed"] += 1
            results["transactions_added"] += added + emi_txn_added
            results["transactions_skipped"] += skipped
            results["details"].append({
                "file": fname,
                "parsed": len(parsed),
                "added": added,
                "skipped": skipped,
                "emi_details": emi_added,
                "emi_txn_added": emi_txn_added,
            })

        except Exception as e:
            db.add(IngestionLog(
                folder_name=folder_name,
                file_name=fname,
                status="error",
                message=str(e),
            ))
            results["errors"].append({"file": fname, "error": str(e)})

    db.commit()

    import json
    db.add(AuditLog(
        event_type="parse",
        summary=f"Parsed folder '{folder_name}': {results['files_processed']} files, {results['transactions_added']} added, {results['transactions_skipped']} duplicates",
        details=json.dumps({
            "folder": folder_name,
            "files_processed": results["files_processed"],
            "transactions_added": results["transactions_added"],
            "transactions_skipped": results["transactions_skipped"],
            "errors": results["errors"],
            "file_details": results["details"],
        }),
    ))
    db.commit()

    return results
