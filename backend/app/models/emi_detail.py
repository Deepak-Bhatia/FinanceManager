from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.sql import func

from app.database import Base


class EmiDetail(Base):
    __tablename__ = "emi_details"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)
    product_name = Column(String, nullable=False)  # e.g. "MERCHANT EMI"
    duration_months = Column(Integer, nullable=False)  # e.g. 6
    booking_month = Column(String, nullable=True)  # e.g. "Feb.'26"
    loan_expiry = Column(String, nullable=True)  # e.g. "Aug 26"
    total_outstanding = Column(Float, nullable=True)
    monthly_emi = Column(Float, nullable=True)
    principal_component = Column(Float, nullable=True)
    interest_component = Column(Float, nullable=True)
    loan_amount = Column(Float, nullable=True)  # total EMI/Loan amount
    pending_installments = Column(Integer, nullable=True)
    source_file = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
