# AICTE OneView authentication and security setup

## Included
- Salted PBKDF2-HMAC-SHA256 password hashes; passwords are never stored in plaintext.
- JWT bearer access tokens expire after `ACCESS_TOKEN_MINUTES` (default 30 minutes).
- Roles: `admin`, `bureau_head`, `case_manager`, `officer`, `viewer`.
- Every `/api/*` route requires a bearer token except `/api/health` and `/api/auth/login`, in both development and production.
- Active account and current role are rechecked against the database on authenticated requests, so account deactivation/role changes take effect immediately.
- `viewer` is read-only; `/api/admin/*` and `/api/auth/users` require `admin`.
- Login and mutating API requests create audit events. Passwords, request bodies, and bearer tokens are not logged.
- Production startup rejects a placeholder/short `JWT_SECRET` and wildcard CORS origins.

## First administrator
1. Copy `.env.example` to `.env`.
2. Set `JWT_SECRET` to a unique random secret of at least 32 characters (use a longer randomly generated value).
3. Set `BOOTSTRAP_ADMIN_USERNAME` and a strong `BOOTSTRAP_ADMIN_PASSWORD`.
4. Leave `DATABASE_URL` blank to use local SQLite temporarily, or set it to the PostgreSQL URL once your database is ready.
5. Install dependencies with `pip install -r requirements.txt`.
6. Start from the `backend` folder: `python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000`.
7. The bootstrap admin is created at startup only if that username does not already exist. If you change the bootstrap password later, it does not automatically overwrite an existing account.
8. Open `http://127.0.0.1:8000/docs` and log in through `POST /api/auth/login`. The Angular login screen uses the same endpoint.

## Role scope and limitations
The current baseline has role-based read/write and admin-route checks. It does not yet enforce bureau-level or record-level access (for example, limiting an officer to only their own assigned cases). Confirm the intended permission matrix with AICTE stakeholders before production.

## Before production
- Set exact deployed frontend origins in `CORS_ORIGINS` and use HTTPS.
- Use a managed secret store and remove bootstrap credentials from deployment configuration after initial setup.
- Add login rate limiting/lockout and MFA if required by the organization's threat model.
- Add versioned database migrations (e.g. Alembic), backup/restore tests, and monitoring.
- Audit rows are application-level records in the same database, not tamper-proof compliance storage.
- Complete automated tests, dependency scanning, penetration testing, and privacy/retention review before using real institutional data.
