from contextlib import asynccontextmanager
from datetime import datetime, date
from difflib import SequenceMatcher
from fastapi import FastAPI, Depends, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import select, func, or_

from app.config import settings
from app.database import Base, engine, get_db
from app import models, schemas
from app.ids import new_id
from app.security import hash_password, verify_password, create_access_token, decode_token, extract_bearer_token
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.openapi.utils import get_openapi


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.app_env.lower() == "production":
        if settings.jwt_secret == "CHANGE_THIS_SECRET_BEFORE_PRODUCTION" or len(settings.jwt_secret) < 32:
            raise RuntimeError("Set a unique JWT_SECRET of at least 32 characters before production startup.")
        if "*" in settings.origins:
            raise RuntimeError("Wildcard CORS origins are not allowed in production.")
    Base.metadata.create_all(bind=engine)
    # Optional bootstrap administrator; set a strong password in .env before first startup.
    if settings.bootstrap_admin_password:
        from app.database import SessionLocal
        with SessionLocal() as db:
            admin = db.scalar(select(models.AuthUser).where(models.AuthUser.username == settings.bootstrap_admin_username))
            if not admin:
                db.add(models.AuthUser(id=new_id("USR"), username=settings.bootstrap_admin_username,
                    password_hash=hash_password(settings.bootstrap_admin_password),
                    full_name="System Administrator", role="admin", active=True))
                db.commit()
    yield

app = FastAPI(
    title="AICTE OneView API",
    description="Institution complaint and case monitoring API. Bureau recommendations are advisory only.",
    version="0.1.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$" if settings.app_env.lower() != "production" else None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer(auto_error=False)

def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    openapi_schema = get_openapi(
        title="AICTE OneView API",
        version="0.1.0",
        description=(
            "Institution complaint and case monitoring API. Bureau recommendations are advisory only.\n\n"
            "### How to Authenticate & Save Bearer Token in Swagger UI (/docs):\n"
            "1. Run `/api/auth/login` (or one of the dedicated portal login endpoints) with your credentials.\n"
            "2. Copy the `access_token` string from the JSON response.\n"
            "3. Click the green **Authorize 🔓** button at the top-right of this page.\n"
            "4. Paste your token (with or without 'Bearer ' prefix) and click **Authorize**.\n"
            "5. Swagger UI will save this Bearer token in memory and automatically include it with all subsequent API requests!"
        ),
        routes=app.routes,
    )
    components = openapi_schema.setdefault("components", {})
    components["securitySchemes"] = {
        "BearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
            "description": "Enter your JWT token obtained from /api/auth/login. Swagger UI will automatically attach 'Authorization: Bearer <token>' to all requests."
        }
    }
    # Attach BearerAuth globally so Swagger UI saves and applies it to all requests
    openapi_schema["security"] = [{"BearerAuth": []}]
    app.openapi_schema = openapi_schema
    return app.openapi_schema

app.openapi = custom_openapi

@app.middleware("http")
async def security_and_audit_middleware(request: Request, call_next):
    # Allow CORS preflight requests to proceed immediately to CORSMiddleware
    if request.method.upper() == "OPTIONS":
        return await call_next(request)

    path = request.url.path

    # Support endpoints requested with or without /api/ prefix (e.g. /dashboard/summary -> /api/dashboard/summary)
    if not path.startswith("/api/") and path not in {"/", "/docs", "/openapi.json", "/redoc"}:
        api_equivalent = f"/api{path}"
        if any(getattr(r, "path", None) == api_equivalent for r in request.app.routes):
            request.scope["path"] = api_equivalent
            path = api_equivalent

    user = None
    # Fail closed for API access in every environment. Health, portal metadata, and login endpoints are public.
    is_public = (
        path == "/api/health"
        or path == "/api/auth/portals"
        or path.startswith("/api/auth/login")
    )
    if path.startswith("/api/") and not is_public:

        from starlette.responses import JSONResponse
        raw_auth = request.headers.get("authorization")
        query_token = request.query_params.get("token")
        token = extract_bearer_token(raw_auth, query_token)
        if not token:
            return JSONResponse(
                {
                    "detail": "Authentication required. Please click the green 'Authorize' button in /docs or provide an 'Authorization: Bearer <token>' header."
                },
                status_code=401
            )
        try:
            claims = decode_token(token)
        except HTTPException as exc:
            return JSONResponse({"detail": exc.detail}, status_code=exc.status_code)
        # Re-check current user state and role so deactivation/role changes take effect immediately.
        try:
            from app.database import SessionLocal
            with SessionLocal() as auth_db:
                auth_user = auth_db.scalar(select(models.AuthUser).where(models.AuthUser.id == claims.get("sub")))
                if not auth_user or not auth_user.active:
                    return JSONResponse({"detail": "Account is inactive or no longer exists"}, status_code=401)
                user = {
                    "sub": auth_user.id,
                    "username": auth_user.username,
                    "full_name": auth_user.full_name,
                    "role": auth_user.role
                }
                # Attach to request state for downstream handlers
                request.state.user = user
                request.state.auth_user = auth_user
        except Exception:
            return JSONResponse({"detail": "Authentication service unavailable"}, status_code=503)
        role = user.get("role", "viewer")
        method = request.method.upper()
        admin_only = path.startswith("/api/admin/") or path.startswith("/api/auth/users")
        write_roles = {"admin", "bureau_head", "officer", "case_manager", "institution"}
        if admin_only and role != "admin":
            return JSONResponse({"detail": "Administrator role required"}, status_code=403)
        if method in {"POST", "PUT", "PATCH", "DELETE"} and role not in write_roles:
            return JSONResponse({"detail": "Your role does not permit this action"}, status_code=403)
    response = await call_next(request)
    # Audit writes and auth events. Never record passwords, request bodies, or bearer tokens.
    if path.startswith("/api/") and (
        request.method.upper() in {"POST","PUT","PATCH","DELETE"}
        or (path.startswith("/api/auth/login") and response.status_code != 200)
    ):
        try:
            from app.database import SessionLocal
            with SessionLocal() as db:
                db.add(models.AuditLog(id=new_id("AUD"), actor_user_id=(user or {}).get("sub"),
                    actor_username=(user or {}).get("username","anonymous"), action=request.method.upper(),
                    resource=path[:300], status_code=response.status_code,
                    ip_address=(request.client.host if request.client else None)))
                db.commit()
        except Exception:
            # Request result should not be replaced by audit-log failure; monitor this in deployment.
            pass
    return response

@app.get("/", include_in_schema=False)
def root():
    return {
        "name": "AICTE OneView API",
        "docs": "/docs",
        "health": "/api/health",
        "portals": "/api/auth/portals",
    }

@app.get("/api/health", tags=["System"])
def health():
    return {"status": "ok", "timestamp": datetime.now().astimezone().isoformat()}

# Portal Role Configurations & Metadata
PORTAL_CONFIG = {
    "aicte_official": {
        "title": "AICTE Officials (Administration)",
        "badge": "Administration",
        "description": "Official access for AICTE leadership, directors, and bureau heads to monitor nationwide cases and escalations.",
        "allowed_roles": ["admin", "bureau_head"],
        "endpoint": "/api/auth/login/aicte-official",
    },
    "bureau_officer": {
        "title": "Bureau Officers",
        "badge": "RB & PGRC Officers",
        "description": "Operational portal for assigned Regulation Bureau (RB) and PGRC officers managing complaints.",
        "allowed_roles": ["officer", "case_manager", "bureau_head", "admin"],
        "endpoint": "/api/auth/login/bureau-officer",
    },
    "system_admin": {
        "title": "System Admin",
        "badge": "IT & Security",
        "description": "Administrative access for technical administrators managing database configurations, audit logs, and security.",
        "allowed_roles": ["admin"],
        "endpoint": "/api/auth/login/system-admin",
    },
    "institution": {
        "title": "Institution",
        "badge": "Colleges & Universities",
        "description": "Institutional portal for technical colleges, polytechnics, and universities to track cases and compliance.",
        "allowed_roles": ["institution", "viewer", "admin"],
        "endpoint": "/api/auth/login/institution",
    },
}

PORTAL_ALIASES = {
    "official": "aicte_official",
    "officials": "aicte_official",
    "administration": "aicte_official",
    "aicte": "aicte_official",
    "aicte-official": "aicte_official",
    "aicte_official": "aicte_official",
    "officer": "bureau_officer",
    "officers": "bureau_officer",
    "bureau": "bureau_officer",
    "bureau-officer": "bureau_officer",
    "bureau_officer": "bureau_officer",
    "admin": "system_admin",
    "system-admin": "system_admin",
    "system_admin": "system_admin",
    "institution": "institution",
    "institutions": "institution",
    "college": "institution",
}

def perform_login(username: str, password: str, requested_portal: str | None, db: Session, resource_path: str):
    username = str(username or "").strip()
    password = str(password or "")
    if not username or not password:
        raise HTTPException(status_code=400, detail="Username and password are required")

    user = db.scalar(select(models.AuthUser).where(models.AuthUser.username == username))
    if not user or not user.active or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    resolved_portal = None
    if requested_portal:
        raw_key = requested_portal.lower().strip()
        portal_key = PORTAL_ALIASES.get(raw_key, raw_key)
        if portal_key not in PORTAL_CONFIG:
            valid_keys = ", ".join(PORTAL_CONFIG.keys())
            raise HTTPException(status_code=400, detail=f"Invalid portal '{requested_portal}'. Available options: {valid_keys}")

        portal_def = PORTAL_CONFIG[portal_key]
        if user.role not in portal_def["allowed_roles"] and user.role != "admin":
            raise HTTPException(
                status_code=403,
                detail=f"Access denied: Account '{user.username}' (role '{user.role}') is not authorized for '{portal_def['title']}'. Please use your designated portal."
            )
        resolved_portal = portal_key
    else:
        if user.role == "admin":
            resolved_portal = "system_admin"
        elif user.role == "bureau_head":
            resolved_portal = "aicte_official"
        elif user.role in ("officer", "case_manager"):
            resolved_portal = "bureau_officer"
        elif user.role == "institution":
            resolved_portal = "institution"
        else:
            resolved_portal = "aicte_official"

    portal_info = PORTAL_CONFIG.get(resolved_portal, {})
    token = create_access_token(user.id, user.username, user.role)
    db.add(models.AuditLog(
        id=new_id("AUD"),
        actor_user_id=user.id,
        actor_username=user.username,
        action="LOGIN",
        resource=f"{resource_path}?portal={resolved_portal}",
        status_code=200,
        ip_address=None
    ))
    db.commit()

    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": settings.access_token_minutes * 60,
        "portal": resolved_portal,
        "portal_title": portal_info.get("title", resolved_portal),
        "user": {
            "id": user.id,
            "username": user.username,
            "full_name": user.full_name,
            "role": user.role,
        }
    }

@app.get("/api/auth/portals", response_model=list[schemas.PortalOut], tags=["Authentication"])
def get_auth_portals():
    """Discover available login portals and their authorization requirements."""
    return [
        schemas.PortalOut(
            id=k,
            title=v["title"],
            badge=v["badge"],
            description=v["description"],
            allowed_roles=v["allowed_roles"],
            endpoint=v["endpoint"]
        )
        for k, v in PORTAL_CONFIG.items()
    ]

@app.post("/api/auth/login", response_model=schemas.LoginResponse, tags=["Authentication"])
def login(payload: schemas.LoginRequest, portal: str | None = None, db: Session = Depends(get_db)):
    """Universal login endpoint supporting optional portal validation."""
    target_portal = payload.portal or portal
    return perform_login(payload.username, payload.password, target_portal, db, "/api/auth/login")

# Dedicated Endpoint 1: AICTE Officials (Administration)
@app.post("/api/auth/login/aicte-official", response_model=schemas.LoginResponse, tags=["Authentication"])
@app.post("/api/auth/login/official", response_model=schemas.LoginResponse, include_in_schema=False)
def login_aicte_official(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    """Dedicated login for AICTE Officials (Administration)."""
    return perform_login(payload.username, payload.password, "aicte_official", db, "/api/auth/login/aicte-official")

# Dedicated Endpoint 2: Bureau Officers
@app.post("/api/auth/login/bureau-officer", response_model=schemas.LoginResponse, tags=["Authentication"])
@app.post("/api/auth/login/officer", response_model=schemas.LoginResponse, include_in_schema=False)
def login_bureau_officer(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    """Dedicated login for Bureau Officers (Regulation Bureau & PGRC)."""
    return perform_login(payload.username, payload.password, "bureau_officer", db, "/api/auth/login/bureau-officer")

# Dedicated Endpoint 3: System Admin
@app.post("/api/auth/login/system-admin", response_model=schemas.LoginResponse, tags=["Authentication"])
@app.post("/api/auth/login/admin", response_model=schemas.LoginResponse, include_in_schema=False)
def login_system_admin(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    """Dedicated login for System Administrators."""
    return perform_login(payload.username, payload.password, "system_admin", db, "/api/auth/login/system-admin")

# Dedicated Endpoint 4: Institution
@app.post("/api/auth/login/institution", response_model=schemas.LoginResponse, tags=["Authentication"])
def login_institution(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    """Dedicated login for Approved Institutions (Colleges & Universities)."""
    return perform_login(payload.username, payload.password, "institution", db, "/api/auth/login/institution")


@app.get(
    "/api/auth/me",
    response_model=schemas.AuthUserInfo,
    tags=["Authentication"],
    summary="Get Current Authenticated User",
    description=(
        "Returns the active user profile for the current Bearer token. "
        "In Swagger UI (/docs), click the green **Authorize 🔓** button at the top-right to save your Bearer token across all APIs."
    )
)
def auth_me(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    token: str | None = Query(default=None, description="Optional: pass JWT token directly or use Swagger Authorize button"),
    db: Session = Depends(get_db)
):
    """Retrieve details of the currently authenticated user."""
    # 1. First preference: user verified and attached to request state by middleware
    user_state = getattr(request.state, "user", None)
    if user_state:
        return schemas.AuthUserInfo(
            id=user_state["sub"],
            username=user_state["username"],
            full_name=user_state.get("full_name") or user_state["username"],
            role=user_state["role"]
        )

    # 2. Direct token extraction fallback
    raw = token or (credentials.credentials if credentials else None) or request.headers.get("authorization")
    cleaned_token = extract_bearer_token(raw)
    if not cleaned_token:
        raise HTTPException(
            status_code=401,
            detail="Bearer token required. Please click the green 'Authorize' button in /docs or provide 'Authorization: Bearer <token>' header."
        )

    claims = decode_token(cleaned_token)
    user = db.scalar(select(models.AuthUser).where(models.AuthUser.id == claims.get("sub")))
    if not user or not user.active:
        raise HTTPException(status_code=401, detail="Account is inactive or no longer exists")

    return schemas.AuthUserInfo(
        id=user.id,
        username=user.username,
        full_name=user.full_name or user.username,
        role=user.role
    )


@app.post("/api/auth/users", status_code=201, tags=["Authentication"])
def create_auth_user(payload: dict, db: Session = Depends(get_db)):
    username = str(payload.get("username", "")).strip()
    password = str(payload.get("password", ""))
    full_name = str(payload.get("full_name", "")).strip()
    role = str(payload.get("role", "viewer")).strip()
    allowed_roles = {"admin", "bureau_head", "case_manager", "officer", "viewer", "institution"}
    if len(username) < 3 or len(password) < 12 or len(full_name) < 2:
        raise HTTPException(400, "Username/full name too short; password must be at least 12 characters")
    if role not in allowed_roles:
        raise HTTPException(400, "Unsupported role")
    if db.scalar(select(models.AuthUser).where(models.AuthUser.username == username)):
        raise HTTPException(409, "Username already exists")
    item = models.AuthUser(id=new_id("USR"), username=username, password_hash=hash_password(password),
                           full_name=full_name, role=role, active=True)
    db.add(item); db.commit(); db.refresh(item)
    return {"id":item.id,"username":item.username,"full_name":item.full_name,"role":item.role,"active":item.active}

@app.get("/api/admin/audit-logs", tags=["Administration & Audit"])
def get_audit_logs(limit: int = Query(100, ge=1, le=500), db: Session = Depends(get_db)):
    return [{"id":x.id,"actor_user_id":x.actor_user_id,"actor_username":x.actor_username,
             "action":x.action,"resource":x.resource,"status_code":x.status_code,
             "ip_address":x.ip_address,"created_at":x.created_at}
            for x in db.scalars(select(models.AuditLog).order_by(models.AuditLog.created_at.desc()).limit(limit)).all()]

@app.get("/api/dashboard/summary", tags=["Dashboard & Reports"])
def dashboard_summary(db: Session = Depends(get_db)):
    complaint_total = db.scalar(select(func.count()).select_from(models.Complaint)) or 0
    case_total = db.scalar(select(func.count()).select_from(models.Case)) or 0
    pending = db.scalar(select(func.count()).select_from(models.Case).where(models.Case.status.notin_(["Disposed", "Closed"]))) or 0
    disposed = db.scalar(select(func.count()).select_from(models.Case).where(models.Case.status.in_(["Disposed", "Closed"]))) or 0
    today = date.today()
    overdue = db.scalar(select(func.count()).select_from(models.Case).where(
        models.Case.expected_disposal_date < today,
        models.Case.status.notin_(["Disposed", "Closed"])
    )) or 0
    return {
        "total_complaints": complaint_total,
        "total_cases": case_total,
        "pending_cases": pending,
        "disposed_cases": disposed,
        "overdue_cases": overdue,
        "institutions": db.scalar(select(func.count()).select_from(models.Institution)) or 0,
        "officers": db.scalar(select(func.count()).select_from(models.Officer).where(models.Officer.active == True)) or 0,
    }

@app.get("/api/institutions", response_model=list[schemas.InstitutionOut], tags=["Institutions"])
def list_institutions(search: str | None = None, state: str | None = None, region: str | None = None,
                      skip: int = 0, limit: int = Query(100, ge=1, le=500), db: Session = Depends(get_db)):
    stmt = select(models.Institution)
    if search:
        stmt = stmt.where(or_(models.Institution.name.ilike(f"%{search}%"), models.Institution.id.ilike(f"%{search}%")))
    if state:
        stmt = stmt.where(models.Institution.state == state)
    if region:
        stmt = stmt.where(models.Institution.region == region)
    return list(db.scalars(stmt.order_by(models.Institution.name).offset(skip).limit(limit)).all())

@app.post("/api/institutions", response_model=schemas.InstitutionOut, status_code=201, tags=["Institutions"])
def create_institution(payload: schemas.InstitutionCreate, db: Session = Depends(get_db)):
    item = models.Institution(id=new_id("INST"), **payload.model_dump())
    db.add(item); db.commit(); db.refresh(item)
    return item

@app.get("/api/institutions/{institution_id}", tags=["Institutions"])
def get_institution(institution_id: str, db: Session = Depends(get_db)):
    item = db.get(models.Institution, institution_id)
    if not item:
        raise HTTPException(404, "Institution not found")
    complaints = db.scalars(select(models.Complaint).where(models.Complaint.institution_id == institution_id).order_by(models.Complaint.received_at.desc())).all()
    cases = db.scalars(select(models.Case).where(models.Case.institution_id == institution_id).order_by(models.Case.opened_at.desc())).all()
    return {"institution": schemas.InstitutionOut.model_validate(item), "complaints": [schemas.ComplaintOut.model_validate(x) for x in complaints], "cases": [schemas.CaseOut.model_validate(x) for x in cases]}

@app.get("/api/complaints", response_model=list[schemas.ComplaintOut], tags=["Complaints"])
def list_complaints(search: str | None = None, institution_id: str | None = None, status: str | None = None,
                    bureau: str | None = None, skip: int = 0, limit: int = Query(100, ge=1, le=500), db: Session = Depends(get_db)):
    stmt = select(models.Complaint)
    if search:
        stmt = stmt.where(or_(models.Complaint.id.ilike(f"%{search}%"), models.Complaint.subject.ilike(f"%{search}%")))
    if institution_id: stmt = stmt.where(models.Complaint.institution_id == institution_id)
    if status: stmt = stmt.where(models.Complaint.status == status)
    if bureau: stmt = stmt.where(models.Complaint.assigned_bureau == bureau)
    return list(db.scalars(stmt.order_by(models.Complaint.received_at.desc()).offset(skip).limit(limit)).all())

@app.post("/api/complaints", response_model=schemas.ComplaintOut, status_code=201, tags=["Complaints"])
def create_complaint(payload: schemas.ComplaintCreate, db: Session = Depends(get_db)):
    if not db.get(models.Institution, payload.institution_id):
        raise HTTPException(404, "Institution not found")
    item = models.Complaint(id=new_id("COMP"), **payload.model_dump())
    db.add(item); db.commit(); db.refresh(item)
    return item

@app.get("/api/complaints/{complaint_id}", response_model=schemas.ComplaintOut, tags=["Complaints"])
def get_complaint(complaint_id: str, db: Session = Depends(get_db)):
    item = db.get(models.Complaint, complaint_id)
    if not item: raise HTTPException(404, "Complaint not found")
    return item

@app.get("/api/cases", response_model=list[schemas.CaseOut], tags=["Cases"])
def list_cases(search: str | None = None, institution_id: str | None = None, status: str | None = None,
               bureau: str | None = None, officer_id: str | None = None, skip: int = 0,
               limit: int = Query(100, ge=1, le=500), db: Session = Depends(get_db)):
    stmt = select(models.Case)
    if search: stmt = stmt.where(or_(models.Case.id.ilike(f"%{search}%"), models.Case.title.ilike(f"%{search}%")))
    if institution_id: stmt = stmt.where(models.Case.institution_id == institution_id)
    if status: stmt = stmt.where(models.Case.status == status)
    if bureau: stmt = stmt.where(models.Case.bureau == bureau)
    if officer_id: stmt = stmt.where(models.Case.officer_id == officer_id)
    return list(db.scalars(stmt.order_by(models.Case.opened_at.desc()).offset(skip).limit(limit)).all())

@app.post("/api/cases", response_model=schemas.CaseOut, status_code=201, tags=["Cases"])
def create_case(payload: schemas.CaseCreate, db: Session = Depends(get_db)):
    if not db.get(models.Institution, payload.institution_id):
        raise HTTPException(404, "Institution not found")
    item_data = payload.model_dump(exclude={"complaint_ids"})
    item = models.Case(id=new_id("CASE"), **item_data)
    if payload.complaint_ids:
        complaints = db.scalars(select(models.Complaint).where(models.Complaint.id.in_(payload.complaint_ids))).all()
        if len(complaints) != len(set(payload.complaint_ids)):
            raise HTTPException(404, "One or more complaints not found")
        if any(c.institution_id != payload.institution_id for c in complaints):
            raise HTTPException(400, "Linked complaints must belong to the same institution in this starter")
        item.complaints = complaints
    db.add(item); db.flush()
    db.add(models.CaseAction(id=new_id("ACT"), case_id=item.id, action_type="Case created", new_status=item.status, remarks="Case created", officer_name=None))
    db.commit(); db.refresh(item)
    return item

@app.get("/api/cases/{case_id}", response_model=schemas.CaseOut, tags=["Cases"])
def get_case(case_id: str, db: Session = Depends(get_db)):
    item = db.get(models.Case, case_id)
    if not item: raise HTTPException(404, "Case not found")
    return item

@app.get("/api/cases/{case_id}/timeline", tags=["Cases"])
def case_timeline(case_id: str, db: Session = Depends(get_db)):
    item = db.get(models.Case, case_id)
    if not item: raise HTTPException(404, "Case not found")
    actions = db.scalars(select(models.CaseAction).where(models.CaseAction.case_id == case_id).order_by(models.CaseAction.created_at)).all()
    return [{"id": a.id, "action_type": a.action_type, "previous_status": a.previous_status, "new_status": a.new_status,
             "remarks": a.remarks, "officer_name": a.officer_name, "created_at": a.created_at} for a in actions]

@app.post("/api/cases/{case_id}/actions", status_code=201, tags=["Cases"])
def add_case_action(case_id: str, payload: schemas.ActionCreate, db: Session = Depends(get_db)):
    item = db.get(models.Case, case_id)
    if not item: raise HTTPException(404, "Case not found")
    previous = item.status
    if payload.new_status:
        item.status = payload.new_status
    action = models.CaseAction(id=new_id("ACT"), case_id=case_id, action_type=payload.action_type,
        previous_status=previous, new_status=item.status, remarks=payload.remarks, officer_name=payload.officer_name)
    db.add(action); db.commit()
    return {"message": "Action recorded", "case_id": case_id, "status": item.status, "action_id": action.id}

@app.get("/api/overlaps", tags=["Overlap Intelligence"])
def find_overlaps(threshold: float = Query(0.72, ge=0.1, le=1.0), db: Session = Depends(get_db)):
    complaints = db.scalars(select(models.Complaint).options(joinedload(models.Complaint.institution)).order_by(models.Complaint.received_at.desc()).limit(500)).all()
    saved_reviews = db.scalars(select(models.OverlapReviewRecord)).all()
    review_by_pair = {tuple(sorted((r.complaint_id, r.related_complaint_id))): r for r in saved_reviews}
    matches = []
    for i, left in enumerate(complaints):
        for right in complaints[i + 1:]:
            same_institution = left.institution_id == right.institution_id
            text_left = f"{left.subject} {left.description}".lower()
            text_right = f"{right.subject} {right.description}".lower()
            score = SequenceMatcher(None, text_left, text_right).ratio()
            if (same_institution and score >= threshold) or (left.assigned_bureau and right.assigned_bureau and left.assigned_bureau != right.assigned_bureau and score >= threshold):
                review = review_by_pair.get(tuple(sorted((left.id, right.id))))
                matches.append({"complaint_id": left.id, "subject": left.subject, "institution_id": left.institution_id,
                                "related_complaint_id": right.id, "related_subject": right.subject,
                                "related_institution_id": right.institution_id, "similarity": round(score, 3),
                                "same_institution": same_institution,
                                "review_status": review.decision if review else "Potentially Similar",
                                "review_remarks": review.remarks if review else None,
                                "issue_group_id": review.issue_group_id if review else None,
                                "reviewed_at": review.reviewed_at.isoformat() if review else None})
    return matches[:200]

@app.post("/api/overlaps/review", status_code=201, tags=["Overlap Intelligence"])
def review_overlap(payload: schemas.OverlapReview, db: Session = Depends(get_db)):
    first = db.get(models.Complaint, payload.complaint_id)
    second = db.get(models.Complaint, payload.related_complaint_id)
    if not first or not second:
        raise HTTPException(404, "Complaint not found")
    if first.id == second.id:
        raise HTTPException(400, "A complaint cannot be reviewed against itself")
    allowed = {"Potentially Similar", "Confirmed Related", "Confirmed Duplicate", "Not Related"}
    if payload.decision not in allowed:
        raise HTTPException(400, f"Decision must be one of: {', '.join(sorted(allowed))}")

    # Canonical pair lookup prevents a reversed pair creating a second review record.
    pair = sorted((first.id, second.id))
    review = db.scalar(select(models.OverlapReviewRecord).where(
        models.OverlapReviewRecord.complaint_id == pair[0],
        models.OverlapReviewRecord.related_complaint_id == pair[1]))
    if not review:
        review = db.scalar(select(models.OverlapReviewRecord).where(
            models.OverlapReviewRecord.complaint_id == pair[1],
            models.OverlapReviewRecord.related_complaint_id == pair[0]))
    if not review:
        review = models.OverlapReviewRecord(id=new_id("OVR"), complaint_id=pair[0], related_complaint_id=pair[1], decision=payload.decision)
        db.add(review)
    previous_group_id = review.issue_group_id
    review.decision = payload.decision
    review.remarks = payload.remarks.strip() if payload.remarks else None
    review.issue_group_id = None

    # Confirmed relationships get a durable group; original complaints remain independent.
    if payload.decision in {"Confirmed Related", "Confirmed Duplicate"}:
        existing_group_ids = db.scalars(select(models.IssueGroupComplaint.issue_group_id).where(
            models.IssueGroupComplaint.complaint_id.in_(pair))).all()
        group = db.get(models.IssueGroup, existing_group_ids[0]) if existing_group_ids else None
        if group:
            group.classification = payload.decision
        else:
            group = models.IssueGroup(id=new_id("ISSUE"), classification=payload.decision, primary_complaint_id=first.id)
            db.add(group)
            db.flush()
        for complaint_id in pair:
            membership = db.get(models.IssueGroupComplaint, (group.id, complaint_id))
            if not membership:
                db.add(models.IssueGroupComplaint(issue_group_id=group.id, complaint_id=complaint_id))
        review.issue_group_id = group.id
    elif payload.decision == "Not Related":
        # Keep the decision history, but detach this pair from its previous group if one existed.
        if previous_group_id:
            db.query(models.IssueGroupComplaint).filter(
                models.IssueGroupComplaint.issue_group_id == previous_group_id,
                models.IssueGroupComplaint.complaint_id.in_(pair)).delete(synchronize_session=False)
            db.flush()
            # Retain the group record as history; the listing endpoint hides groups with fewer than two members.
    first.review_status = payload.decision
    second.review_status = payload.decision
    db.commit()
    return {"message": "Review decision saved; original complaint records were preserved", "complaint_id": first.id,
            "related_complaint_id": second.id, "decision": payload.decision,
            "issue_group_id": review.issue_group_id, "reviewed_at": review.reviewed_at.isoformat()}

@app.get("/api/issue-groups", tags=["Overlap Intelligence"])
def list_issue_groups(db: Session = Depends(get_db)):
    groups = db.scalars(select(models.IssueGroup).order_by(models.IssueGroup.updated_at.desc())).all()
    result = []
    for group in groups:
        rows = db.scalars(select(models.IssueGroupComplaint, models.Complaint).join(
            models.Complaint, models.Complaint.id == models.IssueGroupComplaint.complaint_id).where(
            models.IssueGroupComplaint.issue_group_id == group.id)).all()
        if len(rows) < 2:
            continue
        result.append({"id": group.id, "classification": group.classification,
                       "primary_complaint_id": group.primary_complaint_id,
                       "created_at": group.created_at.isoformat(), "updated_at": group.updated_at.isoformat(),
                       "complaints": [{"id": complaint.id, "subject": complaint.subject,
                                       "institution_id": complaint.institution_id, "status": complaint.status,
                                       "assigned_bureau": complaint.assigned_bureau}
                                      for membership, complaint in rows]})
    return result

@app.post("/api/recommendations/bureau", tags=["Overlap Intelligence"])
def recommend_bureau(payload: dict):
    text = " ".join(str(payload.get(k, "")) for k in ("subject", "description", "category")).lower()
    pgrc_terms = ("grievance", "complaint", "harassment", "delay", "response", "public")
    rb_terms = ("regulation", "approval", "compliance", "norms", "recognition", "inspection", "affiliation")
    pgrc_score = sum(term in text for term in pgrc_terms)
    rb_score = sum(term in text for term in rb_terms)
    bureau = "RB" if rb_score > pgrc_score else "PGRC"
    reason = "Keywords suggest a regulatory/compliance matter." if bureau == "RB" else "Keywords suggest a public grievance or service-related matter."
    return {"recommended_bureau": bureau, "reason": reason, "confidence": "low" if pgrc_score == rb_score else "heuristic",
            "advisory_only": True, "message": "An authorized official must review and decide the Bureau."}

@app.get("/api/officers", response_model=list[schemas.OfficerOut], tags=["Officers"])
def list_officers(bureau: str | None = None, active: bool | None = True, db: Session = Depends(get_db)):
    stmt = select(models.Officer)
    if bureau: stmt = stmt.where(models.Officer.bureau == bureau)
    if active is not None: stmt = stmt.where(models.Officer.active == active)
    return list(db.scalars(stmt.order_by(models.Officer.name)).all())

@app.post("/api/officers", response_model=schemas.OfficerOut, status_code=201, tags=["Officers"])
def create_officer(payload: schemas.OfficerCreate, db: Session = Depends(get_db)):
    item = models.Officer(id=new_id("OFF"), **payload.model_dump())
    db.add(item); db.commit(); db.refresh(item)
    return item

@app.get("/api/notifications", tags=["Dashboard & Reports"])
def list_notifications(unread_only: bool = False, limit: int = Query(100, ge=1, le=500), db: Session = Depends(get_db)):
    stmt = select(models.Notification)
    if unread_only: stmt = stmt.where(models.Notification.read == False)
    rows = db.scalars(stmt.order_by(models.Notification.created_at.desc()).limit(limit)).all()
    return [{"id": n.id, "title": n.title, "message": n.message, "related_case_id": n.related_case_id, "read": n.read, "created_at": n.created_at} for n in rows]

@app.get("/api/reports/summary", tags=["Dashboard & Reports"])
def report_summary(db: Session = Depends(get_db)):
    bureau_rows = db.execute(select(models.Case.bureau, func.count()).group_by(models.Case.bureau)).all()
    status_rows = db.execute(select(models.Case.status, func.count()).group_by(models.Case.status)).all()
    region_rows = db.execute(select(models.Institution.region, func.count()).group_by(models.Institution.region)).all()
    return {"cases_by_bureau": [{"bureau": b or "Unassigned", "count": n} for b, n in bureau_rows],
            "cases_by_status": [{"status": s, "count": n} for s, n in status_rows],
            "institutions_by_region": [{"region": r or "Unspecified", "count": n} for r, n in region_rows]}
