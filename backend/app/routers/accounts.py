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


class AccountPatch(BaseModel):
    glyph: Optional[str] = None


@router.patch("/{account_id}")
def patch_account(account_id: int, body: AccountPatch, db: Session = Depends(get_db)):
    acct = db.get(Account, account_id)
    if not acct:
        raise HTTPException(404, "Account not found")
    if body.glyph is not None:
        acct.glyph = body.glyph if body.glyph.strip() else None
    db.commit()
    db.refresh(acct)
    return {"id": acct.id, "name": acct.name, "glyph": acct.glyph}
