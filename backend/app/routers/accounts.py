"""
Accounts router — generic account management endpoints.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.account import Account

router = APIRouter(prefix="/api/accounts", tags=["accounts"])


@router.get("")
def list_accounts(type: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(Account)
    if type:
        types = [t.strip() for t in type.split(',') if t.strip()]
        if types:
            q = q.filter(Account.type.in_(types))
    return [
        {"id": a.id, "name": a.name, "type": a.type, "bank": a.bank, "glyph": a.glyph, "nickname": a.nickname}
        for a in q.order_by(Account.name).all()
    ]


class AccountPatch(BaseModel):
    glyph: Optional[str] = None
    nickname: Optional[str] = None


@router.patch("/{account_id}")
def patch_account(account_id: int, body: AccountPatch, db: Session = Depends(get_db)):
    acct = db.get(Account, account_id)
    if not acct:
        raise HTTPException(404, "Account not found")
    if body.glyph is not None:
        acct.glyph = body.glyph if body.glyph.strip() else None
    if body.nickname is not None:
        acct.nickname = body.nickname.strip() if body.nickname.strip() else None
    db.commit()
    db.refresh(acct)
    return {"id": acct.id, "name": acct.name, "glyph": acct.glyph, "nickname": acct.nickname}
