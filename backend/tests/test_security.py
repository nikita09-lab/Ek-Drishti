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
            password_hash=hash_password(password), full_name="Automated Test User",
            role=role, active=True)
        db.add(user)
        db.commit()

def _delete_user(username: str):
    with SessionLocal() as db:
        user = db.scalar(select(models.AuthUser).where(models.AuthUser.username == username))
        if user:
            db.delete(user)
            db.commit()

def test_health():
    with TestClient(app) as client:
        response = client.get("/api/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"

def test_api_requires_authentication():
    with TestClient(app) as client:
        response = client.get("/api/institutions")
        assert response.status_code == 401

def test_login_and_token_protected_endpoint():
    username, password = "test_user_security", "Test-Only-Password-9381!"
    with TestClient(app) as client:
        _create_user(username, password, "case_manager")
        try:
            bad = client.post("/api/auth/login", json={"username": username, "password": "wrong"})
            assert bad.status_code == 401
            good = client.post("/api/auth/login", json={"username": username, "password": password})
            assert good.status_code == 200
            token = good.json()["access_token"]
            protected = client.get("/api/institutions", headers={"Authorization": f"Bearer {token}"})
            assert protected.status_code == 200
        finally:
            _delete_user(username)

def test_viewer_cannot_write():
    username, password = "test_viewer_security", "Test-Only-Password-9381!"
    with TestClient(app) as client:
        _create_user(username, password, "viewer")
        try:
            login = client.post("/api/auth/login", json={"username": username, "password": password})
            assert login.status_code == 200
            token = login.json()["access_token"]
            denied = client.post("/api/institutions", headers={"Authorization": f"Bearer {token}"}, json={"name":"Should Not Save"})
            assert denied.status_code == 403
        finally:
            _delete_user(username)

def test_auth_me_endpoint():
    username, password = "test_auth_me_user", "Test-Only-Password-9381!"
    with TestClient(app) as client:
        # Unauthenticated request should fail with 401
        unauth = client.get("/api/auth/me")
        assert unauth.status_code == 401

        _create_user(username, password, "officer")
        try:
            login = client.post("/api/auth/login", json={"username": username, "password": password})
            assert login.status_code == 200
            token = login.json()["access_token"]

            # Standard Bearer header
            resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
            assert resp.status_code == 200
            data = resp.json()
            assert data["username"] == username
            assert data["role"] == "officer"

            # Query param ?token=
            resp_query = client.get(f"/api/auth/me?token={token}")
            assert resp_query.status_code == 200
            assert resp_query.json()["username"] == username
        finally:
            _delete_user(username)

