"""
Dashboard / analytics router.
"""
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.aggregator import (
    get_summary,
    get_by_category,
    get_monthly_trend,
    get_top_merchants,
    get_account_summary,
)

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/summary")
def summary(
    month: Optional[int] = Query(None),
    year: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    return get_summary(db, month, year)


@router.get("/by-category")
def by_category(
    month: Optional[int] = Query(None),
    year: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    return get_by_category(db, month, year)


@router.get("/monthly-trend")
def monthly_trend(
    year: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    return get_monthly_trend(db, year)


@router.get("/top-merchants")
def top_merchants(
    month: Optional[int] = Query(None),
    year: Optional[int] = Query(None),
    limit: int = Query(10),
    db: Session = Depends(get_db),
):
    return get_top_merchants(db, month, year, limit)


@router.get("/by-account")
def by_account(
    month: Optional[int] = Query(None),
    year: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    return get_account_summary(db, month, year)
