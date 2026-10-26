# AICTE OneView — Updated Audit Results
Date: 26 October 2026

## Changes made in this package
- Connected the Angular root component to `AuthService` for login/logout, error state, loading state, current user display and role label.
- Avoided making API calls before a user is authenticated.
- Enforced bearer authentication for all `/api/*` endpoints except `/api/health` and `/api/auth/login`, in development and production.
- Re-checks active account and current role from the database for authenticated API requests.
- Kept viewer read-only and admin-only checks for user-management/admin routes.
- Added production startup checks for weak/default JWT secret and wildcard CORS.
- Updated `.env.example` and setup instructions for bootstrap admin and optional PostgreSQL URL.
- Added automated tests for health, unauthenticated access, bad credentials, successful login, protected endpoint access, and viewer write denial.

## Tests executed in this environment
- Python syntax compilation: PASS
- Backend pytest: PASS — 5 tests
- Angular `npm ci` / build: NOT VERIFIED; dependency installation did not complete in this environment.
- PostgreSQL connection/migrations: NOT VERIFIED; user will add connection URL/password.
- Full browser end-to-end testing: NOT VERIFIED.

## Important limitations
This is a development/hackathon starter, not a production security certification. Bureau/record-level permissions, login rate limiting, MFA, password recovery, token revocation, versioned migrations, immutable audit storage, backups and penetration testing remain to be completed before real institutional data is used. SQLAlchemy emits deprecation warnings for `datetime.utcnow()` defaults; these should be migrated to timezone-aware UTC timestamps in a follow-up.
