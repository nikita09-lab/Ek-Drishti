# AICTE OneView — Integrated Frontend + Backend

This is a development integration of the Angular frontend with the FastAPI API. Live API-backed workflows now include dashboard counts, institution registry and creation, complaint registry and creation, case registry and creation, case action/status updates with timeline, officer registry and creation, overlap signal review, bureau recommendation requests, report summaries, and notifications listing.

## 1. Start the backend (PowerShell terminal 1)

```powershell
cd .\backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

### Database setup

The backend defaults to SQLite for a quick local start if `DATABASE_URL` is blank. API authentication is required for all endpoints except health and login, including during local development. Set the bootstrap administrator password before the first backend startup. To use PostgreSQL, first create a database named `aicte_oneview` in pgAdmin, then edit `backend/.env`:

```env
DATABASE_URL=postgresql+psycopg://postgres:YOUR_PASSWORD@localhost:5432/aicte_oneview
CORS_ORIGINS=http://localhost:4200,http://127.0.0.1:4200
APP_ENV=development
JWT_SECRET=replace-with-a-unique-random-secret-at-least-32-characters
BOOTSTRAP_ADMIN_USERNAME=admin
BOOTSTRAP_ADMIN_PASSWORD=use-a-strong-unique-password-here
```

Replace `YOUR_PASSWORD` with the actual PostgreSQL password. If it contains URL-special characters, URL-encode them. Keep `.env` private. If PostgreSQL password is not yet known, leave `DATABASE_URL=` blank for local SQLite testing; PostgreSQL is not required to verify frontend/backend API wiring. Set `BOOTSTRAP_ADMIN_PASSWORD` to a strong unique password before first start; the first admin account is created automatically if it does not already exist. The login screen uses this account.

Start from the `backend` directory:

```powershell
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Check `http://127.0.0.1:8000/api/health` and `http://127.0.0.1:8000/docs`.

## 2. Start the frontend (PowerShell terminal 2)

From the project root:

```powershell
cd .\frontend
npm install
npm start
```

Open `http://localhost:4200`. The frontend API URL is `http://127.0.0.1:8000/api`. The connection banner includes retry/refresh behavior.

## 3. Suggested end-to-end workflow

1. Open **Institutions** and create an institution.
2. Open **Officers & Assignments** and create an officer, if needed.
3. Open **All Complaints** and register a complaint against the institution.
4. Open **Case Management** and create a case for that institution, optionally assigning an officer.
5. Use **Open** on a case row to open **Case Timeline**, add remarks and save a status change.
6. Review **Overlap Intelligence** signals and choose a review decision; no records are automatically merged.
7. Use **Bureau Recommendations** to request a keyword-based advisory recommendation for the latest complaint.
8. Review **Reports & Analytics**, **Notifications**, and export the currently loaded case list to CSV.

## Important limitations

- This is a local development prototype, not a production-ready government system. It does not yet provide authentication, role-based access control, formal audit/security hardening, document upload/scanning, production migrations, or full notification generation/read management.
- Bureau recommendation is a simple keyword heuristic, not a trained AI model, and must not be treated as a final decision.
- Overlap matching uses text similarity and can produce false positives/negatives; human review is required.
- Use test data only until security and privacy controls are implemented and reviewed.
- I could not run an Angular build in this environment because dependency installation did not complete here. Run `npm install` and `npm run build` locally and address any environment-specific build errors before demo/deployment.


## Sign-in and security integration

The Angular app now shows a sign-in screen and sends the JWT returned by `POST /api/auth/login` as `Authorization: Bearer ...` on API requests. The token is kept in `sessionStorage` for the current browser tab/session and cleared by Sign out. This is a prototype pattern; for high-security production deployment, consider a backend-for-frontend with HttpOnly Secure SameSite cookies and CSRF protection.

Before first secure startup:
1. In `backend`, copy `.env.example` to `.env`.
2. Set a unique `JWT_SECRET` (at least 32 random bytes) and a strong `BOOTSTRAP_ADMIN_PASSWORD` (12+ characters).
3. Set `APP_ENV=production` only after the frontend and API are configured.
4. Install backend dependencies and start `python -m uvicorn app.main:app --reload`.
5. Sign in using the configured bootstrap admin. Create additional users through the admin-only `POST /api/auth/users` endpoint, assigning the minimum role required.

Roles enforced by the production API: `admin`, `bureau_head`, `case_manager`, `officer`, and `viewer`. The backend is authoritative for authorization; hiding controls in the frontend is not a security boundary. Keep PostgreSQL connection setup pending until the database password is known.


## 4. Security notes and current limitations

- Login uses salted PBKDF2 password hashes and short-lived JWT access tokens.
- The API checks active users and current roles against the database on authenticated requests.
- Viewer role is read-only; admin user-management routes require the admin role.
- Audit events are stored in the same application database; this is not tamper-proof compliance-grade storage.
- Bureau/record-level authorization (for example, officers seeing only assigned cases), login rate limiting, MFA, password recovery, token revocation, and versioned database migrations remain future hardening work.
- Do not use real institutional data until role requirements are approved, PostgreSQL and frontend builds are verified, backups are tested, and security review is complete.


## Overlap review and issue groups (added)

- `GET /api/overlaps` returns similarity signals plus the latest persisted human-review decision and Issue Group ID. Similarity remains advisory.
- `POST /api/overlaps/review` accepts `Potentially Similar`, `Confirmed Related`, `Confirmed Duplicate`, or `Not Related`. Optional remarks are saved.
- `GET /api/issue-groups` lists confirmed groups and their member Complaint IDs.
- Confirmed Related / Confirmed Duplicate decisions create or update an Issue Group. Complaint records and IDs are preserved; no automatic merge or deletion occurs. The primary complaint is display-only.
- New tables are created by SQLAlchemy `create_all` on startup. The matching DDL is also appended to `backend/database/schema.sql` for manual reference. Existing databases with tables already created will get the new tables on startup; this is not a substitute for a formal migration system in production.
- Angular build and database integration tests have intentionally not been run in this feature-development step.
