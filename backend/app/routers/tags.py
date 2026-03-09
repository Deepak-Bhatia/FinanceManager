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


class TagPatch(BaseModel):
    type: Optional[str] = None   # "manual" or "auto"
    color: Optional[str] = None  # hex string e.g. "#ef4444", or "" to reset to default


@router.get("")
def list_tags(db: Session = Depends(get_db)):
    """Return all unique tags with their type, color, and transaction count."""
    rows = db.query(TransactionMetadata).filter(
        TransactionMetadata.tags.isnot(None),
        TransactionMetadata.tags != "",
    ).all()

    tag_counts: dict[str, int] = {}
    tag_types: dict[str, str] = {}
    tag_colors: dict[str, str] = {}

    for row in rows:
        raw_tags = row.tags or ""
        tag_names = [t.strip() for t in raw_tags.split(",") if t.strip()]

        meta_by_name: dict[str, dict] = {}
        try:
            meta_list = json.loads(row.tags_meta) if row.tags_meta else []
            meta_by_name = {m["name"]: m for m in meta_list if isinstance(m, dict)}
        except Exception:
            pass

        for name in tag_names:
            tag_counts[name] = tag_counts.get(name, 0) + 1

            meta = meta_by_name.get(name, {})
            row_type = meta.get("type", "manual")
            existing_type = tag_types.get(name, "manual")
            tag_types[name] = "auto" if (existing_type == "auto" or row_type == "auto") else "manual"

            # First non-empty color wins
            if name not in tag_colors:
                row_color = meta.get("color", "")
                if row_color:
                    tag_colors[name] = row_color

    result = [
        {
            "name": name,
            "type": tag_types[name],
            "color": tag_colors.get(name) or None,
            "count": tag_counts[name],
        }
        for name in sorted(tag_counts.keys(), key=lambda n: tag_counts[n], reverse=True)
    ]
    return result


@router.post("/auto-tag")
def auto_tag_transactions(db: Session = Depends(get_db)):
    """Run keyword-based auto-tagging across all transactions."""
    result = run_auto_tag(db)
    return result


@router.patch("/{tag_name}")
def update_tag(tag_name: str, body: TagPatch, db: Session = Depends(get_db)):
    """Update the type and/or color of a tag across all transactions that use it."""
    if body.type is not None and body.type not in ("manual", "auto"):
        raise HTTPException(400, "type must be 'manual' or 'auto'")

    set_fields = body.model_fields_set  # which fields were explicitly sent

    rows = db.query(TransactionMetadata).filter(
        TransactionMetadata.tags.ilike(f"%{tag_name}%"),
    ).all()

    updated = 0
    for row in rows:
        tag_names = [t.strip() for t in (row.tags or "").split(",") if t.strip()]
        if tag_name not in tag_names:
            continue

        try:
            meta_list = json.loads(row.tags_meta) if row.tags_meta else []
        except Exception:
            meta_list = []

        existing_by_name = {m["name"]: m for m in meta_list if isinstance(m, dict)}

        new_meta = []
        for t in tag_names:
            prev = existing_by_name.get(t, {})
            entry: dict = {"name": t, "type": prev.get("type", "manual")}
            if prev.get("color"):
                entry["color"] = prev["color"]

            if t == tag_name:
                if "type" in set_fields and body.type is not None:
                    entry["type"] = body.type
                if "color" in set_fields:
                    if body.color:
                        entry["color"] = body.color
                    else:
                        entry.pop("color", None)  # reset to default

            new_meta.append(entry)

        row.tags_meta = json.dumps(new_meta)
        updated += 1

    db.commit()
    return {"tag": tag_name, "updated_transactions": updated}


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
