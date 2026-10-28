from fastapi.testclient import TestClient
from app.main import app

def test_health():
    with TestClient(app) as client:
        response = client.get("/api/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"

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
