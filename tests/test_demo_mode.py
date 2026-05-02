"""Tests for SLOPSMITH_DEMO_MODE middleware.

Covers:
- Demo mode off: write routes pass through (middleware is a no-op).
- Demo mode on: selected entries from _DEMO_BLOCKED return 403 {"error": "demo mode: read-only"}.
- Demo mode on: first GET / sets the slopsmith_demo_session cookie.
- Demo mode on: subsequent GET / (cookie already present) does not re-set it.
- Cookie secure flag: set when X-Forwarded-Proto indicates https, including comma-separated values.
- register_demo_janitor_hook: registered hooks are called by the janitor sweep.
- register_demo_janitor_hook: non-callables are rejected with TypeError.
- register_demo_janitor_hook: async (coroutine) functions are rejected with TypeError.
- register_demo_janitor_hook: callables with required arguments are rejected with TypeError.
- register_demo_janitor_hook: present in the plugin context dict passed to load_plugins.
"""

import importlib
import sys

import pytest
from fastapi.testclient import TestClient


def _make_client(tmp_path, monkeypatch, *, demo: bool = False):
    """Return a (server_module, TestClient) pair isolated in tmp_path.

    The TestClient is returned open; caller is responsible for closing it.
    raise_server_exceptions defaults to True so unexpected server errors
    surface as test failures rather than silently passing status checks.
    SLOPSMITH_SYNC_STARTUP=1 makes the plugin-loader run inline (no background
    thread spawned), consistent with tests/test_startup_status.py.  startup_scan
    and load_plugins are also stubbed to no-ops so background file-scan and
    plugin I/O are suppressed.
    """
    monkeypatch.setenv("CONFIG_DIR", str(tmp_path))
    monkeypatch.setenv("SLOPSMITH_SYNC_STARTUP", "1")
    if demo:
        monkeypatch.setenv("SLOPSMITH_DEMO_MODE", "1")
    else:
        monkeypatch.delenv("SLOPSMITH_DEMO_MODE", raising=False)
    sys.modules.pop("server", None)
    server = importlib.import_module("server")
    # Stub out background threads to keep tests fast and non-flaky.
    monkeypatch.setattr(server, "startup_scan", lambda: None)
    monkeypatch.setattr(server, "load_plugins", lambda app, context, progress_cb=None, route_setup_fn=None: None)
    client = TestClient(server.app, raise_server_exceptions=True)
    return server, client


def _cleanup(server, client):
    client.close()
    # Stop the demo-mode janitor thread (if started) so daemon threads don't
    # accumulate across tests.
    server._DEMO_JANITOR_STOP.set()
    thread = server._DEMO_JANITOR_THREAD
    if thread is not None:
        thread.join(timeout=2)
    server._DEMO_JANITOR_STARTED = False
    server._DEMO_JANITOR_THREAD = None
    with server._DEMO_JANITOR_HOOKS_LOCK:
        server._DEMO_JANITOR_HOOKS.clear()
    conn = getattr(getattr(server, "meta_db", None), "conn", None)
    if conn is not None:
        conn.close()


# ── Demo mode OFF: write routes are not blocked ───────────────────────────────

def test_demo_off_settings_post_not_blocked(tmp_path, monkeypatch):
    server, client = _make_client(tmp_path, monkeypatch, demo=False)
    try:
        r = client.post("/api/settings", json={"master_difficulty": 50})
        assert r.status_code == 200
    finally:
        _cleanup(server, client)


# ── Demo mode ON: blocked routes return 403 ───────────────────────────────────

@pytest.mark.parametrize("method,path", [
    ("POST",   "/api/settings"),
    ("POST",   "/api/settings/import"),
    ("POST",   "/api/rescan"),
    ("POST",   "/api/rescan/full"),
    ("POST",   "/api/favorites/toggle"),
    ("POST",   "/api/loops"),
    ("DELETE", "/api/loops/some-id"),
    ("GET",    "/api/plugins/updates"),
])
def test_demo_on_blocked_routes_return_403(tmp_path, monkeypatch, method, path):
    server, client = _make_client(tmp_path, monkeypatch, demo=True)
    try:
        r = client.request(method, path)
        assert r.status_code == 403
        assert r.json() == {"error": "demo mode: read-only"}
    finally:
        _cleanup(server, client)


def test_demo_on_read_routes_not_blocked(tmp_path, monkeypatch):
    """Safe read routes must still work in demo mode."""
    server, client = _make_client(tmp_path, monkeypatch, demo=True)
    try:
        r = client.get("/api/settings")
        assert r.status_code == 200
    finally:
        _cleanup(server, client)


# ── Demo cookie: set on first GET /, not on subsequent requests ───────────────

def test_demo_cookie_set_on_first_get_root(tmp_path, monkeypatch):
    server, client = _make_client(tmp_path, monkeypatch, demo=True)
    try:
        r = client.get("/")
        assert "slopsmith_demo_session" in r.cookies
    finally:
        _cleanup(server, client)


def test_demo_cookie_not_reset_when_already_present(tmp_path, monkeypatch):
    server, client = _make_client(tmp_path, monkeypatch, demo=True)
    try:
        # First request sets the cookie.
        r1 = client.get("/")
        session_id = r1.cookies.get("slopsmith_demo_session")
        assert session_id is not None

        # Second request (cookie already in jar) must not overwrite it.
        r2 = client.get("/", cookies={"slopsmith_demo_session": session_id})
        # The Set-Cookie header for our cookie must be absent.
        set_cookie = r2.headers.get("set-cookie", "")
        assert "slopsmith_demo_session" not in set_cookie
    finally:
        _cleanup(server, client)


def test_demo_cookie_not_set_in_non_demo_mode(tmp_path, monkeypatch):
    server, client = _make_client(tmp_path, monkeypatch, demo=False)
    try:
        r = client.get("/")
        assert "slopsmith_demo_session" not in r.cookies
    finally:
        _cleanup(server, client)


# ── Cookie secure flag ────────────────────────────────────────────────────────

def test_demo_cookie_not_secure_over_http(tmp_path, monkeypatch):
    server, client = _make_client(tmp_path, monkeypatch, demo=True)
    try:
        r = client.get("/")
        set_cookie = r.headers.get("set-cookie", "")
        # The cookie must be present but without the Secure attribute.
        assert "slopsmith_demo_session" in set_cookie
        assert "secure" not in set_cookie.lower()
    finally:
        _cleanup(server, client)


def test_demo_cookie_secure_over_https_via_forwarded_proto(tmp_path, monkeypatch):
    server, client = _make_client(tmp_path, monkeypatch, demo=True)
    try:
        r = client.get("/", headers={"x-forwarded-proto": "https"})
        set_cookie = r.headers.get("set-cookie", "")
        assert "slopsmith_demo_session" in set_cookie
        assert "secure" in set_cookie.lower()
    finally:
        _cleanup(server, client)


def test_demo_cookie_secure_with_comma_separated_forwarded_proto(tmp_path, monkeypatch):
    """Proxies sometimes send 'https,http'; first value must win."""
    server, client = _make_client(tmp_path, monkeypatch, demo=True)
    try:
        r = client.get("/", headers={"x-forwarded-proto": "https,http"})
        set_cookie = r.headers.get("set-cookie", "")
        assert "slopsmith_demo_session" in set_cookie
        assert "secure" in set_cookie.lower()
    finally:
        _cleanup(server, client)


def test_demo_cookie_not_secure_when_forwarded_proto_is_http(tmp_path, monkeypatch):
    """x-forwarded-proto: http must not trigger Secure."""
    server, client = _make_client(tmp_path, monkeypatch, demo=True)
    try:
        r = client.get("/", headers={"x-forwarded-proto": "http"})
        set_cookie = r.headers.get("set-cookie", "")
        assert "slopsmith_demo_session" in set_cookie
        assert "secure" not in set_cookie.lower()
    finally:
        _cleanup(server, client)


# ── register_demo_janitor_hook ────────────────────────────────────────────────

def test_register_demo_janitor_hook_is_callable(tmp_path, monkeypatch):
    """register_demo_janitor_hook must exist and accept a callable."""
    server, client = _make_client(tmp_path, monkeypatch, demo=True)
    try:
        called = []
        server.register_demo_janitor_hook(lambda: called.append(1))
        # Manually invoke the registered hooks (simulating a janitor sweep).
        for hook in list(server._DEMO_JANITOR_HOOKS):
            hook()
        assert 1 in called
    finally:
        # Clean up our test hook so it doesn't leak into other tests.
        with server._DEMO_JANITOR_HOOKS_LOCK:
            server._DEMO_JANITOR_HOOKS.clear()
        _cleanup(server, client)


def test_register_demo_janitor_hook_rejects_non_callable(tmp_path, monkeypatch):
    """Passing a non-callable must raise TypeError immediately at registration."""
    server, client = _make_client(tmp_path, monkeypatch, demo=True)
    try:
        with pytest.raises(TypeError):
            server.register_demo_janitor_hook("not a function")
    finally:
        _cleanup(server, client)


def test_register_demo_janitor_hook_rejects_async_callable(tmp_path, monkeypatch):
    """Async functions must be rejected: the janitor cannot await coroutines."""
    server, client = _make_client(tmp_path, monkeypatch, demo=True)
    try:
        async def _async_hook():
            pass

        with pytest.raises(TypeError, match="async"):
            server.register_demo_janitor_hook(_async_hook)
    finally:
        _cleanup(server, client)


def test_register_demo_janitor_hook_rejects_non_zero_arg_callable(tmp_path, monkeypatch):
    """Callables with required arguments must be rejected at registration time."""
    server, client = _make_client(tmp_path, monkeypatch, demo=True)
    try:
        def _needs_arg(x):
            pass

        with pytest.raises(TypeError, match="zero-argument"):
            server.register_demo_janitor_hook(_needs_arg)
    finally:
        _cleanup(server, client)


def test_register_demo_janitor_hook_accepts_default_arg_callable(tmp_path, monkeypatch):
    """Callables with only default/optional arguments must be accepted."""
    server, client = _make_client(tmp_path, monkeypatch, demo=True)
    try:
        def _optional_arg(x=None):
            pass

        server.register_demo_janitor_hook(_optional_arg)
    finally:
        with server._DEMO_JANITOR_HOOKS_LOCK:
            server._DEMO_JANITOR_HOOKS.clear()
        _cleanup(server, client)


def test_register_demo_janitor_hook_in_plugin_context(tmp_path, monkeypatch):
    """register_demo_janitor_hook must be surfaced in the plugin context dict
    passed to load_plugins(), not just on the server module."""
    monkeypatch.setenv("CONFIG_DIR", str(tmp_path))
    monkeypatch.setenv("SLOPSMITH_DEMO_MODE", "1")
    monkeypatch.setenv("SLOPSMITH_SYNC_STARTUP", "1")
    sys.modules.pop("server", None)
    server = importlib.import_module("server")

    captured: dict = {}

    def _capturing_load_plugins(app, context, **kw):
        captured.update(context)
        # Do NOT call the real loader — we only care that the context dict
        # contains the expected key; running the real loader would trigger pip
        # installs and filesystem scanning, making the test slow/flaky.
        return None

    monkeypatch.setattr(server, "load_plugins", _capturing_load_plugins)
    monkeypatch.setattr(server, "startup_scan", lambda: None)

    with TestClient(server.app):
        assert "register_demo_janitor_hook" in captured, (
            "register_demo_janitor_hook was not passed in the plugin context"
        )
        assert captured["register_demo_janitor_hook"] is server.register_demo_janitor_hook

    conn = getattr(getattr(server, "meta_db", None), "conn", None)
    if conn is not None:
        conn.close()
    # Clean up janitor state so it doesn't bleed into other tests.
    server._DEMO_JANITOR_STOP.set()
    thread = server._DEMO_JANITOR_THREAD
    if thread is not None:
        thread.join(timeout=2)
    server._DEMO_JANITOR_STARTED = False
    server._DEMO_JANITOR_THREAD = None
    with server._DEMO_JANITOR_HOOKS_LOCK:
        server._DEMO_JANITOR_HOOKS.clear()
