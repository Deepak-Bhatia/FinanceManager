"""
Ingestion service — orchestrates parsing files from input folders.
"""
import os
from pathlib import Path
from typing import List, Dict, Any

from sqlalchemy.orm import Session

from app.config import INPUT_DIR
from app.models.transaction import Transaction
from app.models.account import Account
from app.models.ingestion_log import IngestionLog
from app.models.emi_detail import EmiDetail
from app.parsers.pdf_parser import detect_and_parse
from app.parsers.excel_parser import ExcelParser
from app.parsers.base import ParseResult
from app.services.categorizer import categorize_transaction


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
            for ed in emi_details_parsed:
                account_id = _get_or_create_account(db, ed.account_name, ed.bank)
                # Skip duplicate EMI details (same product + account + booking month)
                existing = db.query(EmiDetail).filter(
                    EmiDetail.account_id == account_id,
                    EmiDetail.product_name == ed.product_name,
                    EmiDetail.booking_month == ed.booking_month,
                ).first()
                if existing:
                    continue
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

            db.add(IngestionLog(
                folder_name=folder_name,
                file_name=fname,
                status="success",
                message=f"Parsed {len(parsed)} transactions, added {added}, skipped {skipped} duplicates, {emi_added} EMI details",
                transactions_added=added,
            ))

            results["files_processed"] += 1
            results["transactions_added"] += added
            results["transactions_skipped"] += skipped
            results["details"].append({
                "file": fname,
                "parsed": len(parsed),
                "added": added,
                "skipped": skipped,
                "emi_details": emi_added,
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
    return results
