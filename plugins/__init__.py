"""Plugin discovery and loading system."""

import importlib.util
import json
import os
import subprocess
import sys
from pathlib import Path
from fastapi import FastAPI
from fastapi.responses import HTMLResponse, Response


PLUGINS_DIR = Path(__file__).parent
LOADED_PLUGINS = []

# Persistent pip install location (survives container restarts)
_PIP_TARGET = Path(os.environ.get("CONFIG_DIR", "/config")) / "pip_packages"

# Per-module-name locks for `_load_plugin_sibling` so two threads
# calling `ctx['load_sibling']('extractor')` concurrently don't both
# see the half-initialized module after the first has registered it
# in sys.modules but before exec_module finishes. Stored in a dict
# guarded by an outer lock — a fresh per-name lock is created on
# first contention. Spotted by codex review on PR for slopsmith#33.
import threading as _threading
_sibling_lock_dict_lock = _threading.Lock()
_sibling_locks: dict[str, _threading.Lock] = {}


def _get_sibling_lock(module_name: str) -> _threading.Lock:
    with _sibling_lock_dict_lock:
        lock = _sibling_locks.get(module_name)
        if lock is None:
            lock = _threading.Lock()
            _sibling_locks[module_name] = lock
        return lock


def _safe_plugin_id_for_module_name(plugin_id: str) -> str:
    """Bijectively encode a plugin_id for safe use as part of a Python
    module name.

    Plugin ids are opaque manifest values that can take reverse-DNS
    forms (`com.example.foo`) or contain other characters that
    Python's import machinery interprets specially — most
    importantly `.`, which it treats as a package boundary.

    The encoding is **bijective** so distinct plugin_ids always map
    to distinct encoded strings (otherwise two installed plugins
    could share a cache-key prefix and reintroduce the cross-plugin
    collision this PR is fixing). To make `_<hex>_` sequences in
    the output ONLY appear as a result of intentional escapes, the
    underscore is encoded first:

      `_` → `_5f_`   (hex of `_`)
      `.` → `_2e_`   (hex of `.`, applied after the `_` pass)

    With this scheme:
      `foo`            → `foo`
      `foo_bar`        → `foo_5f_bar`
      `foo.bar`        → `foo_2e_bar`
      `foo_2e_bar`     → `foo_5f_2e_5f_bar`  (distinct from `foo.bar`)
      `com.example.x`  → `com_2e_example_2e_x`

    Spotted across multiple Copilot review rounds on PR #105.
    """
    return plugin_id.replace("_", "_5f_").replace(".", "_2e_")


def _load_plugin_sibling(plugin_id: str, plugin_dir: Path, name: str):
    """Load a sibling module from a plugin's directory under a namespaced
    module name (`plugin_<plugin_id>.<name>`, with plugin_id
    bijectively encoded by `_safe_plugin_id_for_module_name` —
    `_` -> `_5f_`, `.` -> `_2e_`). Both single-file siblings
    (`extractor.py`) and package-form siblings (`extractor/__init__.py`)
    are supported; package form wins when both exist (matches CPython's
    import precedence). Mirrors the routes-loading pattern in
    `load_plugins()` and shares its `sys.modules` cache, so two plugins
    that each ship `extractor.py` get distinct cached modules instead
    of stomping each other through `sys.path`. See slopsmith#33."""
    if not isinstance(plugin_id, str) or not plugin_id:
        raise ValueError(
            f"load_sibling: plugin_id must be a non-empty string, got {plugin_id!r}"
        )
    safe_plugin_id = _safe_plugin_id_for_module_name(plugin_id)
    if (
        not isinstance(name, str)
        or not name
        or "/" in name
        or "\\" in name
        or "." in name
        or name.endswith(".py")
    ):
        # Reject path traversal, the redundant `.py` suffix, and any
        # `.` (used as our separator below). The helper takes a bare
        # module name; reject empty / non-string early so the
        # spec_from_file_location error path doesn't have to
        # disambiguate.
        raise ValueError(
            f"plugin {plugin_id!r}: load_sibling expects a bare module name, got {name!r}"
        )
    # Use `.` as the separator between id and name so the cache key
    # is unambiguous when plugin_ids or names contain underscores —
    # an `_` separator would collide when (id='a_b', name='c') and
    # (id='a', name='b_c') both map to `plugin_a_b_c`. `.` is
    # rejected in `name` above; `.` in plugin_id is escaped via
    # `safe_plugin_id` so the separator stays unambiguous. Spotted
    # across multiple codex review rounds on PR for slopsmith#33.
    parent_name = f"plugin_{safe_plugin_id}"
    module_name = f"{parent_name}.{name}"
    # NB: no pre-lock cached lookup here. A concurrent first-time
    # caller can briefly observe a half-initialized module that the
    # FIRST caller registered via `sys.modules[module_name] = module`
    # before `exec_module` finished. The cached check happens inside
    # the lock below so it serializes against the load. Spotted by
    # codex review on PR for slopsmith#33 round 8.
    # Resolve `name` to either a top-level `.py` file (`extractor.py`)
    # or a package directory (`extractor/__init__.py`). Package form
    # is documented as a valid plugin layout (the collision-warning
    # scanner detects it) so it must be loadable here too. Spotted
    # by codex review on PR for slopsmith#33.
    # Match CPython's import-resolution precedence: regular packages
    # win over same-named `.py` modules. If a plugin ships both
    # `extractor.py` and `extractor/__init__.py`, bare `import
    # extractor` and `load_sibling('extractor')` must execute the
    # same code path so plugins don't see split state. Spotted by
    # codex review on PR for slopsmith#33.
    file_path = plugin_dir / f"{name}.py"
    pkg_init = plugin_dir / name / "__init__.py"
    submodule_search = None
    if pkg_init.is_file():
        sibling_path = pkg_init
        # Tell the import system that this is a package whose
        # submodules can be looked up under `plugin_{id}.{name}.X`.
        submodule_search = [str(pkg_init.parent)]
    elif file_path.is_file():
        sibling_path = file_path
    else:
        raise ImportError(
            f"plugin {plugin_id!r}: no sibling module {name!r} at "
            f"{file_path} or {pkg_init}"
        )
    # Register a synthetic parent package so relative imports inside
    # a sibling (e.g. `helper.py` doing `from .shared import X`, or
    # a sibling package's `__init__.py` doing the same) and explicit
    # lookups of `plugin_<id>.<name>` submodules can resolve through
    # the parent. The parent's `__path__` points at the plugin's
    # directory so the standard import machinery can FIND those
    # siblings — that's what relative imports ultimately consult. It
    # does NOT undermine the namespace isolation, because:
    #   • bare `import sibling` still goes through sys.path (the
    #     transition fallback for plugins that haven't migrated)
    #   • `import plugin_<id>.sibling` lands in the namespaced
    #     sys.modules entry — same key load_sibling uses, so caching
    #     stays coherent
    # Done BEFORE the bare-reuse check below so a mixed-migration
    # package sibling still ends up with its parent registered.
    # Spotted by codex review on PR for slopsmith#33.
    # Use setdefault so two threads loading different siblings for
    # the same plugin can't both pass an `in sys.modules` check and
    # then overwrite each other's parent registration. Without this,
    # a losing thread's freshly-built parent would replace the
    # winner's parent that already had child attributes attached
    # via setattr below — `from . import sibling` lookups would
    # then fail. setdefault is atomic under the GIL, so the loser's
    # ModuleType is silently discarded. Spotted by Copilot review
    # on PR #105 round 2.
    import types
    new_parent = types.ModuleType(parent_name)
    new_parent.__path__ = [str(plugin_dir)]
    sys.modules.setdefault(parent_name, new_parent)
    # NB: We DON'T reuse bare-imported same-named modules here. The
    # alias path looked attractive — module-level singletons stay
    # shared across `import sibling` and `load_sibling('sibling')` —
    # but the bare module's `__package__`/`__spec__.name`/`__name__`
    # remain set to the un-namespaced bare name. Any relative import
    # that runs after the alias (lazy `from .shared import X` inside
    # a function, or `importlib.import_module(__package__ + '.X')`)
    # then routes through the bare global cache, undoing the
    # isolation. The right answer for plugins that mix bare imports
    # with load_sibling on the SAME module is "stop mixing"; the
    # transition cost is that the module's state exists under two
    # cache keys until the bare imports are removed. Documented in
    # CLAUDE.md / codex review on PR for slopsmith#33.

    # Per-module lock so concurrent first-time callers of load_sibling
    # serialize through exec_module — the second caller waits for the
    # first to finish before observing the registered module instead
    # of seeing a half-initialized object. Spotted by codex review on
    # PR for slopsmith#33.
    with _get_sibling_lock(module_name):
        cached = sys.modules.get(module_name)
        if cached is not None:
            return cached
        spec = importlib.util.spec_from_file_location(
            module_name,
            str(sibling_path),
            submodule_search_locations=submodule_search,
        )
        if spec is None or spec.loader is None:
            raise ImportError(
                f"plugin {plugin_id!r}: could not build import spec for {name!r}"
            )
        module = importlib.util.module_from_spec(spec)
        # Register before exec so the sibling can self-reference (e.g.
        # for internal `import plugin_<id>.helper` patterns) without
        # infinite recursion through this helper. Concurrent callers
        # don't observe this half-initialized state because they're
        # blocked on the lock.
        sys.modules[module_name] = module
        try:
            spec.loader.exec_module(module)
        except BaseException:
            # On exec failure, drop the half-initialized module so a
            # retry doesn't return the broken object from cache.
            sys.modules.pop(module_name, None)
            raise
        # Expose the loaded child as an attribute on the synthetic
        # parent. Python's standard import machinery does this after
        # `_find_and_load` so that `from . import sibling` and
        # `from .. import sibling` work via attribute lookup. Without
        # it, plugins that mix load_sibling with package-style
        # relative imports get `ImportError: cannot import name
        # 'sibling' from 'plugin_<id>'` even though sys.modules has
        # the module. Spotted by codex review on PR for slopsmith#33
        # round 9.
        parent = sys.modules.get(parent_name)
        if parent is not None:
            setattr(parent, name, module)
        return module


def _warn_on_module_collisions(plugin_specs):
    """Scan top-level importable modules across all plugins about to
    be loaded. Print a warning for any module name shipped by 2+
    plugins, since bare `import <name>` from those plugins will hit
    the sys.path-based cache and cross-load (slopsmith#33).

    Both top-level `.py` files AND top-level packages (directories
    containing `__init__.py`) are scanned — the same collision
    pattern applies to either, e.g. one plugin's `extractor.py` vs
    another plugin's `extractor/__init__.py` both produce a shared
    `sys.modules['extractor']` entry. Spotted by codex review on
    PR for slopsmith#33.

    `routes.py` itself is excluded because the loader already
    namespaces it as `plugin_{id}_routes`. Top-level dunder files
    (like a hypothetical bare `__main__.py`) are excluded too.

    `plugin_specs` is a list of `(plugin_id, plugin_dir)` tuples for
    plugins the loader has decided to load (post-dedup).
    """
    # Map: module_name -> {plugin_id: set_of_kinds}.
    # Using a per-plugin nested dict deduplicates the case where ONE
    # plugin ships both `extractor.py` and `extractor/__init__.py`
    # — that intra-plugin layout is supported by load_sibling
    # (package form wins, matching CPython precedence) and shouldn't
    # trip a cross-plugin collision warning. Spotted by codex review
    # on PR for slopsmith#33.
    by_name: dict[str, dict[str, set[str]]] = {}
    for plugin_id, plugin_dir in plugin_specs:
        try:
            for child in plugin_dir.iterdir():
                module_name = None
                kind = None
                if child.is_file() and child.suffix == ".py":
                    if child.name == "routes.py" or child.name.startswith("__"):
                        continue
                    module_name = child.stem
                    kind = "module"
                elif child.is_dir() and (child / "__init__.py").is_file():
                    if child.name.startswith("__"):
                        continue
                    module_name = child.name
                    kind = "package"
                if module_name is None:
                    continue
                by_name.setdefault(module_name, {}).setdefault(plugin_id, set()).add(kind)
        except OSError:
            # Unreadable plugin dir — the per-plugin load below will
            # surface the error in a more useful place; don't warn here.
            continue
    for name, by_plugin in by_name.items():
        # Count distinct plugin ids — only fire when MULTIPLE plugins
        # ship the same module name. A single plugin shipping the
        # name in multiple forms is fine.
        if len(by_plugin) < 2:
            continue
        ids_quoted = ", ".join(f"'{pid}'" for pid in sorted(by_plugin))
        # Aggregate kinds across all plugins to label the warning.
        kinds = {k for kind_set in by_plugin.values() for k in kind_set}
        kind_label = "module/package" if len(kinds) > 1 else next(iter(kinds))
        print(
            f"[Plugin] Module-name collision warning: '{name}' "
            f"({kind_label}) is shipped by {len(by_plugin)} plugins "
            f"({ids_quoted}). Bare `import {name}` may load the wrong "
            f"file. Migrate to context['load_sibling']('{name}') — "
            f"see CLAUDE.md (slopsmith#33)."
        )


def _install_requirements(plugin_dir: Path, plugin_id: str):
    """Install plugin requirements.txt to a persistent location."""
    req_file = plugin_dir / "requirements.txt"
    if not req_file.exists():
        return True

    _PIP_TARGET.mkdir(parents=True, exist_ok=True)
    pip_target = str(_PIP_TARGET)

    # Add to sys.path if not already there
    if pip_target not in sys.path:
        sys.path.insert(0, pip_target)

    # Check if already installed (marker file)
    marker = _PIP_TARGET / f".installed_{plugin_id}"
    req_hash = str(hash(req_file.read_text()))
    if marker.exists() and marker.read_text().strip() == req_hash:
        return True  # Already installed, same requirements

    print(f"[Plugin] Installing requirements for '{plugin_id}' (this can take a while for large deps)...")
    try:
        result = subprocess.run(
            [sys.executable, "-m", "pip", "install",
             "--target", pip_target,
             "--quiet",
             "-r", str(req_file)],
            capture_output=True, text=True, timeout=1800,
        )
        if result.returncode == 0:
            marker.write_text(req_hash)
            print(f"[Plugin] Requirements installed for '{plugin_id}'")
            return True
        else:
            err_lower = result.stderr.lower() if result.stderr else ""
            if "read-only" in err_lower or "permission denied" in err_lower:
                print(f"[Plugin] Optional dependencies not installed for '{plugin_id}' — functionality may be limited. Install dependencies manually or configure an external service if available.")
            else:
                print(f"[Plugin] Failed to install requirements for '{plugin_id}': {result.stderr[:300]}")
            return False
    except Exception as e:
        err_lower = str(e).lower()
        if "read-only" in err_lower or "permission denied" in err_lower:
            print(f"[Plugin] Optional dependencies not installed for '{plugin_id}' — functionality may be limited. Install dependencies manually or configure an external service if available.")
        else:
            print(f"[Plugin] Error installing requirements for '{plugin_id}': {e}")
        return False


def load_plugins(app: FastAPI, context: dict):
    """Discover and load all plugins from built-in and user directories."""

    # Collect plugin directories — user plugins first so they override built-in
    plugin_dirs = []
    user_plugins_dir = os.environ.get("SLOPSMITH_PLUGINS_DIR")
    if user_plugins_dir:
        user_path = Path(user_plugins_dir)
        if user_path.is_dir() and user_path != PLUGINS_DIR:
            plugin_dirs.append(user_path)
    if PLUGINS_DIR.is_dir():
        plugin_dirs.append(PLUGINS_DIR)

    if not plugin_dirs:
        return

    # Add persistent pip target to sys.path
    pip_target = str(_PIP_TARGET)
    if _PIP_TARGET.exists() and pip_target not in sys.path:
        sys.path.insert(0, pip_target)

    loaded_ids = set()
    # Two-pass discovery so we can warn about cross-plugin module-name
    # collisions BEFORE any plugin's setup runs (slopsmith#33). The
    # first pass collects (plugin_id, plugin_dir, manifest) tuples in
    # load order; the second pass actually executes each plugin's
    # setup with a per-plugin context.
    plugin_load_specs = []
    for plugins_base_dir in plugin_dirs:
        for plugin_dir in sorted(plugins_base_dir.iterdir()):
            if not plugin_dir.is_dir():
                continue
            manifest_path = plugin_dir / "plugin.json"
            if not manifest_path.exists():
                continue
            try:
                manifest = json.loads(manifest_path.read_text())
            except Exception as e:
                print(f"[Plugin] Failed to read {manifest_path}: {e}")
                continue
            plugin_id = manifest.get("id")
            if not plugin_id:
                continue
            # Validate type explicitly. A malformed manifest with a
            # non-string id (number, list, ...) would otherwise crash
            # later when `.replace()` runs in
            # `_safe_plugin_id_for_module_name`. Spotted by Copilot
            # review on PR #105 round 3.
            if not isinstance(plugin_id, str):
                print(
                    f"[Plugin] Skipping {manifest_path}: 'id' must be a string, "
                    f"got {type(plugin_id).__name__} ({plugin_id!r})"
                )
                continue
            if plugin_id in loaded_ids:
                print(f"[Plugin] Skipping duplicate '{plugin_id}' from {plugins_base_dir}")
                continue
            loaded_ids.add(plugin_id)
            plugin_load_specs.append((plugin_id, plugin_dir, manifest))

    # Warn before loading so authors see the message even if a colliding
    # plugin's setup itself blows up later in the loop.
    _warn_on_module_collisions(
        [(plugin_id, plugin_dir) for plugin_id, plugin_dir, _ in plugin_load_specs]
    )

    for plugin_id, plugin_dir, manifest in plugin_load_specs:
        # Install plugin requirements if present
        _install_requirements(plugin_dir, plugin_id)

        # Add plugin directory to sys.path so the plugin's bare
        # `import sibling` keeps working during the slopsmith#33
        # transition. New plugins should prefer
        # `context['load_sibling']('sibling')` instead — see
        # CLAUDE.md / Plugin System / Backend routes.
        plugin_dir_str = str(plugin_dir)
        if plugin_dir_str not in sys.path:
            sys.path.insert(0, plugin_dir_str)

        # Build a per-plugin context: dict-copy the shared mapping
        # so plugin A re-binding `ctx['x']` doesn't leak into plugin
        # B's view, then add a `load_sibling` closure scoped to THIS
        # plugin's id + dir. (Note: the COPY is shallow — values
        # stored in context are still the same objects across
        # plugins, so e.g. `ctx['meta_db']` mutations are still
        # observable everywhere by design.) The helper namespaces
        # sibling modules as `plugin_<id>.<name>` (with plugin_id
        # bijectively encoded by _safe_plugin_id_for_module_name:
        # `_` -> `_5f_`, `.` -> `_2e_`) so two plugins shipping the
        # same filename get distinct cached modules. See
        # slopsmith#33.
        plugin_context = dict(context)
        plugin_context["load_sibling"] = (
            lambda name, _pid=plugin_id, _pdir=plugin_dir:
                _load_plugin_sibling(_pid, _pdir, name)
        )

        # Load routes using importlib to avoid module name collisions
        routes_file = manifest.get("routes")
        if routes_file:
            try:
                # Escape `.` in plugin_id the same way load_sibling
                # does. Without it, a plugin id like
                # `com.example.foo` would land at
                # `plugin_com.example.foo_routes` — which Python
                # parses as a dotted module path, sets
                # `__package__` to `plugin_com.example`, and breaks
                # any relative imports inside routes.py. Spotted by
                # Copilot review on PR #105 round 2.
                module_name = f"plugin_{_safe_plugin_id_for_module_name(plugin_id)}_routes"
                spec = importlib.util.spec_from_file_location(
                    module_name, str(plugin_dir / routes_file))
                routes_module = importlib.util.module_from_spec(spec)
                sys.modules[module_name] = routes_module
                spec.loader.exec_module(routes_module)
                if hasattr(routes_module, "setup"):
                    routes_module.setup(app, plugin_context)
                    print(f"[Plugin] Loaded routes for '{plugin_id}'")
            except Exception as e:
                print(f"[Plugin] Failed to load routes for '{plugin_id}': {e}")
                import traceback
                traceback.print_exc()

        LOADED_PLUGINS.append({
            "id": plugin_id,
            "name": manifest.get("name", plugin_id),
            "nav": manifest.get("nav"),
            # `type` is an optional manifest hint for the frontend —
            # e.g. "visualization" lets the highway viz picker know
            # this plugin offers a renderer. Absent → no declared
            # role; plugin is still loaded and scripts run, it just
            # doesn't show up in role-specific UIs. See slopsmith#36.
            "type": manifest.get("type"),
            "has_screen": bool(manifest.get("screen")),
            "has_script": bool(manifest.get("script")),
            "has_settings": bool(manifest.get("settings")),
            "_dir": plugin_dir,
            "_manifest": manifest,
        })
        print(f"[Plugin] Registered '{plugin_id}' ({manifest.get('name', '')})")


def _check_plugin_update(plugin_dir: Path) -> dict | None:
    """Check if a plugin's git repo has updates available."""
    git_dir = plugin_dir / ".git"
    if not git_dir.exists():
        return None
    try:
        # Fetch latest from remote (quick, refs only)
        subprocess.run(
            ["git", "fetch", "--quiet"],
            cwd=str(plugin_dir), capture_output=True, timeout=15,
        )
        # Compare local HEAD with remote tracking branch
        result = subprocess.run(
            ["git", "rev-list", "HEAD..@{u}", "--count"],
            cwd=str(plugin_dir), capture_output=True, text=True, timeout=10,
        )
        if result.returncode != 0:
            return None
        behind = int(result.stdout.strip())
        # Get current and remote commit hashes
        local = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=str(plugin_dir), capture_output=True, text=True, timeout=5,
        ).stdout.strip()
        remote = subprocess.run(
            ["git", "rev-parse", "--short", "@{u}"],
            cwd=str(plugin_dir), capture_output=True, text=True, timeout=5,
        ).stdout.strip()
        return {"behind": behind, "local": local, "remote": remote}
    except Exception:
        return None


def register_plugin_api(app: FastAPI):
    """Register the plugin discovery API endpoints."""

    @app.get("/api/plugins")
    def list_plugins():
        return [
            {
                "id": p["id"],
                "name": p["name"],
                "nav": p["nav"],
                # type is None for plugins without the manifest hint —
                # frontend filters like "give me all type=visualization"
                # work via identity comparison; absent is treated as
                # "no declared role".
                "type": p.get("type"),
                "has_screen": p["has_screen"],
                "has_script": p["has_script"],
                "has_settings": p["has_settings"],
            }
            for p in LOADED_PLUGINS
        ]

    @app.get("/api/plugins/updates")
    def check_updates():
        """Check all plugins for available git updates."""
        updates = {}
        for p in LOADED_PLUGINS:
            info = _check_plugin_update(p["_dir"])
            if info and info["behind"] > 0:
                updates[p["id"]] = {
                    "name": p["name"],
                    "behind": info["behind"],
                    "local": info["local"],
                    "remote": info["remote"],
                }
        return {"updates": updates}

    @app.post("/api/plugins/{plugin_id}/update")
    def update_plugin(plugin_id: str):
        """Pull latest changes for a plugin. Stashes local edits first."""
        for p in LOADED_PLUGINS:
            if p["id"] == plugin_id:
                git_dir = p["_dir"] / ".git"
                if not git_dir.exists():
                    return {"error": "Not a git repository"}
                cwd = str(p["_dir"])
                try:
                    # Stash any local modifications so pull doesn't fail
                    subprocess.run(
                        ["git", "stash", "--quiet"],
                        cwd=cwd, capture_output=True, timeout=10,
                    )
                    result = subprocess.run(
                        ["git", "pull", "--ff-only"],
                        cwd=cwd, capture_output=True, text=True, timeout=30,
                    )
                    if result.returncode != 0:
                        # Restore stash on failure
                        subprocess.run(
                            ["git", "stash", "pop", "--quiet"],
                            cwd=cwd, capture_output=True, timeout=10,
                        )
                        return {"error": result.stderr[:500]}
                    return {"ok": True, "message": result.stdout.strip()}
                except Exception as e:
                    return {"error": str(e)}
        return {"error": "Plugin not found"}

    @app.get("/api/plugins/{plugin_id}/screen.html")
    def plugin_screen_html(plugin_id: str):
        for p in LOADED_PLUGINS:
            if p["id"] == plugin_id:
                screen_file = p["_dir"] / p["_manifest"].get("screen", "screen.html")
                if screen_file.exists():
                    return HTMLResponse(screen_file.read_text(encoding="utf-8"))
        return HTMLResponse("", status_code=404)

    @app.get("/api/plugins/{plugin_id}/screen.js")
    def plugin_screen_js(plugin_id: str):
        for p in LOADED_PLUGINS:
            if p["id"] == plugin_id:
                script_file = p["_dir"] / p["_manifest"].get("script", "screen.js")
                if script_file.exists():
                    return Response(script_file.read_text(encoding="utf-8"), media_type="application/javascript")
        return Response("", status_code=404)

    @app.get("/api/plugins/{plugin_id}/settings.html")
    def plugin_settings_html(plugin_id: str):
        for p in LOADED_PLUGINS:
            if p["id"] == plugin_id:
                settings = p["_manifest"].get("settings", {})
                settings_file = p["_dir"] / (settings.get("html", "settings.html") if isinstance(settings, dict) else "settings.html")
                if settings_file.exists():
                    return HTMLResponse(settings_file.read_text())
        return HTMLResponse("", status_code=404)
