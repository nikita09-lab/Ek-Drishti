from fastapi.testclient import TestClient
from sqlalchemy import select
from app.main import app
from app.database import SessionLocal
from app import models
from app.ids import new_id
from app.security import hash_password

def _create_user(username: str, password: str, role: str):
    with SessionLocal() as db:
        old = db.scalar(select(models.AuthUser).where(models.AuthUser.username == username))
        if old:
            db.delete(old)
            db.commit()
        user = models.AuthUser(id=new_id("USR"), username=username,
            password_hash=hash_password(password), full_name=f"Test {role.title()}",
            role=role, active=True)
        db.add(user)
        db.commit()

def _delete_user(username: str):
    with SessionLocal() as db:
        user = db.scalar(select(models.AuthUser).where(models.AuthUser.username == username))
        if user:
            db.delete(user)
            db.commit()

def test_admin_system_summary_and_user_management():
    admin_user = "test_sysadmin_qa"
    admin_pass = "TestPasswordAdmin123!"
    with TestClient(app) as client:
        _create_user(admin_user, admin_pass, "admin")
        try:
            res = client.post("/api/auth/login", json={"username": admin_user, "password": admin_pass})
            assert res.status_code == 200
            token = res.json()["access_token"]
            headers = {"Authorization": f"Bearer {token}"}

            summary = client.get("/api/admin/system-summary", headers=headers)
            assert summary.status_code == 200
            data = summary.json()
            assert "total_users" in data
            assert "active_users" in data
            assert "database_status" in data

            users = client.get("/api/auth/users", headers=headers)
            assert users.status_code == 200
            assert isinstance(users.json(), list)

            health = client.get("/api/admin/system-health", headers=headers)
            assert health.status_code == 200
            assert health.json()["status"] == "Operational"
        finally:
            _delete_user(admin_user)

def test_institution_access_restrictions_and_scoping():
    inst_user = "test_inst_qa"
    inst_pass = "TestPasswordInst123!"
    with TestClient(app) as client:
        _create_user(inst_user, inst_pass, "institution")
        try:
            res = client.post("/api/auth/login", json={"username": inst_user, "password": inst_pass})
            assert res.status_code == 200
            token = res.json()["access_token"]
            headers = {"Authorization": f"Bearer {token}"}

            # Institution must be blocked from administrative resources
            denied_admin = client.get("/api/admin/audit-logs", headers=headers)
            assert denied_admin.status_code == 403

            denied_users = client.get("/api/auth/users", headers=headers)
            assert denied_users.status_code == 403

            denied_officers = client.get("/api/officers", headers=headers)
            assert denied_officers.status_code == 403

            # Institution dashboard summary
            inst_summary = client.get("/api/institution/dashboard-summary", headers=headers)
            assert inst_summary.status_code == 200
            data = inst_summary.json()
            assert "total_complaints" in data
            assert "under_review" in data
        finally:
            _delete_user(inst_user)

def test_analytics_and_monthly_trends_endpoint():
    with TestClient(app) as client:
        login = client.post("/api/auth/login", json={"username": "admin", "password": "1234"})
        token = login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        trends = client.get("/api/reports/monthly-trends", headers=headers)
        assert trends.status_code == 200
        items = trends.json()
        assert len(items) == 6
        assert "month" in items[0]
        assert "received" in items[0]
        assert "disposed" in items[0]

        categories = client.get("/api/reports/category-trends", headers=headers)
        assert categories.status_code == 200
        assert isinstance(categories.json(), list)

        case_age = client.get("/api/reports/case-age", headers=headers)
        assert case_age.status_code == 200
        assert len(case_age.json()) == 3
