import pytest, json
from fastapi.testclient import TestClient


def test_health_endpoint():
    from backend.main import app
    with TestClient(app) as client:
        r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_dashboard_ws_connects():
    from backend.main import app
    with TestClient(app) as client:
        with client.websocket_connect("/ws/dashboard/op-test") as ws:
            # Should not raise - connection accepted
            pass


def test_call_ws_call_init_creates_state():
    from backend.main import app, call_store
    import asyncio, time
    with TestClient(app) as client:
        with client.websocket_connect("/ws/call/test-call-002/audio") as ws:
            ws.send_text(json.dumps({
                "type": "call_init",
                "call_id": "test-call-002",
                "operator_id": "op-test",
                "audio_mime": "audio/webm;codecs=opus",
                "sample_rate": 16000
            }))
            time.sleep(0.1)
    state = asyncio.run(call_store.get_call("test-call-002"))
    assert state is not None
