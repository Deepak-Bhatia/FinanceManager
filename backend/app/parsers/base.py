"""
Base parser interface for all document parsers.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import date
from typing import List, Optional


@dataclass
class ParsedTransaction:
    date: date
    description: str
    amount: float
    type: str  # "debit" or "credit"
    account_name: str
    bank: str
    source: str  # "credit_card_pdf", "bank_excel"


@dataclass
class ParsedEmiDetail:
    account_name: str
    bank: str
    product_name: str  # e.g. "MERCHANT EMI"
    duration_months: int  # e.g. 6
    booking_month: str  # e.g. "Feb.'26" or "23/02/2026"
    loan_expiry: str  # e.g. "Aug 26" or "23/07/2026"
    total_outstanding: float
    monthly_emi: float
    principal_component: Optional[float] = None
    interest_component: Optional[float] = None
    loan_amount: Optional[float] = None  # total EMI/Loan amount
    pending_installments: Optional[int] = None
    source_file: Optional[str] = None


@dataclass
class ParseResult:
    transactions: List[ParsedTransaction]
    emi_details: List[ParsedEmiDetail]


class BaseParser(ABC):
    @abstractmethod
    def can_parse(self, text: str, filename: str) -> bool:
        """Return True if this parser can handle the given file."""
        pass

    @abstractmethod
    def parse(self, filepath: str) -> List[ParsedTransaction]:
        """Parse the file and return a list of transactions."""
        pass

    def _clean_amount(self, amount_str: str) -> float:
        """Clean amount string like '1,300.00' or '61.34' to float."""
        cleaned = amount_str.replace(",", "").replace("`", "").replace("₹", "").strip()
        # Remove any trailing alphabetic chars like 'Dr', 'Cr' etc.
        cleaned = cleaned.split()[0] if " " in cleaned else cleaned
        try:
            return abs(float(cleaned))
        except ValueError:
            return 0.0
