"""Tests for plugins/__init__.py — namespace isolation for sibling
modules and startup-time collision detection (slopsmith#33).

The plugin loader used to insert each plugin directory onto `sys.path`,
which made bare `import sibling` fall through Python's per-name cache
in `sys.modules`. Two plugins shipping a same-named top-level module
(`extractor.py`, `util.py`, …) would step on each other. The loader
now exposes `context['load_sibling'](name)` that loads the sibling
under a namespaced module name `plugin_{plugin_id}_{name}`, plus a
warning at startup so existing plugins are visible.
"""

import importlib
import json
import sys

import pytest


@pytest.fixture()
def reset_plugin_state():
    """Clear loader module-level state and restore on teardown.

    `plugins.LOADED_PLUGINS` and any `plugin_*` keys we add to
    `sys.modules` would otherwise leak across tests within a session.
    """
    plugins = importlib.import_module("plugins")
    saved_loaded = list(plugins.LOADED_PLUGINS)
    saved_modules = {k: v for k, v in sys.modules.items() if k.startswith("plugin_")}
    plugins.LOADED_PLUGINS.clear()
    for k in list(sys.modules):
        if k.startswith("plugin_"):
            del sys.modules[k]
    try:
        yield plugins
    finally:
        plugins.LOADED_PLUGINS.clear()
        plugins.LOADED_PLUGINS.extend(saved_loaded)
        for k in list(sys.modules):
            if k.startswith("plugin_"):
                del sys.modules[k]
        sys.modules.update(saved_modules)


def _make_plugin(plugin_root, plugin_id, *, sibling_files=None, routes_body=None):
    """Create a minimal plugin directory under `plugin_root`.

    `sibling_files` is a dict of `{module_name: file_body}` written as
    `{module_name}.py` next to routes. `routes_body` is the contents of
    routes.py — defaults to a no-op `setup` so the plugin loads cleanly.
    """
    plugin_dir = plugin_root / plugin_id
    plugin_dir.mkdir(parents=True)
    (plugin_dir / "plugin.json").write_text(
        json.dumps({"id": plugin_id, "name": plugin_id, "routes": "routes.py"})
    )
    (plugin_dir / "routes.py").write_text(
        routes_body if routes_body is not None else "def setup(app, ctx):\n    pass\n"
    )
    for name, body in (sibling_files or {}).items():
        (plugin_dir / f"{name}.py").write_text(body)
    return plugin_dir


def _run_load_plugins(plugins, app, tmp_path, context=None):
    """Drive load_plugins against a tmp plugin root, restoring module
    state on the way out so each test is isolated."""
    saved_dir = plugins.PLUGINS_DIR
    plugins.PLUGINS_DIR = tmp_path
    try:
        plugins.load_plugins(app, context if context is not None else {})
    finally:
        plugins.PLUGINS_DIR = saved_dir


def test_load_sibling_returns_per_plugin_namespaced_modules(tmp_path, reset_plugin_state):
    """Two plugins shipping `extractor.py` with different exports must
    each see their OWN file via load_sibling — no cross-contamination."""
    plugins = reset_plugin_state
    _make_plugin(
        tmp_path, "alpha",
        sibling_files={"extractor": "MANIFEST_DIR = 'alpha-manifest'\n"},
        routes_body=(
            "def setup(app, ctx):\n"
            "    extractor = ctx['load_sibling']('extractor')\n"
            "    app.state.alpha_manifest = extractor.MANIFEST_DIR\n"
        ),
    )
    _make_plugin(
        tmp_path, "beta",
        sibling_files={"extractor": "BETA_VALUE = 42\n"},
        routes_body=(
            "def setup(app, ctx):\n"
            "    extractor = ctx['load_sibling']('extractor')\n"
            "    app.state.beta_value = extractor.BETA_VALUE\n"
        ),
    )
    fake_app = type("FakeApp", (), {})()
    fake_app.state = type("State", (), {})()
    _run_load_plugins(plugins, fake_app, tmp_path)
    assert fake_app.state.alpha_manifest == "alpha-manifest"
    assert fake_app.state.beta_value == 42
    # The two extractors are namespaced into distinct sys.modules
    # entries. `.` separates id and name to disambiguate when either
    # contains underscores.
    alpha_mod = sys.modules["plugin_alpha.extractor"]
    beta_mod = sys.modules["plugin_beta.extractor"]
    assert alpha_mod is not beta_mod
    assert getattr(alpha_mod, "MANIFEST_DIR", None) == "alpha-manifest"
    assert getattr(beta_mod, "BETA_VALUE", None) == 42
    # Negative cross-check: alpha's extractor must NOT carry beta's exports.
    assert not hasattr(alpha_mod, "BETA_VALUE")
    assert not hasattr(beta_mod, "MANIFEST_DIR")


def test_load_sibling_caches_repeat_calls(tmp_path, reset_plugin_state):
    """Two `load_sibling('util')` calls within the same plugin return
    the identical module object — no double exec_module."""
    plugins = reset_plugin_state
    _make_plugin(
        tmp_path, "cached",
        sibling_files={"util": "INSTANCE = object()\n"},
        routes_body=(
            "def setup(app, ctx):\n"
            "    a = ctx['load_sibling']('util')\n"
            "    b = ctx['load_sibling']('util')\n"
            "    app.state.same = a is b\n"
            "    app.state.instance = a.INSTANCE\n"
        ),
    )
    fake_app = type("FakeApp", (), {})()
    fake_app.state = type("State", (), {})()
    _run_load_plugins(plugins, fake_app, tmp_path)
    assert fake_app.state.same is True
    assert fake_app.state.instance is sys.modules["plugin_cached.util"].INSTANCE


def test_load_sibling_missing_module_raises_import_error(tmp_path, reset_plugin_state):
    plugins = reset_plugin_state
    plugin_dir = _make_plugin(tmp_path, "bare")
    with pytest.raises(ImportError):
        plugins._load_plugin_sibling("bare", plugin_dir, "does_not_exist")


def test_load_sibling_rejects_traversal_and_suffix(tmp_path, reset_plugin_state):
    """The helper takes a bare module name; reject anything that could
    traverse paths or carry a redundant .py suffix."""
    plugins = reset_plugin_state
    plugin_dir = _make_plugin(tmp_path, "p")
    # Reject:
    # - empty / non-string (bare module name required)
    # - path traversal (`/`, `\`, `../`)
    # - redundant `.py` suffix
    # - any `.` (used as separator in the cache key — would
    #   otherwise allow ambiguous keys)
    for bad in ("", "../etc", "sub/util", "util.py", "pkg.helper", 123, None):
        with pytest.raises((ValueError, TypeError)):
            plugins._load_plugin_sibling("p", plugin_dir, bad)


def test_collision_warning_fires_for_shared_module_name(tmp_path, reset_plugin_state, capsys):
    """Two plugins both shipping extractor.py must trigger the warning."""
    plugins = reset_plugin_state
    _make_plugin(tmp_path, "rs1extract", sibling_files={"extractor": "X = 1\n"})
    _make_plugin(tmp_path, "discextract", sibling_files={"extractor": "Y = 2\n"})
    _run_load_plugins(plugins, type("FakeApp", (), {})(), tmp_path)
    out = capsys.readouterr().out
    assert "Module-name collision warning" in out
    assert "'extractor' (module)" in out
    assert "rs1extract" in out
    assert "discextract" in out


def test_collision_warning_silent_when_names_unique(tmp_path, reset_plugin_state, capsys):
    plugins = reset_plugin_state
    _make_plugin(tmp_path, "alpha", sibling_files={"alpha_helper": "A = 1\n"})
    _make_plugin(tmp_path, "beta", sibling_files={"beta_helper": "B = 2\n"})
    _run_load_plugins(plugins, type("FakeApp", (), {})(), tmp_path)
    out = capsys.readouterr().out
    assert "Module-name collision warning" not in out


def test_collision_warning_excludes_routes_and_dunders(tmp_path, reset_plugin_state, capsys):
    """routes.py is already namespaced by the loader; __init__.py
    belongs to a plugin that opted into being a package and namespaces
    itself. Neither should trip the collision warning even when both
    plugins ship one."""
    plugins = reset_plugin_state
    p1 = _make_plugin(tmp_path, "one", sibling_files={"unique_one": "V = 1\n"})
    p2 = _make_plugin(tmp_path, "two", sibling_files={"unique_two": "V = 2\n"})
    (p1 / "__init__.py").write_text("")
    (p2 / "__init__.py").write_text("")
    _run_load_plugins(plugins, type("FakeApp", (), {})(), tmp_path)
    out = capsys.readouterr().out
    assert "Module-name collision warning" not in out


def test_load_sibling_disambiguates_underscored_ids_and_names(tmp_path, reset_plugin_state):
    """`(plugin_id='a_b', name='c')` and `(plugin_id='a', name='b_c')`
    must NOT collide in sys.modules. The `.` separator makes the cache
    key unambiguous (the old `_` separator collapsed both to
    `plugin_a_b_c`). Codex review on PR for slopsmith#33."""
    plugins = reset_plugin_state
    p1 = _make_plugin(tmp_path, "a_b", sibling_files={"c": "WHO = 'a_b/c'\n"})
    p2 = _make_plugin(tmp_path, "a", sibling_files={"b_c": "WHO = 'a/b_c'\n"})
    m1 = plugins._load_plugin_sibling("a_b", p1, "c")
    m2 = plugins._load_plugin_sibling("a", p2, "b_c")
    assert m1 is not m2
    assert m1.WHO == "a_b/c"
    assert m2.WHO == "a/b_c"
    # Both keys exist independently in sys.modules.
    assert "plugin_a_b.c" in sys.modules
    assert "plugin_a.b_c" in sys.modules
    assert sys.modules["plugin_a_b.c"] is m1
    assert sys.modules["plugin_a.b_c"] is m2


def test_collision_warning_detects_package_form(tmp_path, reset_plugin_state, capsys):
    """A plugin shipping `extractor/__init__.py` collides with another
    plugin's `extractor.py` the same way two `.py` files would. The
    scanner picks up packages too. Codex review on PR for slopsmith#33."""
    plugins = reset_plugin_state
    # Plugin one: extractor.py
    _make_plugin(tmp_path, "as_module", sibling_files={"extractor": "X = 1\n"})
    # Plugin two: extractor/ (package form)
    plugin_pkg = _make_plugin(tmp_path, "as_package")
    pkg_dir = plugin_pkg / "extractor"
    pkg_dir.mkdir()
    (pkg_dir / "__init__.py").write_text("Y = 2\n")
    _run_load_plugins(plugins, type("FakeApp", (), {})(), tmp_path)
    out = capsys.readouterr().out
    assert "Module-name collision warning" in out
    assert "extractor" in out
    assert "as_module" in out
    assert "as_package" in out
    # The mixed-form label should also appear so the maintainer knows
    # to look for both shapes.
    assert "module/package" in out


def test_collision_warning_detects_two_packages(tmp_path, reset_plugin_state, capsys):
    """Two plugins each shipping the SAME package directory form."""
    plugins = reset_plugin_state
    for pid in ("plug_a", "plug_b"):
        plugin_dir = _make_plugin(tmp_path, pid)
        pkg = plugin_dir / "shared_pkg"
        pkg.mkdir()
        (pkg / "__init__.py").write_text(f"# {pid}\n")
    _run_load_plugins(plugins, type("FakeApp", (), {})(), tmp_path)
    out = capsys.readouterr().out
    assert "Module-name collision warning" in out
    assert "shared_pkg" in out
    assert "plug_a" in out
    assert "plug_b" in out


def test_per_plugin_context_does_not_leak_load_sibling_across_plugins(tmp_path, reset_plugin_state):
    """Plugin A's `load_sibling` must close over plugin A's id+dir.
    If both plugins received the SAME closure (the bug we are
    preventing), plugin A calling `load_sibling('thing')` would
    load whatever the loop's last-iteration closure pointed at —
    typically the alphabetically-last plugin's directory."""
    plugins = reset_plugin_state
    _make_plugin(
        tmp_path, "aaa",
        sibling_files={"thing": "ORIGIN = 'aaa'\n"},
        routes_body=(
            "def setup(app, ctx):\n"
            "    app.state.aaa_origin = ctx['load_sibling']('thing').ORIGIN\n"
        ),
    )
    _make_plugin(
        tmp_path, "zzz",
        sibling_files={"thing": "ORIGIN = 'zzz'\n"},
        routes_body=(
            "def setup(app, ctx):\n"
            "    app.state.zzz_origin = ctx['load_sibling']('thing').ORIGIN\n"
        ),
    )
    fake_app = type("FakeApp", (), {})()
    fake_app.state = type("State", (), {})()
    _run_load_plugins(plugins, fake_app, tmp_path)
    assert fake_app.state.aaa_origin == "aaa"
    assert fake_app.state.zzz_origin == "zzz"
