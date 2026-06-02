# Contract: Playback Testing

## Syntax Checks

Run after implementation changes:

```bash
node --check static/capabilities.js
node --check static/capabilities/playback.js
node --check static/app.js
node --check plugins/capability_inspector/screen.js
```

## Focused Node Tests

Required focused suites for this slice:

```bash
node --test tests/js/playback_domain.test.js \
  tests/js/playback_compat.test.js \
  tests/js/playback_diagnostics.test.js \
  tests/js/song_seek.test.js \
  tests/js/loop_api.test.js \
  tests/js/loop_restart.test.js \
  tests/js/capability_inspector_render.test.js
```

Expected coverage:
- `playback.inspect` returns idle/no-session safely before first song.
- User-authorized start records target/session/readiness and lifecycle events.
- Plugin/background fresh start returns `user-action-required`.
- Plugins can inspect/observe and request permitted active-session controls.
- Pause/resume/stop distinguish active, inactive, ended, and stopped states.
- Seek reports requested/from/landed time and `completed`, `clamped`, `cancelled`, `rolled-back`, `stale`, and `failed` statuses.
- Stale song-switch completions do not overwrite current session state.
- User-priority conflicts beat plugin/automation requests.
- Same-priority conflicts use latest non-stale request wins.
- Loop set validates boundaries, commits only after successful landed seek, and clears/restarts/stales predictably.
- Route changes preserve session/time when safe and pause degraded when not safe.
- Compatibility bridge hits are recorded for legacy wrapper/event/helper paths without duplicate user-visible transport actions.
- Rehydrating the same requester/observer five times creates one participant record.
- Exported diagnostics use pseudonymous target ids only and trim bounded history.
- Local inspector rendering can show local display metadata while exported diagnostics cannot.

## Full JS Regression

```bash
npm run test:js
```

## Backend/Diagnostics Regression

Run Python tests if implementation touches diagnostics export/import, plugin manifest loading, or backend route behavior:

```bash
pytest tests/test_diagnostics_bundle.py tests/test_diagnostics_redact.py tests/test_plugins.py tests/test_plugin_runtime_idempotence.py -q
```

## Browser Smoke

If player wiring, script ordering, or inspector rendering changes, run:

```bash
PYTHONPATH=lib:. uv run uvicorn server:app --host 127.0.0.1 --port 8000
npm test -- tests/browser/check-errors.spec.ts
```

When Docker is unavailable, start the server directly as above and let Playwright reuse port 8000.

## Manual Representative Scenarios

1. Open the app, inspect playback before any song; expect idle/no-session.
2. Start a playable song through the normal UI; expect user-authorized start and `playing` state.
3. Pause, resume, seek, stop; inspect after each action.
4. Try plugin/background fresh start in a harness; expect `user-action-required`.
5. Trigger plugin seek while playback is active; expect requester attribution.
6. Set and clear a loop; verify loop events and diagnostics.
7. Switch browser/native playback route while active; verify preserved session/time or paused degraded.
8. Export diagnostics; verify no song metadata, paths, handles, secret URLs, or raw audio data.
9. Open Capability Inspector; verify playback owner, participants, route, loop, bridge hits, outcomes, and bounded history render without errors.
