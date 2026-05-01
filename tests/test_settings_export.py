"""Tests for /api/settings/export and /api/settings/import (slopsmith#113).

The bundle round-trip covers four persistence stores; this file exercises
the two server-managed ones (server config + plugin server-side files).
The frontend localStorage layer is browser-only and out of scope here.

Each test stubs `LOADED_PLUGINS` directly rather than spinning up the
plugin loader — the loader's job (manifest parsing → `_export_paths`)
is exercised separately in `test_plugins.py`.
"""

import base64
import importlib
import json
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def server_mod(tmp_path, monkeypatch):
    monkeypatch.setenv("CONFIG_DIR", str(tmp_path))
    sys.modules.pop("server", None)
    mod = importlib.import_module("server")
    yield mod
    conn = getattr(getattr(mod, "meta_db", None), "conn", None)
    if conn is not None:
        conn.close()


@pytest.fixture()
def client(server_mod):
    c = TestClient(server_mod.app)
    try:
        yield c
    finally:
        c.close()


def _stub_plugin(server_mod, plugin_id: str, export_paths: list[str]):
    """Append a fake plugin record to LOADED_PLUGINS so export/import see
    it. The loader is bypassed entirely — the only fields the endpoints
    consult are `id` and `_export_paths`."""
    from plugins import LOADED_PLUGINS
    LOADED_PLUGINS.append({
        "id": plugin_id,
        "name": plugin_id,
        "nav": None,
        "type": None,
        "has_screen": False,
        "has_script": False,
        "has_settings": False,
        "_export_paths": export_paths,
        "_dir": Path("."),
        "_manifest": {},
    })


@pytest.fixture(autouse=True)
def reset_loaded_plugins():
    """LOADED_PLUGINS is module-level state in plugins/__init__.py — it
    persists across tests within the same pytest process and gets
    populated by `load_plugins()` on import. Snapshot/restore so each
    test starts from the post-import baseline rather than carrying
    fakes from previous tests."""
    from plugins import LOADED_PLUGINS
    snapshot = list(LOADED_PLUGINS)
    yield
    LOADED_PLUGINS.clear()
    LOADED_PLUGINS.extend(snapshot)


# ── Round-trip: server config only, no plugins ──────────────────────────────

def test_round_trip_no_plugins(client, tmp_path):
    (tmp_path / "config.json").write_text(json.dumps({
        "dlc_dir": "/some/path",
        "default_arrangement": "Lead",
        "master_difficulty": 75,
    }))

    bundle = client.get("/api/settings/export").json()
    assert bundle["schema"] == 1
    assert bundle["server_config"]["master_difficulty"] == 75
    assert bundle["server_config"]["default_arrangement"] == "Lead"

    # Wipe and re-import
    (tmp_path / "config.json").unlink()
    r = client.post("/api/settings/import", json=bundle)
    assert r.status_code == 200, r.json()
    assert r.json()["ok"] is True

    cfg = json.loads((tmp_path / "config.json").read_text())
    assert cfg["master_difficulty"] == 75
    assert cfg["default_arrangement"] == "Lead"


# ── Round-trip: plugin server files (binary + json + nested dir) ────────────

def test_round_trip_with_plugin_files(client, server_mod, tmp_path):
    _stub_plugin(server_mod, "fake_plugin", ["fake_plugin.db", "fake_models/"])

    # Stage some files.
    binary = bytes(range(256)) * 4  # 1 KiB of binary noise
    (tmp_path / "fake_plugin.db").write_bytes(binary)
    (tmp_path / "fake_models").mkdir()
    (tmp_path / "fake_models" / "a.json").write_text(json.dumps({"k": "v"}))
    (tmp_path / "fake_models" / "sub").mkdir()
    (tmp_path / "fake_models" / "sub" / "b.bin").write_bytes(b"\x00\x01\x02")

    bundle = client.get("/api/settings/export").json()
    files = bundle["plugin_server_configs"]["fake_plugin"]["files"]
    assert "fake_plugin.db" in files
    assert files["fake_plugin.db"]["encoding"] == "base64"
    assert "fake_models/a.json" in files
    assert files["fake_models/a.json"]["encoding"] == "json"
    assert files["fake_models/a.json"]["data"] == {"k": "v"}
    assert "fake_models/sub/b.bin" in files
    assert files["fake_models/sub/b.bin"]["encoding"] == "base64"

    # Wipe everything plugin-owned, then import.
    (tmp_path / "fake_plugin.db").unlink()
    import shutil
    shutil.rmtree(tmp_path / "fake_models")

    r = client.post("/api/settings/import", json=bundle)
    assert r.status_code == 200, r.json()

    assert (tmp_path / "fake_plugin.db").read_bytes() == binary
    assert json.loads((tmp_path / "fake_models" / "a.json").read_text()) == {"k": "v"}
    assert (tmp_path / "fake_models" / "sub" / "b.bin").read_bytes() == b"\x00\x01\x02"


# ── Schema gating ───────────────────────────────────────────────────────────

def test_schema_mismatch_refused(client, tmp_path):
    (tmp_path / "config.json").write_text(json.dumps({"master_difficulty": 50}))
    pre_mtime = (tmp_path / "config.json").stat().st_mtime_ns

    r = client.post("/api/settings/import", json={
        "schema": 2,
        "server_config": {"master_difficulty": 99},
    })
    assert r.status_code == 400
    assert "schema" in r.json()["error"].lower()

    # Disk untouched.
    assert (tmp_path / "config.json").stat().st_mtime_ns == pre_mtime
    assert json.loads((tmp_path / "config.json").read_text())["master_difficulty"] == 50


def test_missing_schema_refused(client):
    r = client.post("/api/settings/import", json={"server_config": {}})
    assert r.status_code == 400


def test_non_dict_body_refused(client):
    # FastAPI's body validation (`bundle: dict` in the handler signature)
    # produces 422 before our phase-1 check runs; the explicit `isinstance`
    # guard inside the handler covers the case where someone calls the
    # function directly. Either way, non-dict input never reaches the
    # filesystem.
    r = client.post("/api/settings/import", json=[])
    assert r.status_code in (400, 422)


# ── Version warning is non-blocking ─────────────────────────────────────────

def test_version_warning_nonblocking(client, tmp_path, server_mod):
    bundle = {
        "schema": 1,
        "slopsmith_version": "999.999.999",
        "server_config": {"master_difficulty": 42},
        "plugin_server_configs": {},
    }
    r = client.post("/api/settings/import", json=bundle)
    assert r.status_code == 200, r.json()
    body = r.json()
    assert body["ok"] is True
    assert any("version mismatch" in w for w in body["warnings"])
    assert json.loads((tmp_path / "config.json").read_text())["master_difficulty"] == 42


# ── Path traversal / absolute path / undeclared file ─────────────────────────

def test_path_traversal_rejected(client, server_mod, tmp_path):
    _stub_plugin(server_mod, "fake_plugin", ["fake_plugin.db"])
    pre = json.dumps({"master_difficulty": 50})
    (tmp_path / "config.json").write_text(pre)

    bundle = {
        "schema": 1,
        "server_config": {"master_difficulty": 99},
        "plugin_server_configs": {
            "fake_plugin": {
                "files": {
                    "../../etc/passwd": {"encoding": "base64", "data": ""},
                },
            },
        },
    }
    r = client.post("/api/settings/import", json=bundle)
    assert r.status_code == 400
    # Server config also untouched — phase-1 validation refused before
    # any disk write.
    assert json.loads((tmp_path / "config.json").read_text())["master_difficulty"] == 50


@pytest.mark.parametrize("bad", ["/etc/passwd", "C:/Windows/foo", r"C:\Windows\foo"])
def test_absolute_path_rejected(client, server_mod, bad):
    _stub_plugin(server_mod, "fake_plugin", ["fake_plugin.db"])
    bundle = {
        "schema": 1,
        "server_config": {},
        "plugin_server_configs": {
            "fake_plugin": {"files": {bad: {"encoding": "base64", "data": ""}}},
        },
    }
    r = client.post("/api/settings/import", json=bundle)
    assert r.status_code == 400


def test_undeclared_file_skipped_with_warning(client, server_mod, tmp_path):
    """A file in the bundle whose plugin no longer declares it (manifest
    tightened between export and import) is skipped with a warning, not
    a hard 400. The bundle's other files still apply. Path-traversal
    attempts (covered separately) remain hard failures."""
    _stub_plugin(server_mod, "fake_plugin", ["fake_plugin.db"])
    bundle = {
        "schema": 1,
        "server_config": {"master_difficulty": 77},
        "plugin_server_configs": {
            "fake_plugin": {
                "files": {
                    "fake_plugin.db": {"encoding": "base64", "data": base64.b64encode(b"new").decode()},
                    "secrets/api.key": {"encoding": "base64", "data": base64.b64encode(b"k").decode()},
                },
            },
        },
    }
    r = client.post("/api/settings/import", json=bundle)
    assert r.status_code == 200, r.json()
    body = r.json()
    assert body["ok"] is True
    assert any("secrets/api.key" in w for w in body["warnings"])
    # Declared file applied.
    assert (tmp_path / "fake_plugin.db").read_bytes() == b"new"
    # Undeclared file NOT written.
    assert not (tmp_path / "secrets" / "api.key").exists()
    # Server config still applied.
    assert json.loads((tmp_path / "config.json").read_text())["master_difficulty"] == 77


# ── Unknown plugin: skip with warning, don't fail ───────────────────────────

def test_unknown_plugin_skipped(client, tmp_path):
    bundle = {
        "schema": 1,
        "server_config": {"master_difficulty": 33},
        "plugin_server_configs": {
            "mystery_plugin": {
                "files": {"any.txt": {"encoding": "base64", "data": ""}},
            },
        },
    }
    r = client.post("/api/settings/import", json=bundle)
    assert r.status_code == 200, r.json()
    body = r.json()
    assert body["ok"] is True
    assert any("mystery_plugin" in w and "not loaded" in w for w in body["warnings"])
    assert "mystery_plugin" not in body["applied"]["plugins"]
    # Server config still applied.
    assert json.loads((tmp_path / "config.json").read_text())["master_difficulty"] == 33


# ── Atomicity: bad encoding rejects whole bundle in phase 1 ─────────────────

def test_atomicity_on_decode_failure(client, server_mod, tmp_path):
    _stub_plugin(server_mod, "fake_plugin", ["fake_plugin.db"])
    (tmp_path / "config.json").write_text(json.dumps({"master_difficulty": 50}))
    (tmp_path / "fake_plugin.db").write_bytes(b"original")

    bundle = {
        "schema": 1,
        "server_config": {"master_difficulty": 99},
        "plugin_server_configs": {
            "fake_plugin": {
                "files": {
                    "fake_plugin.db": {"encoding": "base64", "data": "this is not base64!!!"},
                },
            },
        },
    }
    r = client.post("/api/settings/import", json=bundle)
    assert r.status_code == 400
    assert json.loads((tmp_path / "config.json").read_text())["master_difficulty"] == 50
    assert (tmp_path / "fake_plugin.db").read_bytes() == b"original"


def test_unknown_encoding_rejected(client, server_mod, tmp_path):
    _stub_plugin(server_mod, "fake_plugin", ["fake_plugin.db"])
    bundle = {
        "schema": 1,
        "server_config": {},
        "plugin_server_configs": {
            "fake_plugin": {
                "files": {
                    "fake_plugin.db": {"encoding": "rot13", "data": "abc"},
                },
            },
        },
    }
    r = client.post("/api/settings/import", json=bundle)
    assert r.status_code == 400


# ── Export edge cases ───────────────────────────────────────────────────────

def test_export_skips_missing_files(client, server_mod):
    _stub_plugin(server_mod, "fake_plugin", ["does_not_exist.db", "absent_dir/"])
    bundle = client.get("/api/settings/export").json()
    # Plugin block is present but files map is empty — we still emit the
    # block so a round-trip preserves the manifest's namespace.
    assert bundle["plugin_server_configs"]["fake_plugin"]["files"] == {}


def test_export_directory_walk(client, server_mod, tmp_path):
    _stub_plugin(server_mod, "fake_plugin", ["models/"])
    (tmp_path / "models").mkdir()
    (tmp_path / "models" / "a.bin").write_bytes(b"a")
    (tmp_path / "models" / "b.bin").write_bytes(b"b")
    (tmp_path / "models" / "nested").mkdir()
    (tmp_path / "models" / "nested" / "c.bin").write_bytes(b"c")

    bundle = client.get("/api/settings/export").json()
    files = bundle["plugin_server_configs"]["fake_plugin"]["files"]
    assert set(files.keys()) == {"models/a.bin", "models/b.bin", "models/nested/c.bin"}


def test_export_includes_schema_and_version(client):
    bundle = client.get("/api/settings/export").json()
    assert bundle["schema"] == 1
    assert "slopsmith_version" in bundle
    assert "exported_at" in bundle


# ── Empty bundle round-trip (defaults config) ───────────────────────────────

def test_import_with_empty_plugin_blocks(client, tmp_path):
    bundle = {
        "schema": 1,
        "server_config": {"master_difficulty": 80},
        "plugin_server_configs": {},
    }
    r = client.post("/api/settings/import", json=bundle)
    assert r.status_code == 200
    assert json.loads((tmp_path / "config.json").read_text())["master_difficulty"] == 80


def test_import_rejects_non_dict_server_config(client):
    r = client.post("/api/settings/import", json={
        "schema": 1,
        "server_config": [],
        "plugin_server_configs": {},
    })
    assert r.status_code == 400


def test_import_rejects_non_dict_plugin_blocks(client):
    r = client.post("/api/settings/import", json={
        "schema": 1,
        "server_config": {},
        "plugin_server_configs": "not an object",
    })
    assert r.status_code == 400
