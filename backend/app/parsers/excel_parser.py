"""
Excel/CSV parser for bank transaction sheets.
Column mapping will be configured per bank based on sample files.
"""
import pandas as pd
from datetime import datetime
from typing import List
from pathlib import Path

from app.parsers.base import BaseParser, ParsedTransaction


class ExcelParser(BaseParser):
    """Generic parser for bank Excel/CSV transaction files."""

    def can_parse(self, text: str, filename: str) -> bool:
        ext = Path(filename).suffix.lower()
        return ext in (".xlsx", ".xls", ".csv")

    def parse(self, filepath: str) -> List[ParsedTransaction]:
        ext = Path(filepath).suffix.lower()

        if ext == ".csv":
            df = pd.read_csv(filepath)
        else:
            df = pd.read_excel(filepath)

        # Normalize column names
        df.columns = [str(c).strip().lower() for c in df.columns]

        # Attempt to detect columns
        date_col = self._find_column(df, ["date", "txn date", "transaction date", "value date"])
        desc_col = self._find_column(df, ["description", "narration", "particulars", "details", "transaction details"])
        debit_col = self._find_column(df, ["debit", "withdrawal", "debit amount", "dr"])
        credit_col = self._find_column(df, ["credit", "deposit", "credit amount", "cr"])
        amount_col = self._find_column(df, ["amount", "transaction amount"])

        if not date_col or not desc_col:
            return []

        transactions = []
        filename_stem = Path(filepath).stem

        for _, row in df.iterrows():
            # Parse date
            dt = self._parse_date(row.get(date_col))
            if not dt:
                continue

            desc = str(row.get(desc_col, "")).strip()
            if not desc or desc == "nan":
                continue

            # Determine amount and type
            if debit_col and credit_col:
                debit_val = self._to_float(row.get(debit_col))
                credit_val = self._to_float(row.get(credit_col))
                if debit_val > 0:
                    amount = debit_val
                    txn_type = "debit"
                elif credit_val > 0:
                    amount = credit_val
                    txn_type = "credit"
                else:
                    continue
            elif amount_col:
                amount = self._to_float(row.get(amount_col))
                txn_type = "debit" if amount > 0 else "credit"
                amount = abs(amount)
            else:
                continue

            if amount == 0:
                continue

            transactions.append(ParsedTransaction(
                date=dt,
                description=desc,
                amount=amount,
                type=txn_type,
                account_name=f"Bank - {filename_stem}",
                bank=filename_stem,
                source="bank_excel",
            ))

        return transactions

    def _find_column(self, df, candidates: List[str]):
        for col in df.columns:
            for candidate in candidates:
                if candidate in col:
                    return col
        return None

    def _parse_date(self, val):
        if pd.isna(val):
            return None
        if isinstance(val, datetime):
            return val.date()
        val_str = str(val).strip()
        for fmt in ["%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d", "%d/%m/%y", "%d-%m-%y", "%d %b %Y", "%d %b %y"]:
            try:
                return datetime.strptime(val_str, fmt).date()
            except ValueError:
                continue
        return None

    def _to_float(self, val) -> float:
        if pd.isna(val):
            return 0.0
        try:
            return abs(float(str(val).replace(",", "").strip()))
        except ValueError:
            return 0.0
