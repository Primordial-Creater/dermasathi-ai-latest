from sqlalchemy import CheckConstraint, Index, func
from sqlalchemy import Column, Integer, String, Boolean, DateTime
from datetime import datetime, timezone
from app.db.base import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    preferred_language = Column(String(10), default="en", nullable=False)
    timezone_name = Column(String(64), nullable=False, default="Asia/Kolkata", server_default="Asia/Kolkata")
    role = Column(String(50), default="patient", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
    __table_args__ = (
        Index(
            "uq_users_email_normalized",
            func.lower(func.btrim(email)),
            unique=True,
        ),
        CheckConstraint(
            "length(btrim(timezone_name)) > 0",
            name="ck_users_timezone_name_nonempty",
        ),
    )
