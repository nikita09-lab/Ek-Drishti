# AICTE OneView — Backend README

## Project Overview

AICTE OneView is a complaint and case monitoring platform for institution-related cases across AICTE Bureaus/Cells.

Backend stack:
- Python
- FastAPI
- SQLAlchemy
- PostgreSQL (target database)
- Uvicorn

## Folder Structure

Expected backend structure:

```text
backend/
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── config.py
│   ├── database.py
│   ├── models.py
│   ├── schemas.py
│   ├── ids.py
│   └── seed.py
├── tests/
├── .env
├── .env.example
├── requirements.txt
└── README.md
```

## 1. Activate the Python Virtual Environment

Open PowerShell in the backend folder:

```powershell
cd C:\Users\Sneha\OneDrive\Desktop\sih26264\backend
```

If the virtual environment already exists:

```powershell
.\.venv\Scripts\Activate.ps1
```

If it does not exist yet:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

## 2. Install Dependencies

Create or verify `requirements.txt`, then run:

```powershell
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

## 3. Configure Environment Variables

Copy the example file:

```powershell
Copy-Item .env.example .env
```

For PostgreSQL, set `DATABASE_URL` in `.env` after installing PostgreSQL Server and creating the database:

```env
DATABASE_URL=postgresql+psycopg://postgres:YOUR_PASSWORD@localhost:5432/aicte_oneview
CORS_ORIGINS=http://localhost:4200
APP_ENV=development
```

Replace `YOUR_PASSWORD` with the password chosen during PostgreSQL installation. Do not commit `.env` or share the database password.

If `DATABASE_URL` is blank, the provided starter configuration may use a local SQLite file instead. Verify the active database before considering PostgreSQL integration complete.

## 4. Run the Backend

From the `backend` folder, with `.venv` activated, run this exact command:

```powershell
python -m uvicorn app.main:app --reload
```

Keep this terminal open while developing.

## 5. Verify the API

Open these URLs in a browser:

- API root: http://127.0.0.1:8000/
- Interactive API documentation: http://127.0.0.1:8000/docs
- Health check: http://127.0.0.1:8000/api/health

The health endpoint should return a JSON response with `"status": "ok"`.

## 6. Frontend Integration

The Angular development server is expected at:

```text
http://localhost:4200
```

The backend CORS configuration should allow this origin. Angular services should call the API base URL:

```text
http://127.0.0.1:8000/api
```

Do not put database credentials in Angular. Database access must happen only through the backend.

## 7. Database Notes

- The PostgreSQL database name planned for this project is `aicte_oneview`.
- Confirm PostgreSQL Server is installed and running before connecting.
- Confirm the `.env` `DATABASE_URL` points to PostgreSQL, not SQLite.
- Verify tables and relationships against the Phase 1 data model.
- Confirm records persist after restarting the backend.

## 8. Phase 1 Verification Flow

1. Create an institution through the API.
2. Register a complaint for that institution.
3. Create a case linked to the complaint.
4. Assign the Bureau and officer.
5. Update the case status.
6. Verify the case timeline records the action.
7. Search for the complaint by Complaint ID.
8. Open the institution profile and verify linked complaints/cases.
9. Confirm dashboard metrics reflect the saved data.
10. Restart the backend and verify that records persist.

Phase 1 is complete only after this flow works through the application without manually editing database records.

## Security and Development Notes

This is a development environment guide. Before using real institutional or personal data, add and test authentication, role-based authorization, audit controls, secure document handling, and appropriate deployment protections. Do not expose the development server publicly.
