"""
PDF parsers for various credit card statement formats.
Each parser handles a specific bank's PDF format.
"""
import re
from datetime import datetime, date
from typing import List, Optional

import pdfplumber

from app.parsers.base import BaseParser, ParsedTransaction, ParsedEmiDetail, ParseResult
import logging


class AirtelAxisParser(BaseParser):
    """Parser for Airtel Axis Bank Mastercard statements."""

    def can_parse(self, text: str, filename: str) -> bool:
        return "airtel axis" in text.lower() or "airtel axis" in filename.lower()

    def parse(self, filepath: str) -> List[ParsedTransaction]:
        transactions = []
        filename = filepath.split("\\")[-1].split("/")[-1]
        with pdfplumber.open(filepath) as pdf:
            full_text = "\n".join(p.extract_text() or "" for p in pdf.pages)

        # Pattern: DD/MM/YYYY  DESCRIPTION  CATEGORY  AMOUNT Dr/Cr
        pattern = re.compile(
            r"(\d{2}/\d{2}/\d{4})\s+"
            r"(.+?)\s+"
            r"([\d,]+\.\d{2})\s+(Dr|Cr)",
            re.IGNORECASE,
        )
        for m in pattern.finditer(full_text):
            dt = datetime.strptime(m.group(1), "%d/%m/%Y").date()
            desc = m.group(2).strip()
            amount = self._clean_amount(m.group(3))
            txn_type = "debit" if m.group(4).lower() == "dr" else "credit"

            # Skip cashback detail lines
            if "CASHBACK" in desc.upper() and "CREDIT" in desc.upper():
                txn_type = "credit"

            transactions.append(ParsedTransaction(
                date=dt, description=desc, amount=amount,
                type=txn_type, account_name="Airtel Axis Card",
                bank="Axis Bank", source="credit_card_pdf",
            ))
        return transactions


class AMXParser(BaseParser):
    """Parser for American Express statements."""

    def can_parse(self, text: str, filename: str) -> bool:
        fname_lower = filename.lower()
        if "amx" in fname_lower or "amex" in fname_lower:
            return True
        text_lower = text.lower()
        # Only match if it's an actual AMX statement, not a generic mention in disclaimers
        if "american express" in text_lower and (
            "membership rewards" in text_lower
            or "membership since" in text_lower
            or "american express company" in text_lower
        ):
            return True
        return False

    def parse(self, filepath: str) -> List[ParsedTransaction]:
        transactions = []
        with pdfplumber.open(filepath) as pdf:
            full_text = "\n".join(p.extract_text() or "" for p in pdf.pages)

        # Find statement year from text
        year_match = re.search(r"Statement Period.*?(\d{4})", full_text)
        stmt_year = int(year_match.group(1)) if year_match else datetime.now().year

        # Pattern: Month DD DESCRIPTION AMOUNT [CR]
        # e.g.: "February 02 PAYMENT RECEIVED. THANK YOU 7,932.50"
        months = r"(?:January|February|March|April|May|June|July|August|September|October|November|December)"
        pattern = re.compile(
            rf"({months})\s+(\d{{1,2}})\s+"
            r"(.+?)\s+"
            r"([\d,]+\.\d{2})\s*$",
            re.MULTILINE | re.IGNORECASE,
        )
        for m in pattern.finditer(full_text):
            month_name = m.group(1)
            day = int(m.group(2))
            desc = m.group(3).strip()
            amount = self._clean_amount(m.group(4))

            month_num = datetime.strptime(month_name, "%B").month
            dt = date(stmt_year, month_num, day)

            # Check next line for CR marker
            end_pos = m.end()
            after_text = full_text[end_pos:end_pos + 50].strip()
            is_credit = after_text.startswith("CR") or "PAYMENT RECEIVED" in desc.upper()

            txn_type = "credit" if is_credit else "debit"
            transactions.append(ParsedTransaction(
                date=dt, description=desc, amount=amount,
                type=txn_type, account_name="AMEX Card",
                bank="American Express", source="credit_card_pdf",
            ))
        return transactions


class ICICISavingsParser(BaseParser):
    """Parser for ICICI Bank savings account statements."""

    def can_parse(self, text: str, filename: str) -> bool:
        fname_lower = filename.lower()
        if "saving account" in fname_lower and "icici" in fname_lower:
            return True
        text_lower = text.lower()
        if "savings account" in text_lower and "statement of transactions in savings" in text_lower:
            return True
        return False

    def parse(self, filepath: str) -> List[ParsedTransaction]:
        transactions = []
        filename = filepath.split("\\")[-1].split("/")[-1]

        with pdfplumber.open(filepath) as pdf:
            full_text = "\n".join(p.extract_text() or "" for p in pdf.pages)
            # Extract account number
            acct_match = re.search(r"Savings Account (X+\d+)", full_text)
            acct_num = acct_match.group(1)[-4:] if acct_match else ""
            account_name = f"ICICI Savings {acct_num}" if acct_num else "ICICI Savings"

            # Get layout-preserved text from all pages for column-aware parsing
            all_lines = []
            for pg in pdf.pages:
                text = pg.extract_text(layout=True)
                if text:
                    all_lines.extend(text.split("\n"))

        date_re = re.compile(r"^\s*(\d{2}-\d{2}-\d{4})")
        amounts_2_re = re.compile(r"([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s*$")
        single_amt_re = re.compile(r"([\d,]+\.\d{2})\s*$")
        upi_payee_re = re.compile(r"UPI/([^/]+)")

        in_txn_section = False
        prev_balance = None
        pending_desc_lines: List[str] = []

        for line in all_lines:
            stripped = line.strip()
            if not stripped:
                continue

            # Detect transaction section header
            if (
                "DATE" in stripped
                and "MODE" in stripped
                and "BALANCE" in stripped
                and "PARTICULARS" in stripped
            ):
                in_txn_section = True
                pending_desc_lines = []
                continue

            # Section ends at Total line
            if in_txn_section and stripped.startswith("Total:"):
                in_txn_section = False
                continue

            if not in_txn_section:
                continue

            date_match = date_re.match(line)
            if date_match:
                date_str = date_match.group(1)
                rest = line[date_match.end():]

                # Look for two amounts at end of line (amount + balance)
                amt_match = amounts_2_re.search(rest)
                if amt_match:
                    amt = self._clean_amount(amt_match.group(1))
                    balance = self._clean_amount(amt_match.group(2))
                    desc_part = rest[: amt_match.start()].strip()

                    # Skip B/F (Brought Forward) — opening balance
                    if "B/F" in desc_part:
                        prev_balance = balance
                        pending_desc_lines = []
                        continue

                    # Determine debit/credit from running balance
                    try:
                        if prev_balance is not None and balance is not None:
                            # both are numbers — do a tolerant comparison
                            if abs(round(prev_balance + amt, 2) - balance) < 0.01:
                                txn_type = "credit"  # deposit
                            else:
                                txn_type = "debit"  # withdrawal
                        else:
                            txn_type = "debit"
                    except Exception:
                        # Defensive fallback if any value is unexpected
                        txn_type = "debit"

                    # Build description from pending lines + date line text
                    # Remove MODE keywords from desc_part
                    for mode_kw in ("OTHER ATMS", "NET BANKING", "MOBILE BANKING"):
                        desc_part = desc_part.replace(mode_kw, "").strip()

                    all_desc = " ".join(
                        [l for l in pending_desc_lines if l] + ([desc_part] if desc_part else [])
                    )
                    desc = self._extract_description(all_desc)

                    dt = datetime.strptime(date_str, "%d-%m-%Y").date()
                    if amt > 0:
                        transactions.append(
                            ParsedTransaction(
                                date=dt,
                                description=desc,
                                amount=amt,
                                type=txn_type,
                                account_name=account_name,
                                bank="ICICI Bank",
                                source="savings_pdf",
                            )
                        )

                    prev_balance = balance
                    pending_desc_lines = []
                else:
                    # Single amount = just balance (B/F line)
                    single_match = single_amt_re.search(rest)
                    if single_match:
                        balance = self._clean_amount(single_match.group(1))
                        desc_part = rest[: single_match.start()].strip()
                        if "B/F" in desc_part:
                            prev_balance = balance
                            pending_desc_lines = []
            else:
                # Non-date line — description text
                pending_desc_lines.append(stripped)

        return transactions

    def _extract_description(self, raw: str) -> str:
        """Extract a clean description from the raw combined text."""
        # UPI transactions: extract payee name
        upi_match = re.search(r"UPI/([^/]+)", raw)
        if upi_match:
            payee = upi_match.group(1).strip()
            return f"UPI - {payee}"
        # IMPS
        imps_match = re.search(r"MMT/IMPS/\d+/([^/]+)", raw)
        if imps_match:
            return f"IMPS - {imps_match.group(1).strip()}"
        # NEFT / Internet fund transfer
        if "INF/INFT" in raw:
            self_match = re.search(r"INF/INFT/\d+/(\S+)", raw)
            return f"Fund Transfer - {self_match.group(1)}" if self_match else "Fund Transfer"
        # ATM withdrawal
        if "NFS/CASH WDL" in raw or "CASH WDL" in raw:
            return "ATM Withdrawal"
        # Recurring deposit
        rd_match = re.search(r"To RD Ac no (\d+)", raw)
        if rd_match:
            return f"Recurring Deposit {rd_match.group(1)}"
        # Fallback: first 80 chars cleaned
        return raw[:80].strip() if raw else "Unknown"


class ICICIParser(BaseParser):
    """Parser for ICICI credit card statements (Coral, Amazon Pay, etc.)."""

    def can_parse(self, text: str, filename: str) -> bool:
        fname_lower = filename.lower()
        # Exclude savings account files
        if "saving account" in fname_lower:
            return False
        text_lower = text.lower()
        if "icici" in fname_lower or "coral" in fname_lower:
            return True
        if "icicibank.com" in text_lower and "american express" not in text_lower:
            return True
        return False

    def _detect_card_name(self, text: str, filename: str) -> str:
        fname_lower = filename.lower()
        if "coral" in fname_lower:
            return "ICICI Coral Card"
        if "amazon" in fname_lower or "mazon" in fname_lower:
            return "ICICI Amazon Pay Card"
        return "ICICI Card"

    def parse(self, filepath: str) -> List[ParsedTransaction]:
        transactions = []
        filename = filepath.split("\\")[-1].split("/")[-1]

        with pdfplumber.open(filepath) as pdf:
            full_text = "\n".join(p.extract_text() or "" for p in pdf.pages)

        card_name = self._detect_card_name(full_text, filename)

        # Strip EMI / PERSONAL LOAN section so its rows aren't matched as transactions
        emi_section = re.compile(
            r"EMI\s*/\s*PERSONAL\s+LOAN\s+ON\s+CREDIT\s+CARDS.*?(?=\n\*For EMI|\nPage\s+\d+|\Z)",
            re.DOTALL | re.IGNORECASE,
        )
        # Before removing the EMI block, try to extract IGST/GST tax lines inside it
        m_emi = emi_section.search(full_text)
        if m_emi:
            emi_block = m_emi.group(0)
            igst_pat = re.compile(r"(IGST|GST).*?@.*?([\d,]+\.?\d{0,2})", re.IGNORECASE)
            for im in igst_pat.finditer(emi_block):
                amt_str = im.group(2)
                try:
                    amt = self._clean_amount(amt_str)
                except Exception:
                    amt = 0.0

                # Debug logging: record raw match and cleaned amount
                try:
                    with open("backend/parser_debug.log", "a", encoding="utf-8") as df:
                        df.write(f"ICICI IGST MATCH file={filename} raw={im.group(0)!r} amt_str={amt_str!r} cleaned={amt}\n")
                except Exception:
                    pass

                # Heuristic: find nearest preceding date (dd/mm/yyyy) within 200 chars
                start_pos = m_emi.start() + im.start()
                lookback = full_text[max(0, start_pos - 200): start_pos]
                date_match = None
                dm = re.findall(r"(\d{2}/\d{2}/\d{4})", lookback)
                if dm:
                    try:
                        dt = datetime.strptime(dm[-1], "%d/%m/%Y").date()
                    except Exception:
                        dt = date.today()
                else:
                    dt = date.today()

                desc = im.group(0).strip()
                if amt > 0:
                    transactions.append(ParsedTransaction(
                        date=dt,
                        description=desc,
                        amount=amt,
                        type="debit",
                        account_name=card_name,
                        bank="ICICI Bank",
                        source="credit_card_pdf",
                    ))

        # remove EMI block so other parsers don't double-parse
        full_text = emi_section.sub("", full_text)

        # Pattern: DD/MM/YYYY SerialNo DESCRIPTION [RewardPts] [IntlAmount] AMOUNT [CR]
        # e.g.: 03/02/2026 12808735594 BBPS Payment received 0 50,000.00 CR
        pattern = re.compile(
            r"(\d{2}/\d{2}/\d{4})\s+"
            r"\d+\s+"  # serial number
            r"(.+?)\s+"
            r"([\d,]+\.\d{2})\s*(CR)?",
            re.IGNORECASE,
        )
        for m in pattern.finditer(full_text):
            dt = datetime.strptime(m.group(1), "%d/%m/%Y").date()
            desc = m.group(2).strip()
            amount = self._clean_amount(m.group(3))
            is_credit = m.group(4) is not None

            # Skip reward points lines, IGST lines already in amounts
            if amount == 0:
                continue

            # Skip Merchant EMI conversion lines — these are internal EMI bookings, not real transactions
            if re.search(r'merchant\s+emi\s+conversion', desc, re.IGNORECASE):
                continue

            txn_type = "credit" if is_credit else "debit"
            transactions.append(ParsedTransaction(
                date=dt, description=desc, amount=amount,
                type=txn_type, account_name=card_name,
                bank="ICICI Bank", source="credit_card_pdf",
            ))
        return transactions

    def parse_emi_details(self, filepath: str) -> List[ParsedEmiDetail]:
        """Extract EMI details from the EMI / PERSONAL LOAN table in ICICI statements."""
        emi_details = []
        filename = filepath.split("\\")[-1].split("/")[-1]

        with pdfplumber.open(filepath) as pdf:
            full_text = "\n".join(p.extract_text() or "" for p in pdf.pages)

        card_name = self._detect_card_name(full_text, filename)

        with pdfplumber.open(filepath) as pdf:
            for page in pdf.pages:
                tables = page.extract_tables()
                for table in tables:
                    if not table or len(table) < 2:
                        continue
                    header = table[0]
                    if not header:
                        continue
                    header_text = " ".join(str(c) for c in header if c)
                    # Detect the EMI table by checking for key header columns
                    if "Installments" not in header_text or "EMI" not in header_text:
                        continue

                    for row in table[1:]:
                        if not row or not row[0]:
                            continue
                        try:
                            emi = self._parse_icici_emi_row(row, card_name)
                            if emi:
                                emi_details.append(emi)
                        except Exception:
                            continue
        return emi_details

    def _parse_icici_emi_row(self, row: list, card_name: str) -> ParsedEmiDetail | None:
        """Parse a single EMI row from ICICI EMI table.
        Columns: LoanType | Creation Date | Finish Date | No. of Installments |
                 EMI/Loan Amount | Pending Installments | Outstanding | Monthly Installment
        """
        product_name = str(row[0]).replace("\n", " ").strip()
        if not product_name:
            return None

        creation_date = str(row[1]).strip() if len(row) > 1 and row[1] else ""
        finish_date = str(row[2]).strip() if len(row) > 2 and row[2] else ""
        num_installments = int(str(row[3]).strip()) if len(row) > 3 and row[3] else 0
        loan_amount = self._clean_amount(str(row[4])) if len(row) > 4 and row[4] else 0.0
        pending = int(str(row[5]).strip()) if len(row) > 5 and row[5] else None
        outstanding = self._clean_amount(str(row[6])) if len(row) > 6 and row[6] else 0.0
        monthly_emi = self._clean_amount(str(row[7])) if len(row) > 7 and row[7] else 0.0

        return ParsedEmiDetail(
            account_name=card_name,
            bank="ICICI Bank",
            product_name=product_name,
            duration_months=num_installments,
            booking_month=creation_date,
            loan_expiry=finish_date,
            total_outstanding=outstanding,
            monthly_emi=monthly_emi,
            loan_amount=loan_amount,
            pending_installments=pending,
        )


class HDFCParser(BaseParser):
    """Parser for HDFC credit card statements (Swiggy, Regalia Gold, etc.)."""

    def can_parse(self, text: str, filename: str) -> bool:
        fname_lower = filename.lower()
        text_lower = text.lower()
        if "hdfc" in fname_lower or "swiggy" in fname_lower or "regalia" in fname_lower:
            return True
        if "hdfc bank credit card" in text_lower:
            return True
        return False

    def _detect_card_name(self, text: str, filename: str) -> str:
        fname_lower = filename.lower()
        if "swiggy" in fname_lower:
            return "HDFC Swiggy Card"
        if "regalia" in fname_lower:
            return "HDFC Regalia Gold Card"
        return "HDFC Card"

    def parse(self, filepath: str) -> List[ParsedTransaction]:
        transactions = []
        filename = filepath.split("\\")[-1].split("/")[-1]

        with pdfplumber.open(filepath) as pdf:
            full_text = "\n".join(p.extract_text() or "" for p in pdf.pages)

        card_name = self._detect_card_name(full_text, filename)

        # HDFC format: DD/MM/YYYY| HH:MM DESCRIPTION C AMOUNT [+/-]
        # The C prefix on amounts represents Rupee symbol in HDFC statements
        pattern = re.compile(
            r"(\d{2}/\d{2}/\d{4})\|\s*\d{2}:\d{2}\s+"
            r"(.+?)\s+"
            r"C\s*([\d,]+\.\d{2})[^\d\n]*",
            re.IGNORECASE,
        )
        for m in pattern.finditer(full_text):
            try:
                dt = datetime.strptime(m.group(1), "%d/%m/%Y").date()
                desc = m.group(2).strip()
                amount = self._clean_amount(m.group(3))

                if amount == 0:
                    continue

                # ADJ prefix = debit adjustment (e.g. ADJ 10% Swiggy BLCK Cashback),
                # regardless of whether the description contains "CASHBACK" etc.
                if desc.upper().startswith("ADJ"):
                    is_credit = False
                else:
                    # Explicit + or Cr marker in the line takes priority
                    line_start = full_text.rfind("\n", 0, m.start())
                    line_text = full_text[line_start:m.end()]
                    if "+ C" in line_text or "Cr" in line_text:
                        is_credit = True
                    else:
                        is_credit = any(kw in desc.upper() for kw in [
                            "PAYMENT", "CASHBACK", "REFUND", "CREDIT",
                        ])

                txn_type = "credit" if is_credit else "debit"
                transactions.append(ParsedTransaction(
                    date=dt, description=desc, amount=amount,
                    type=txn_type, account_name=card_name,
                    bank="HDFC Bank", source="credit_card_pdf",
                ))
            except Exception as e:
                logging.error(f"Failed to parse transaction: {e}")

        # Also try the non-time format: DD/MM/YYYY DESCRIPTION C AMOUNT
        if not transactions:
            pattern2 = re.compile(
                r"(\d{2}/\d{2}/\d{4})\s+"
                r"(.+?)\s+"
                r"C\s*([\d,]+\.\d{2})[^\d\n]*",
                re.IGNORECASE,
            )
            for m in pattern2.finditer(full_text):
                try:
                    dt = datetime.strptime(m.group(1), "%d/%m/%Y").date()
                    desc = m.group(2).strip()
                    amount = self._clean_amount(m.group(3))
                    if amount == 0:
                        continue
                    if desc.upper().startswith("ADJ"):
                        is_credit = False
                    else:
                        is_credit = any(kw in desc.upper() for kw in [
                            "PAYMENT", "CASHBACK", "REFUND", "CREDIT",
                        ])
                    txn_type = "credit" if is_credit else "debit"
                    transactions.append(ParsedTransaction(
                        date=dt, description=desc, amount=amount,
                        type=txn_type, account_name=card_name,
                        bank="HDFC Bank", source="credit_card_pdf",
                    ))
                except Exception as e:
                    logging.error(f"Failed to parse transaction: {e}")

        return transactions


class HSBCParser(BaseParser):
    """Parser for HSBC credit card statements."""

    def can_parse(self, text: str, filename: str) -> bool:
        return "hsbc" in filename.lower() or "hsbc" in text.lower()

    def parse(self, filepath: str) -> List[ParsedTransaction]:
        transactions = []
        with pdfplumber.open(filepath) as pdf:
            full_text = "\n".join(p.extract_text() or "" for p in pdf.pages)

        # Detect statement year from text
        year_match = re.search(r"(\d{2})\s+(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+(\d{4})", full_text)
        stmt_year = int(year_match.group(2)) if year_match else datetime.now().year

        # Pattern: DDMMM DESCRIPTION AMOUNT [CR]
        # e.g.: 09FEB IAP ZEPTONOW MUMBAI 1,300.00
        months_map = {"JAN": 1, "FEB": 2, "MAR": 3, "APR": 4, "MAY": 5, "JUN": 6,
                       "JUL": 7, "AUG": 8, "SEP": 9, "OCT": 10, "NOV": 11, "DEC": 12}
        pattern = re.compile(
            r"(\d{2})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+"
            r"(.+?)\s+"
            r"([\d,]+\.\d{2})\s*(CR)?",
            re.IGNORECASE,
        )
        # Matches installment detail lines like "1ST OF 6 INSTALLMENTS PRINCIPAL"
        installment_re = re.compile(
            r"\d+(?:ST|ND|RD|TH)\s+OF\s+\d+\s+INSTALLMENTS\s+\w+",
            re.IGNORECASE,
        )
        for m in pattern.finditer(full_text):
            day = int(m.group(1))
            month_num = months_map.get(m.group(2).upper(), 1)
            desc = m.group(3).strip()
            amount = self._clean_amount(m.group(4))
            is_credit = m.group(5) is not None

            dt = date(stmt_year, month_num, day)

            if amount == 0:
                continue

            # Check if the IMMEDIATELY NEXT line after this match is an installment
            # detail, e.g. "1ST OF 6 INSTALLMENTS PRINCIPAL".
            # Note: \s* in the pattern can consume a trailing \n, so m.end() may
            # already be at the start of the next line. Take the first non-empty
            # line from m.end() to find the true immediate successor.
            first_next = next(
                (ln.strip() for ln in full_text[m.end():].split('\n') if ln.strip()),
                "",
            )
            inst_m = installment_re.match(first_next)
            if inst_m:
                if is_credit:
                    # Skip the CR (accounting reversal) version of installment entries.
                    # HSBC shows each installment as a CR+debit pair; only the debit
                    # is the real monthly charge.
                    continue
                # Append installment detail to description for clarity and unique hashing
                desc = f"{desc} {inst_m.group(0).strip()}"
                is_credit = False  # installment charges are always debits

            # Skip summary/total lines
            if any(kw in desc.upper() for kw in ["TOTAL PURCHASE", "TOTAL CASH", "TOTAL BALANCE", "TOTAL LOAN", "NET OUTSTANDING"]):
                continue

            txn_type = "credit" if is_credit else "debit"
            transactions.append(ParsedTransaction(
                date=dt, description=desc, amount=amount,
                type=txn_type, account_name="HSBC Platinum Card",
                bank="HSBC", source="credit_card_pdf",
            ))
        return transactions


class SBIParser(BaseParser):
    """Parser for SBI credit card statements."""

    # Descriptions to skip — these are EMI installment breakdowns, not real transactions
    _EMI_SKIP_PATTERNS = re.compile(
        r"^(FP\s+EMI|INTEREST\s+ON\s+EMI|ENCASH\s+EMI|IGST\s+DB\s+@|TRANSFER\s+TO)",
        re.IGNORECASE,
    )

    def can_parse(self, text: str, filename: str) -> bool:
        return "sbi" in filename.lower() or ("sbi card" in text.lower() and "icici" not in text.lower())

    def parse(self, filepath: str) -> List[ParsedTransaction]:
        transactions = []
        with pdfplumber.open(filepath) as pdf:
            full_text = "\n".join(p.extract_text() or "" for p in pdf.pages)

        # Detect statement year
        year_match = re.search(r"Statement Date\s*\n?\s*(\d{1,2})\s+\w+\s+(\d{4})", full_text)
        stmt_year = int(year_match.group(2)) if year_match else datetime.now().year

        months_map = {"Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4, "May": 5, "Jun": 6,
                       "Jul": 7, "Aug": 8, "Sep": 9, "Oct": 10, "Nov": 11, "Dec": 12}
        # Extract standalone IGST/GST tax lines (preserve cents) before main parsing
        # Match percent (e.g. @ 18.00%) followed by amount (e.g. 427.34)
        igst_pat = re.compile(r"(IGST|GST).*?@.*?(?:\d+\.?\d*%?)\s*[,;:\-\s]*([\d,]+\.\d{2})", re.IGNORECASE)
        for im in igst_pat.finditer(full_text):
            amt_str = im.group(2)
            try:
                amt = self._clean_amount(amt_str)
            except Exception:
                amt = 0.0
            # Debug logging: record raw match and cleaned amount
            try:
                with open("backend/parser_debug.log", "a", encoding="utf-8") as df:
                    df.write(f"SBI IGST MATCH file={filename} raw={im.group(0)!r} amt_str={amt_str!r} cleaned={amt}\n")
            except Exception:
                pass

            # Heuristic: find nearest preceding date (DD Mon YY) within 200 chars
            start_pos = im.start()
            lookback = full_text[max(0, start_pos - 200): start_pos]
            dm = re.findall(r"(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{2})", lookback, re.IGNORECASE)
            if dm:
                try:
                    ddm = dm[-1]
                    dt = datetime.strptime(ddm, "%d %b %y").date()
                except Exception:
                    dt = date.today()
            else:
                dt = date.today()

            desc = im.group(0).strip()
            if amt > 0:
                transactions.append(ParsedTransaction(
                    date=dt,
                    description=desc,
                    amount=amt,
                    type="debit",
                    account_name="SBI Card",
                    bank="SBI",
                    source="credit_card_pdf",
                ))

        # Pattern: DD Mon YY DESCRIPTION AMOUNT D/C/M
        # e.g.: 31 Jan 26 STATEMENT DB - RP FORFEIT FOR CBK OFFER 56.00 D
        pattern = re.compile(
            r"(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{2})\s+"
            r"(.+?)\s+"
            r"([\d,]+\.\d{2})\s+([DCM])",
            re.IGNORECASE,
        )
        for m in pattern.finditer(full_text):
            day = int(m.group(1))
            month_num = months_map.get(m.group(2).title(), 1)
            year_short = int(m.group(3))
            year_full = 2000 + year_short
            desc = m.group(4).strip()
            amount = self._clean_amount(m.group(5))
            type_code = m.group(6).upper()

            dt = date(year_full, month_num, day)

            if amount == 0:
                continue

            # Skip EMI installment lines — these are not real spending transactions
            if type_code == "M" or self._EMI_SKIP_PATTERNS.search(desc):
                continue

            txn_type = "credit" if type_code == "C" else "debit"
            transactions.append(ParsedTransaction(
                date=dt, description=desc, amount=amount,
                type=txn_type, account_name="SBI Card",
                bank="SBI", source="credit_card_pdf",
            ))
        return transactions

    def parse_emi_details(self, filepath: str) -> List[ParsedEmiDetail]:
        """Extract EMI details from the VALUE ADDED SERVICES table."""
        emi_details = []
        with pdfplumber.open(filepath) as pdf:
            for page in pdf.pages:
                tables = page.extract_tables()
                for table in tables:
                    if not table or len(table) < 2:
                        continue
                    header = table[0]
                    # Detect the EMI details table by looking for "Product" + "Loan Expiry" columns
                    if not header or not any("Product" in str(c) for c in header if c):
                        continue
                    if not any("Expiry" in str(c) for c in header if c):
                        continue

                    for row in table[1:]:
                        if not row or not row[0]:
                            continue
                        try:
                            emi = self._parse_emi_row(row)
                            if emi:
                                emi_details.append(emi)
                        except Exception:
                            continue
        return emi_details

    def _parse_emi_row(self, row: list) -> ParsedEmiDetail | None:
        """Parse a single EMI detail row from VALUE ADDED SERVICES table."""
        product_cell = str(row[0]).strip()
        # e.g. "MERCHANT EMI(6 MONTHS)(Feb.'26)"
        product_match = re.match(
            r"(.+?)\((\d+)\s*MONTHS?\)\s*\((.+?)\)",
            product_cell, re.IGNORECASE,
        )
        if not product_match:
            return None

        product_name = product_match.group(1).strip()
        duration = int(product_match.group(2))
        booking_month = product_match.group(3).strip()

        expiry = str(row[1]).strip() if len(row) > 1 and row[1] else ""
        outstanding = self._clean_amount(str(row[2])) if len(row) > 2 and row[2] else 0.0

        # e.g. "21575.01(19240.89+2334.12)" (may have newlines)
        emi_cell = str(row[3]).replace("\n", "") if len(row) > 3 and row[3] else ""
        monthly_emi = 0.0
        principal = None
        interest = None
        emi_match = re.match(r"([\d,]+\.\d{2})\(([\d,]+\.\d{2})\+([\d,]+\.\d{2})\)", emi_cell.replace(",", ""))
        if emi_match:
            monthly_emi = float(emi_match.group(1))
            principal = float(emi_match.group(2))
            interest = float(emi_match.group(3))
        elif emi_cell:
            monthly_emi = self._clean_amount(emi_cell.split("(")[0])

        return ParsedEmiDetail(
            account_name="SBI Card",
            bank="SBI",
            product_name=product_name,
            duration_months=duration,
            booking_month=booking_month,
            loan_expiry=expiry,
            total_outstanding=outstanding,
            monthly_emi=monthly_emi,
            principal_component=principal,
            interest_component=interest,
        )


# Registry of all parsers
ALL_PARSERS = [
    ICICISavingsParser(),
    AirtelAxisParser(),
    AMXParser(),
    ICICIParser(),
    HDFCParser(),
    HSBCParser(),
    SBIParser(),
]


def detect_and_parse(filepath: str) -> ParseResult:
    """Auto-detect the bank format and parse the PDF."""
    import pdfplumber

    # Read first page text for detection
    with pdfplumber.open(filepath) as pdf:
        first_page_text = pdf.pages[0].extract_text() or ""

    filename = filepath.split("\\")[-1].split("/")[-1]

    for parser in ALL_PARSERS:
        if parser.can_parse(first_page_text, filename):
            transactions = parser.parse(filepath)
            # Extract EMI details if the parser supports it
            emi_details = []
            if hasattr(parser, "parse_emi_details"):
                emi_details = parser.parse_emi_details(filepath)
            return ParseResult(transactions=transactions, emi_details=emi_details)

    return ParseResult(transactions=[], emi_details=[])
