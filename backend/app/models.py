from datetime import datetime, date
from sqlalchemy import String, Text, DateTime, Date, ForeignKey, Table, Column, Boolean, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

case_complaints = Table(
    "case_complaints", Base.metadata,
    Column("case_id", String(40), ForeignKey("cases.id", ondelete="CASCADE"), primary_key=True),
    Column("complaint_id", String(40), ForeignKey("complaints.id", ondelete="CASCADE"), primary_key=True),
)

class Institution(Base):
    __tablename__ = "institutions"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    name: Mapped[str] = mapped_column(String(250), index=True)
    institution_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    state: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    region: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(40), default="Active")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    complaints: Mapped[list["Complaint"]] = relationship(back_populates="institution")
    cases: Mapped[list["Case"]] = relationship(back_populates="institution")

class Officer(Base):
    __tablename__ = "officers"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    name: Mapped[str] = mapped_column(String(200), index=True)
    designation: Mapped[str | None] = mapped_column(String(150), nullable=True)
    bureau: Mapped[str] = mapped_column(String(30), index=True)
    email: Mapped[str | None] = mapped_column(String(250), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class Complaint(Base):
    __tablename__ = "complaints"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    institution_id: Mapped[str] = mapped_column(ForeignKey("institutions.id"), index=True)
    subject: Mapped[str] = mapped_column(String(300), index=True)
    description: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(120), index=True)
    status: Mapped[str] = mapped_column(String(50), default="Received", index=True)
    source: Mapped[str | None] = mapped_column(String(100), nullable=True)
    assigned_bureau: Mapped[str | None] = mapped_column(String(30), nullable=True, index=True)
    assigned_officer_id: Mapped[str | None] = mapped_column(ForeignKey("officers.id"), nullable=True)
    received_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    expected_disposal_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    review_status: Mapped[str] = mapped_column(String(50), default="Not reviewed")
    institution: Mapped["Institution"] = relationship(back_populates="complaints")
    cases: Mapped[list["Case"]] = relationship(secondary=case_complaints, back_populates="complaints")

class Case(Base):
    __tablename__ = "cases"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    institution_id: Mapped[str] = mapped_column(ForeignKey("institutions.id"), index=True)
    title: Mapped[str] = mapped_column(String(300))
    bureau: Mapped[str] = mapped_column(String(30), index=True)
    officer_id: Mapped[str | None] = mapped_column(ForeignKey("officers.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="Open", index=True)
    priority: Mapped[str] = mapped_column(String(30), default="Normal")
    opened_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    expected_disposal_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    next_action: Mapped[str | None] = mapped_column(Text, nullable=True)
    institution: Mapped["Institution"] = relationship(back_populates="cases")
    complaints: Mapped[list["Complaint"]] = relationship(secondary=case_complaints, back_populates="cases")
    actions: Mapped[list["CaseAction"]] = relationship(back_populates="case", cascade="all, delete-orphan")

class CaseAction(Base):
    __tablename__ = "case_actions"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    case_id: Mapped[str] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), index=True)
    action_type: Mapped[str] = mapped_column(String(100))
    previous_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    new_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    officer_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    case: Mapped["Case"] = relationship(back_populates="actions")

class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    title: Mapped[str] = mapped_column(String(250))
    message: Mapped[str] = mapped_column(Text)
    related_case_id: Mapped[str | None] = mapped_column(ForeignKey("cases.id"), nullable=True)
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class AuthUser(Base):
    __tablename__ = "auth_users"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    username: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(300))
    full_name: Mapped[str] = mapped_column(String(200))
    role: Mapped[str] = mapped_column(String(40), default="viewer", index=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    actor_user_id: Mapped[str | None] = mapped_column(String(40), nullable=True, index=True)
    actor_username: Mapped[str] = mapped_column(String(120), default="anonymous")
    action: Mapped[str] = mapped_column(String(20), index=True)
    resource: Mapped[str] = mapped_column(String(300), index=True)
    status_code: Mapped[int] = mapped_column(Integer)
    ip_address: Mapped[str | None] = mapped_column(String(80), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


class IssueGroup(Base):
    """Groups related complaints without deleting or merging their source records."""
    __tablename__ = "issue_groups"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    classification: Mapped[str] = mapped_column(String(40), default="Confirmed Related")
    primary_complaint_id: Mapped[str] = mapped_column(ForeignKey("complaints.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class IssueGroupComplaint(Base):
    __tablename__ = "issue_group_complaints"
    issue_group_id: Mapped[str] = mapped_column(ForeignKey("issue_groups.id", ondelete="CASCADE"), primary_key=True)
    complaint_id: Mapped[str] = mapped_column(ForeignKey("complaints.id", ondelete="CASCADE"), primary_key=True)
    linked_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class OverlapReviewRecord(Base):
    __tablename__ = "overlap_review_records"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    complaint_id: Mapped[str] = mapped_column(ForeignKey("complaints.id"), index=True)
    related_complaint_id: Mapped[str] = mapped_column(ForeignKey("complaints.id"), index=True)
    decision: Mapped[str] = mapped_column(String(40), index=True)
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    issue_group_id: Mapped[str | None] = mapped_column(ForeignKey("issue_groups.id"), nullable=True, index=True)
    reviewed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
