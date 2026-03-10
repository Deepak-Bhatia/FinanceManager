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
    get_by_tag,
    get_recurring_vs_impulsive,
    get_uncategorized_top,
)

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/summary")
def summary(
    month: Optional[int] = Query(None),
    year: Optional[int] = Query(None),
    hide_ignored: bool = Query(True),
    db: Session = Depends(get_db),
):
    return get_summary(db, month, year, hide_ignored)


@router.get("/by-category")
def by_category(
    month: Optional[int] = Query(None),
    year: Optional[int] = Query(None),
    hide_ignored: bool = Query(True),
    db: Session = Depends(get_db),
):
    return get_by_category(db, month, year, hide_ignored)


@router.get("/monthly-trend")
def monthly_trend(
    year: Optional[int] = Query(None),
    hide_ignored: bool = Query(True),
    db: Session = Depends(get_db),
):
    return get_monthly_trend(db, year, hide_ignored)


@router.get("/top-merchants")
def top_merchants(
    month: Optional[int] = Query(None),
    year: Optional[int] = Query(None),
    limit: int = Query(10),
    hide_ignored: bool = Query(True),
    db: Session = Depends(get_db),
):
    return get_top_merchants(db, month, year, limit, hide_ignored)


@router.get("/by-account")
def by_account(
    month: Optional[int] = Query(None),
    year: Optional[int] = Query(None),
    hide_ignored: bool = Query(True),
    db: Session = Depends(get_db),
):
    return get_account_summary(db, month, year, hide_ignored)


@router.get("/by-tag")
def by_tag(
    month: Optional[int] = Query(None),
    year: Optional[int] = Query(None),
    hide_ignored: bool = Query(True),
    db: Session = Depends(get_db),
):
    return get_by_tag(db, month, year, hide_ignored)


@router.get("/recurring-vs-impulsive")
def recurring_vs_impulsive(
    month: Optional[int] = Query(None),
    year: Optional[int] = Query(None),
    hide_ignored: bool = Query(True),
    db: Session = Depends(get_db),
):
    return get_recurring_vs_impulsive(db, month, year, hide_ignored)


@router.get("/uncategorized-top")
def uncategorized_top(
    month: Optional[int] = Query(None),
    year: Optional[int] = Query(None),
    hide_ignored: bool = Query(True),
    limit: int = Query(10),
    db: Session = Depends(get_db),
):
    return get_uncategorized_top(db, month, year, hide_ignored, limit)
