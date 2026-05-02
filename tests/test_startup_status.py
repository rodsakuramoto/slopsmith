"""Tests for GET /api/startup-status — shape, field types, and the
_set_startup_status / _get_startup_status state helpers introduced in
the async plugin-loading PR (slopsmith#115).
"""

import importlib
import sys
import time

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client(tmp_path, monkeypatch):
    """TestClient with CONFIG_DIR isolated in a per-test tmp_path.

    Background startup tasks are stubbed to no-ops so the plugin-loader
    thread finishes near-instantly (load_plugins is a no-op) and then
    we poll until the thread writes running=False before yielding.  This
    guarantees no background thread is still calling _set_startup_status
    when tests write and immediately read the helper / endpoint — making
    the round-trip and endpoint-reflection tests deterministic.
    """
    monkeypatch.setenv("CONFIG_DIR", str(tmp_path))
    sys.modules.pop("server", None)
    server = importlib.import_module("server")
    # Stub out the two background callables that call _set_startup_status.
    # Patching at the function level (not threading.Thread) leaves TestClient
    # and AnyIO free to create real threads for their own internal use.
    monkeypatch.setattr(server, "load_plugins", lambda *a, **kw: None)
    monkeypatch.setattr(server, "startup_scan", lambda: None)
    test_client = TestClient(server.app)
    # Wait for the background startup thread to finish (it will since
    # load_plugins is a no-op, so this completes in milliseconds).
    # Without this barrier the thread can race against test assertions that
    # immediately write then read _startup_status.
    deadline = time.monotonic() + 5.0
    while time.monotonic() < deadline:
        if not server._get_startup_status().get("running", True):
            break
        time.sleep(0.01)
    try:
        yield test_client, server
    finally:
        test_client.close()
        conn = getattr(getattr(server, "meta_db", None), "conn", None)
        if conn is not None:
            conn.close()


# ── /api/startup-status endpoint ─────────────────────────────────────────────

def test_startup_status_returns_200(client):
    tc, _ = client
    r = tc.get("/api/startup-status")
    assert r.status_code == 200


def test_startup_status_response_has_expected_keys(client):
    tc, _ = client
    data = tc.get("/api/startup-status").json()
    for key in ("running", "phase", "message", "current_plugin", "loaded", "total", "error"):
        assert key in data, f"Missing key '{key}' in /api/startup-status response"


def test_startup_status_field_types(client):
    tc, _ = client
    data = tc.get("/api/startup-status").json()
    assert isinstance(data["running"], bool)
    assert isinstance(data["phase"], str)
    assert isinstance(data["message"], str)
    assert isinstance(data["current_plugin"], str)
    assert isinstance(data["loaded"], int)
    assert isinstance(data["total"], int)
    # error is either None (JSON null) or a string
    assert data["error"] is None or isinstance(data["error"], str)


# ── _set_startup_status / _get_startup_status helpers ────────────────────────

def test_set_get_startup_status_round_trip(client):
    """_set_startup_status partial-updates the state; _get_startup_status
    returns a snapshot dict."""
    _, server = client
    server._set_startup_status(running=False, phase="complete", message="done",
                               current_plugin="", loaded=3, total=3, error=None)
    status = server._get_startup_status()
    assert status["running"] is False
    assert status["phase"] == "complete"
    assert status["loaded"] == 3
    assert status["total"] == 3
    assert status["error"] is None


def test_set_startup_status_partial_update_does_not_clobber_other_keys(client):
    """A partial _set_startup_status call must not lose previously-set keys."""
    _, server = client
    server._set_startup_status(running=True, phase="plugins-loading", message="loading",
                               current_plugin="myplugin", loaded=1, total=5, error=None)
    # Only update message.
    server._set_startup_status(message="installing requirements")
    status = server._get_startup_status()
    assert status["message"] == "installing requirements"
    assert status["phase"] == "plugins-loading"
    assert status["current_plugin"] == "myplugin"
    assert status["loaded"] == 1
    assert status["total"] == 5


def test_startup_status_endpoint_reflects_set_status(client):
    """The HTTP endpoint must reflect what was last written via _set_startup_status."""
    tc, server = client
    server._set_startup_status(running=False, phase="complete", message="All done",
                               current_plugin="", loaded=7, total=7, error=None)
    data = tc.get("/api/startup-status").json()
    assert data["running"] is False
    assert data["phase"] == "complete"
    assert data["loaded"] == 7
    assert data["total"] == 7
