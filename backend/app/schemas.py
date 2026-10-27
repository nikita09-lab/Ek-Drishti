from datetime import datetime, date
from pydantic import BaseModel, ConfigDict, Field

class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)

class InstitutionCreate(BaseModel):
    name: str = Field(min_length=2, max_length=250)
    institution_type: str | None = None
    address: str | None = None
    state: str | None = None
    region: str | None = None
    status: str = "Active"

class InstitutionOut(ORMModel):
    id: str
    name: str
    institution_type: str | None
    address: str | None
    state: str | None
    region: str | None
    status: str
    created_at: datetime

class ComplaintCreate(BaseModel):
    institution_id: str
    subject: str = Field(min_length=3, max_length=300)
    description: str = Field(min_length=3)
    category: str
    source: str | None = "Internal"
    assigned_bureau: str | None = None
    assigned_officer_id: str | None = None
    expected_disposal_date: date | None = None

class ComplaintOut(ORMModel):
    id: str
    institution_id: str
    subject: str
    description: str
    category: str
    status: str
    source: str | None
    assigned_bureau: str | None
    assigned_officer_id: str | None
    received_at: datetime
    expected_disposal_date: date | None
    review_status: str

class CaseCreate(BaseModel):
    institution_id: str
    title: str
    bureau: str
    officer_id: str | None = None
    status: str = "Open"
    priority: str = "Normal"
    expected_disposal_date: date | None = None
    next_action: str | None = None
    complaint_ids: list[str] = []

class CaseOut(ORMModel):
    id: str
    institution_id: str
    title: str
    bureau: str
    officer_id: str | None
    status: str
    priority: str
    opened_at: datetime
    expected_disposal_date: date | None
    next_action: str | None

class ActionCreate(BaseModel):
    action_type: str = "Update"
    new_status: str | None = None
    remarks: str | None = None
    officer_name: str | None = None

class OfficerCreate(BaseModel):
    name: str
    designation: str | None = None
    bureau: str
    email: str | None = None

class OfficerOut(ORMModel):
    id: str
    name: str
    designation: str | None
    bureau: str
    email: str | None
    active: bool

class OverlapReview(BaseModel):
    complaint_id: str
    related_complaint_id: str
    decision: str
    remarks: str | None = Field(default=None, max_length=4000)

class LoginRequest(BaseModel):
    username: str
    password: str
    portal: str | None = None

class AuthUserInfo(BaseModel):
    id: str
    username: str
    full_name: str
    role: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    portal: str
    portal_title: str
    user: AuthUserInfo

class PortalOut(BaseModel):
    id: str
    title: str
    badge: str
    description: str
    allowed_roles: list[str]
    endpoint: str

