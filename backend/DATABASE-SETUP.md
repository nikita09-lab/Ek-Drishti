# AICTE OneView database setup

## Database code included

- `app/models.py`: SQLAlchemy models and relationships for institutions, officers, complaints, cases, complaint-to-case mapping, case timeline actions, and notifications.
- `app/database.py`: engine, session factory, base class, and request-scoped DB sessions.
- `app/config.py`: environment-based database configuration. If `DATABASE_URL` is empty, the app uses the local SQLite file for development.
- `database/schema.sql`: equivalent PostgreSQL DDL for creating the database tables manually.
- `app/main.py`: calls `Base.metadata.create_all()` at startup, so it creates missing tables after the connection is configured.

## Connection intentionally left pending

Do not put a real password in source code or commit it to Git. In `backend/.env`, eventually set:

```env
DATABASE_URL=postgresql+psycopg://postgres:YOUR_POSTGRES_PASSWORD@localhost:5432/aicte_oneview
CORS_ORIGINS=http://localhost:4200
APP_ENV=development
```

Replace `YOUR_POSTGRES_PASSWORD` locally after the PostgreSQL password is known/reset. URL-encode special characters in a password (for example `@` as `%40`). Keep `.env` private; `.env.example` is safe to share and intentionally contains no credentials.

## Database creation (once the password is available)

In pgAdmin, right-click **Databases** → **Create** → **Database...** → name it `aicte_oneview` → Save. This only creates the empty database. The backend will create tables on startup via SQLAlchemy.

Alternatively, connect with psql as a user permitted to create databases and run:

```sql
CREATE DATABASE aicte_oneview;
```

## Tables and relationships

- `institutions`: institution profile.
- `officers`: RB / PGRC officers.
- `complaints`: complaint record; references institution and optionally an assigned officer.
- `cases`: case record; references institution and optionally an officer.
- `case_complaints`: many-to-many relationship between cases and complaints.
- `case_actions`: chronological case timeline and status changes.
- `notifications`: notices optionally linked to a case.

## Important

`create_all()` creates missing tables but is not a schema migration system. For future schema changes, add and apply Alembic migrations rather than relying on `create_all()` alone. Use fictional test records until authentication, authorization, privacy controls, and production security review are implemented.
