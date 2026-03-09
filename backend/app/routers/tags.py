"""
Tags management router — aggregate and update tag metadata across all transactions.
"""
import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.transaction_metadata import TransactionMetadata
from app.services.auto_tagger import run_auto_tag

router = APIRouter(prefix="/api/tags", tags=["tags"])


class TagTypeUpdate(BaseModel):
    type: str  # "manual" or "auto"


@router.get("")
def list_tags(db: Session = Depends(get_db)):
    """Return all unique tags with their type and transaction count."""
    rows = db.query(TransactionMetadata).filter(
        TransactionMetadata.tags.isnot(None),
        TransactionMetadata.tags != "",
    ).all()

    tag_counts: dict[str, int] = {}
    tag_types: dict[str, str] = {}

    for row in rows:
        raw_tags = row.tags or ""
        tag_names = [t.strip() for t in raw_tags.split(",") if t.strip()]

        # Parse tags_meta for type info
        type_map: dict[str, str] = {}
        try:
            meta_list = json.loads(row.tags_meta) if row.tags_meta else []
            type_map = {m["name"]: m["type"] for m in meta_list if isinstance(m, dict)}
        except Exception:
            pass

        for name in tag_names:
            tag_counts[name] = tag_counts.get(name, 0) + 1
            # Use the type from this row if not already tracked, or prefer "auto" if any row marks it auto
            existing = tag_types.get(name, "manual")
            row_type = type_map.get(name, "manual")
            # If any transaction marks it "auto", treat as auto globally
            tag_types[name] = "auto" if (existing == "auto" or row_type == "auto") else "manual"

    result = [
        {"name": name, "type": tag_types[name], "count": tag_counts[name]}
        for name in sorted(tag_counts.keys(), key=lambda n: tag_counts[n], reverse=True)
    ]
    return result


@router.post("/auto-tag")
def auto_tag_transactions(db: Session = Depends(get_db)):
    """Run keyword-based auto-tagging across all transactions."""
    result = run_auto_tag(db)
    return result


@router.patch("/{tag_name}")
def update_tag_type(tag_name: str, body: TagTypeUpdate, db: Session = Depends(get_db)):
    """Update the type of a tag across all transactions that use it."""
    if body.type not in ("manual", "auto"):
        raise HTTPException(400, "type must be 'manual' or 'auto'")

    rows = db.query(TransactionMetadata).filter(
        TransactionMetadata.tags.ilike(f"%{tag_name}%"),
    ).all()

    updated = 0
    for row in rows:
        tag_names = [t.strip() for t in (row.tags or "").split(",") if t.strip()]
        if tag_name not in tag_names:
            continue  # ilike may have false positives

        try:
            meta_list = json.loads(row.tags_meta) if row.tags_meta else []
        except Exception:
            meta_list = []

        # Ensure all current tags are represented in meta
        existing = {m["name"]: m["type"] for m in meta_list if isinstance(m, dict)}
        new_meta = [
            {"name": t, "type": body.type if t == tag_name else existing.get(t, "manual")}
            for t in tag_names
        ]
        row.tags_meta = json.dumps(new_meta)
        updated += 1

    db.commit()
    return {"tag": tag_name, "type": body.type, "updated_transactions": updated}


@router.delete("/{tag_name}")
def delete_tag(tag_name: str, db: Session = Depends(get_db)):
    """Remove a tag from all transactions that use it."""
    rows = db.query(TransactionMetadata).filter(
        TransactionMetadata.tags.ilike(f"%{tag_name}%"),
    ).all()

    updated = 0
    for row in rows:
        tag_names = [t.strip() for t in (row.tags or "").split(",") if t.strip()]
        if tag_name not in tag_names:
            continue

        new_tags = [t for t in tag_names if t != tag_name]
        row.tags = ",".join(new_tags)

        try:
            meta_list = json.loads(row.tags_meta) if row.tags_meta else []
        except Exception:
            meta_list = []
        row.tags_meta = json.dumps([m for m in meta_list if isinstance(m, dict) and m.get("name") != tag_name])
        updated += 1

    db.commit()
    return {"tag": tag_name, "removed_from_transactions": updated}
