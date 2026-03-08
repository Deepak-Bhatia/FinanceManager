"""
Categories & categorization rules router.
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.category import Category
from app.models.categorization_rule import CategorizationRule
from app.services.categorizer import recategorize_all

router = APIRouter(prefix="/api/categories", tags=["categories"])


class CategoryCreate(BaseModel):
    name: str
    color: Optional[str] = "#6B7280"
    icon: Optional[str] = None


class RuleCreate(BaseModel):
    keyword: str
    category_id: int
    priority: int = 0


@router.get("")
def list_categories(db: Session = Depends(get_db)):
    cats = db.query(Category).order_by(Category.name).all()
    return [{"id": c.id, "name": c.name, "color": c.color, "icon": c.icon} for c in cats]


@router.post("")
def create_category(body: CategoryCreate, db: Session = Depends(get_db)):
    cat = Category(name=body.name, color=body.color, icon=body.icon)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return {"id": cat.id, "name": cat.name, "color": cat.color, "icon": cat.icon}


@router.get("/rules")
def list_rules(db: Session = Depends(get_db)):
    rules = db.query(CategorizationRule).order_by(CategorizationRule.priority.desc()).all()
    return [
        {"id": r.id, "keyword": r.keyword, "category_id": r.category_id, "priority": r.priority}
        for r in rules
    ]


@router.post("/rules")
def create_rule(body: RuleCreate, db: Session = Depends(get_db)):
    rule = CategorizationRule(keyword=body.keyword, category_id=body.category_id, priority=body.priority)
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return {"id": rule.id, "keyword": rule.keyword, "category_id": rule.category_id, "priority": rule.priority}


@router.delete("/rules/{rule_id}")
def delete_rule(rule_id: int, db: Session = Depends(get_db)):
    rule = db.query(CategorizationRule).get(rule_id)
    if not rule:
        raise HTTPException(404, "Rule not found")
    db.delete(rule)
    db.commit()
    return {"deleted": True}


@router.post("/recategorize")
def recategorize(db: Session = Depends(get_db)):
    """Re-apply all rules to uncategorized transactions."""
    count = recategorize_all(db)
    return {"updated": count}
