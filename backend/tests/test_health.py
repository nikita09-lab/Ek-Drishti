from fastapi.testclient import TestClient
from app.main import app

def test_health():
    with TestClient(app) as client:
        response = client.get("/api/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"
        assert "timestamp" in response.json()

def test_api_route_prefixes():
    """Verify core API routes exist and are properly prefixed with /api."""
    route_paths = [route.path for route in app.routes]
    expected_prefixes = [
        "/api/health",
        "/api/auth/login",
        "/api/auth/portals",
        "/api/auth/me",
        "/api/institutions",
        "/api/cases",
        "/api/complaints",
    ]
    for prefix in expected_prefixes:
        assert prefix in route_paths, f"Expected route {prefix} to be registered"

def test_cors_render_frontend():
    origin = "https://ek-drishti-1.onrender.com"
    with TestClient(app) as client:
        # Preflight OPTIONS request
        preflight = client.options(
            "/api/health",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "authorization,content-type",
            },
        )
        assert preflight.status_code == 200
        assert preflight.headers.get("access-control-allow-origin") == origin
        assert preflight.headers.get("access-control-allow-credentials") == "true"
        assert "GET" in preflight.headers.get("access-control-allow-methods", "")

        # Actual GET request with Origin
        response = client.get("/api/health", headers={"Origin": origin})
        assert response.status_code == 200
        assert response.headers.get("access-control-allow-origin") == origin

        # Disallowed origin check
        bad_preflight = client.options(
            "/api/health",
            headers={
                "Origin": "https://malicious-site.example.com",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert bad_preflight.status_code == 400

def test_auth_login_supported_demo_credentials():
    """Verify demo credentials aicte.official / 1234 authenticate successfully."""
    with TestClient(app) as client:
        res = client.post(
            "/api/auth/login",
            json={"username": "aicte.official", "password": "1234", "portal": "aicte_official"},
        )
        assert res.status_code == 200
        data = res.json()
        assert "access_token" in data
        assert data["token_type"].lower() == "bearer"
        assert data["user"]["username"] == "aicte.official"
        assert data["user"]["role"] in ("admin", "bureau_head")

def test_auth_login_invalid_credentials():
    """Verify invalid credentials return 401."""
    with TestClient(app) as client:
        res = client.post(
            "/api/auth/login",
            json={"username": "aicte.official", "password": "wrong-password"},
        )
        assert res.status_code == 401

