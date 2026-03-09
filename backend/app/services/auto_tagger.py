"""
Auto-tagger service — applies keyword-based rules to transaction descriptions
and assigns tags with type="auto".

Rules:
  - Manual tags are never removed or overridden
  - Auto tags are fully replaced on each run (re-evaluated from scratch)
  - Each rule maps a tag name to a list of case-insensitive regex patterns
"""
import json
import re
from typing import Optional
from sqlalchemy.orm import Session

from app.models.transaction import Transaction
from app.models.transaction_metadata import TransactionMetadata

# ─────────────────────────────────────────────
# Tag rules: tag_name → list of regex patterns
# Patterns are matched case-insensitively anywhere in the description.
# ─────────────────────────────────────────────
TAG_RULES: list[tuple[str, list[str]]] = [
    # ── Food delivery ─────────────────────────────────────────────────────────
    ("food", [
        r"SWIGGY",
        r"BUNDL\s*TECH",       # Swiggy parent company
        r"PTM\*SWIGGY",
        r"PYU\*Swiggy\s*Food",
        r"RSP\*SWIGGY",
        r"ZOMATO",
        r"MCDONALD",
        r"DOMINOS?",
        r"PIZZA\s*HUT",
        r"KFC",
        r"BURGER\s*KING",
        r"HALDIRAM",
        r"SATYA\s*FOOD",
        r"JSB.*SNACKS",
        r"AVS\s*SWEETS.*RESTAU",
        r"LICIOUS",            # fresh meat delivery
        r"BARBEQUENA",
        r"NAMASTE\s*MIDWAY",
        r"HIRA\s*SWEETS",
    ]),

    # ── Restaurant / Dining out ────────────────────────────────────────────────
    ("dining", [
        r"LAKSHMI.*SOUTH.*INDIAN",
        r"LAXMI.*SOUTH.*INDIAN",
        r"SOUTH\s*INDIAN",
        r"RESTAURANT",
        r"DINEOUT",
        r"SWIGGY\s*DINEOUT",
        r"KAMATHS\s*NATURAL",
        r"ICICI\*SHAHEED\s*CHAMAN",
    ]),

    # ── Grocery ───────────────────────────────────────────────────────────────
    ("grocery", [
        r"GROCERY",
        r"ZEPTO",               # also covers ZEPTONOW
        r"INSTAMART",
        r"BIGBASKET",
        r"BLINKIT",
        r"815\s*MILK\s*SHOP",
        r"SINGHAL\s*DEPARTMENTAL",
        r"APNA\s*BAZAR",
        r"MILK\s*SHOP",
        r"DEPARTMENTAL\s*STORE",
        r"GENERAL\s*STORE",
        r"SANTOSH\s*GENERAL",
        r"MANOJ\s*STORE",
    ]),

    # ── Online Shopping ───────────────────────────────────────────────────────
    ("shopping", [
        r"AMAZON\s*PAY\s*IN\s*E\s*COMMERC",
        r"AMAZON\s*PAY\s*INDIA",
        r"AMAZON\s*Mumbai",
        r"FLIPKART",
        r"MYNTRA",
        r"NYKAA",
        r"FIRSTCRY",
        r"DECATHLON",
        r"AJIO",
        r"MEESHO",
        r"SNAPDEAL",
        r"SHOPPERS\s*STOP",
        r"PANTALOONS",
        r"GYFTR",
        r"MR\s*DIY",
        r"GLOBAL.*CAR.*ACCESS",
        r"NATURALS.*MALL",
        r"P116.*LOGIX",
        r"AJAY.*MOBILE.*ACCESS",
    ]),

    # ── Transport / Ride-sharing ───────────────────────────────────────────────
    ("transport", [
        r"UBER\s*INDIA",
        r"OLA\s*(CABS|ELECTRIC)?",
        r"RAPIDO",
        r"IRCTC",
        r"RAILWAY",
        r"HRTC",
        r"HIMACHAL\s*ROAD\s*TRANSPO",
        r"KSRTC",
        r"REDBUS",
        r"METRO",
        r"INDIGO",
        r"SPICEJET",
        r"MAKEMYTRIP",
        r"GOIBIBO",
    ]),

    # ── Fuel ──────────────────────────────────────────────────────────────────
    ("fuel", [
        r"PETROL",
        r"DIESEL",
        r"SHAHEED\s*CHAMAN\s*PETROL",
        r"NIRMAL\s*PITAMBARE\s*HP",
        r"HP\s*C\s+",           # HP petrol station abbreviation
        r"BPCL",
        r"HPCL",
        r"IOCL?",
        r"CONVENIENCE\s*FEE\s*ON\s*FUEL",
        r"FUEL",
    ]),

    # ── Healthcare ────────────────────────────────────────────────────────────
    ("health", [
        r"HOSPITAL",
        r"HEALTHCARE",
        r"MEDICARE",
        r"PHARMACY",
        r"MEDICAL\s*STORE",
        r"MEDPLUS",
        r"APOLLO",
        r"NETMEDS",
        r"PRACTO",
        r"1MG",
        r"CLINIC",
        r"KAILASH.*HEALTH",
        r"UMA\s*MEDICARE",
        r"VERMA\s*MEDICAL",
        r"RBL\*KRISHNARPAN",
        r"KAILASH.*HOSPITAL",
        r"KAILASH.*HEART",
    ]),

    # ── Tech / SaaS / Cloud ───────────────────────────────────────────────────
    ("tech", [
        r"GOOGLECLOUD",
        r"GOOGLE\s*CLOUD",
        r"GITHUB",
        r"OPENAI",
        r"GOOGLEPLAY",
        r"GOOGLE\s*PLAY",
        r"AWS\b",
        r"AZURE",
        r"DIGITALOCEAN",
        r"CLOUDFLARE",
        r"INFINITY\s*TECH",
    ]),

    # ── Entertainment ─────────────────────────────────────────────────────────
    ("entertainment", [
        r"BIGTREE",
        r"BOOKMYSHOW",
        r"PVR",
        r"INOX",
        r"NETFLIX",
        r"HOTSTAR",
        r"PRIME\s*VIDEO",
        r"SPOTIFY",
        r"DISNEY",
        r"AMAZON\s*PRIME",
        r"YOUTUBE\s*PREMIUM",
        r"APPLE\s*TV",
    ]),

    # ── Telecom / Recharge ────────────────────────────────────────────────────
    ("telecom", [
        r"AIRTEL",
        r"MYJIO",
        r"\bJIO\b",
        r"VODAFONE",
        r"BSNL",
        r"GPAY\s*RECHARGE",
        r"RECHARGE",
        r"DTH",
        r"CASHBACK.*TELECOM",
        r"BROADBAND",
    ]),

    # ── Finance / Investment ──────────────────────────────────────────────────
    ("investment", [
        r"MUTUAL\s*FUND",
        r"\bSIP\b",
        r"ZERODHA",
        r"GROWW",
        r"NAVI\b",
        r"PAYTM\s*MONEY",
        r"INVESTMENT",
        r"RECURRING\s*DEPOSIT",
    ]),

    # ── EMI / Loan ────────────────────────────────────────────────────────────
    ("emi", [
        r"\bEMI\b",
        r"INSTALLMENT",
        r"AMORTIZATION",
        r"MERCHANT\s*EMI",
    ]),

    # ── Laundry / Home services ───────────────────────────────────────────────
    ("services", [
        r"DHOBILITE",
        r"URBAN\s*COMPANY",
        r"HOUSEJOY",
    ]),

    # ── Self Transfers ────────────────────────────────────────────────────────
    ("self-transfer", [
        r"FUND\s*TRANSFER.*SELF",
        r"SELF\s*TRANSFER",
        r"TRANSFER\s*TO\s*SELF",
    ]),

    # ── Kids / Baby ───────────────────────────────────────────────────────────
    ("kids", [
        r"FIRSTCRY",
        r"JUNGLEE",
        r"HOPSCOTCH",
    ]),

    # ── Cashback / Rewards ────────────────────────────────────────────────────
    ("cashback", [
        r"CASHBACK",
        r"REWARD\s*REDEMPTION",
        r"MANUFACTURER\s*CASHBACK",
    ]),
]

# Pre-compile patterns for performance
_COMPILED_RULES: list[tuple[str, list[re.Pattern]]] = [
    (tag, [re.compile(p, re.IGNORECASE) for p in patterns])
    for tag, patterns in TAG_RULES
]


def _get_auto_tags(description: str) -> list[str]:
    """Return list of tag names whose patterns match the description."""
    matched = []
    seen = set()
    for tag, patterns in _COMPILED_RULES:
        if tag in seen:
            continue
        for pat in patterns:
            if pat.search(description):
                matched.append(tag)
                seen.add(tag)
                break
    return matched


def run_auto_tag(db: Session) -> dict:
    """
    Apply auto-tagging rules to ALL transactions.

    Strategy:
    - For each transaction, compute which tags should be auto-applied.
    - Replace all existing 'auto' tags with the newly computed ones.
    - Manual tags are never touched.
    - Returns summary stats.
    """
    transactions = db.query(Transaction).all()

    stats: dict[str, int] = {}
    total_tagged = 0
    total_updated = 0

    for txn in transactions:
        desc = txn.description or ""
        auto_tags = _get_auto_tags(desc)

        # Get or create metadata
        meta = txn.metadata_record
        if not meta:
            if not auto_tags:
                continue
            meta = TransactionMetadata(transaction_hash=txn.transaction_hash)
            db.add(meta)
            db.flush()

        # Parse existing tags_meta
        existing_meta: list[dict] = []
        try:
            existing_meta = json.loads(meta.tags_meta) if meta.tags_meta else []
        except Exception:
            existing_meta = []

        # Separate manual and auto tags
        manual_entries = [m for m in existing_meta if isinstance(m, dict) and m.get("type") == "manual"]
        manual_names = {m["name"] for m in manual_entries}

        # Build new tags: manual entries unchanged + new auto entries
        new_auto_entries = [
            {"name": t, "type": "auto"}
            for t in auto_tags
            if t not in manual_names  # skip if user manually tagged it
        ]
        new_meta = manual_entries + new_auto_entries

        # Track stats
        for t in auto_tags:
            if t not in manual_names:
                stats[t] = stats.get(t, 0) + 1

        # Merge tag string
        all_tag_names = list(manual_names) + [e["name"] for e in new_auto_entries]
        new_tags_str = ",".join(all_tag_names) if all_tag_names else None

        # Only write if something changed
        old_tags_str = meta.tags or ""
        old_meta_str = meta.tags_meta or ""
        new_meta_str = json.dumps(new_meta)

        if new_tags_str != old_tags_str or new_meta_str != old_meta_str:
            meta.tags = new_tags_str
            meta.tags_meta = new_meta_str
            total_updated += 1

        if auto_tags:
            total_tagged += 1

    db.commit()

    return {
        "total_processed": len(transactions),
        "transactions_with_auto_tags": total_tagged,
        "transactions_updated": total_updated,
        "tags_applied": dict(sorted(stats.items(), key=lambda x: x[1], reverse=True)),
    }
