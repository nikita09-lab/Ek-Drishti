# Frontend authentication integration

- Sign-in screen calls `POST /api/auth/login`.
- Access token is held in `sessionStorage`, not persisted in source files. Sign out clears it.
- `authInterceptor` adds `Authorization: Bearer <token>` to API calls.
- API errors are shown on the sign-in screen; the user must sign in again after the session storage is cleared or the token expires.
- The backend must remain the authoritative RBAC enforcement point. UI-only role checks are not sufficient.

## Production hardening still required

This is an integration prototype, not a completed government production security certification. Before real institutional data is used, test login/token expiry and role matrix, add rate limiting and account lockout/MFA, review session storage vs an HttpOnly Secure SameSite cookie/BFF design, implement token-expiry handling, add security headers, verify audit-log integrity and retention, run dependency/security scans, and execute automated end-to-end tests.
