# AICTE OneView Backend

FastAPI backend starter for the AICTE OneView institution complaint and case monitoring application.

## Included
- FastAPI application and interactive API docs
- SQLAlchemy models for institutions, complaints, cases, case actions, officers, and notifications
- PostgreSQL configuration through environment variables
- SQLite fallback for local development when `DATABASE_URL` is not set
- REST endpoints for dashboard, institutions, complaints, cases, timeline, overlap review, Bureau recommendation, officers, and notifications
- CORS configuration for Angular at `http://localhost:4200`
- Seed script with clearly fictional demo records
- Basic validation and error responses

## Important
This is a development starter, not a production-ready government system. Authentication, authorization, audit hardening, secure document storage, formal SLA rules, and a reviewed AI model must be added before real sensitive data is used. The Bureau recommendation endpoint is rule-based and advisory only.

## Setup on Windows PowerShell

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
Copy-Item .env.example .env
```

For quick local testing, leave `DATABASE_URL` blank in `.env`; SQLite will be used.

For PostgreSQL, create a database named `aicte_oneview`, then set a URL in `.env`, for example:

```env
DATABASE_URL=postgresql+psycopg://postgres:YOUR_PASSWORD@localhost:5432/aicte_oneview
```

Start the API:

```powershell
uvicorn app.main:app --reload
```

Open:
- API root: http://127.0.0.1:8000/
- Swagger docs: http://127.0.0.1:8000/docs
- Health check: http://127.0.0.1:8000/api/health

Optional fictional sample data:

```powershell
python -m app.seed
```

## Main endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/dashboard/summary` | Dashboard metrics |
| GET/POST | `/api/institutions` | List/create institutions |
| GET | `/api/institutions/{institution_id}` | Institution details |
| GET/POST | `/api/complaints` | List/create complaints |
| GET | `/api/complaints/{complaint_id}` | Complaint details |
| GET/POST | `/api/cases` | List/create cases |
| GET | `/api/cases/{case_id}` | Case details |
| POST | `/api/cases/{case_id}/actions` | Add timeline action |
| GET | `/api/cases/{case_id}/timeline` | Case timeline |
| GET | `/api/overlaps` | Potential duplicate/related complaint pairs |
| POST | `/api/overlaps/review` | Record human review decision |
| POST | `/api/recommendations/bureau` | Rule-based advisory Bureau recommendation |
| GET/POST | `/api/officers` | List/create officers |
| GET | `/api/notifications` | List notifications |
| GET | `/api/reports/summary` | Basic aggregate reporting |

IDs are generated server-side. Institution IDs are permanent; each complaint gets a unique Complaint ID; each case gets a separate Case ID. A case can reference multiple complaints through the `case_complaints` association table.

## Notes
- API data is not authenticated in this starter. Do not expose it publicly.
- `python -m app.seed` only adds synthetic sample data if the database is empty.
- Upload handling is not implemented yet; documents are represented as metadata/remarks until secure storage is added.


## Database implementation

See [DATABASE-SETUP.md](DATABASE-SETUP.md) for the table design, relationships, PostgreSQL schema SQL, and the connection step intentionally left pending until the local PostgreSQL password is available. The equivalent SQL is in `database/schema.sql`.


See `SECURITY-SETUP.md` for authentication, role permissions, audit logging, and production activation requirements.
