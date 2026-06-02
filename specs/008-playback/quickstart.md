# Quickstart: Playback Control Plane

## Scope

This quickstart validates the playback planning slice after implementation. It assumes the feature adds a `playback` capability owner while keeping existing player transport behavior in `static/app.js`.

## Implementation Notes

- The active host lives in `static/capabilities/playback.js` and registers the core `playback` owner.
- `static/app.js` keeps raw transport handles private and registers a redaction-safe adapter with `window.slopsmith.playback.registerTransportAdapter(...)`.
- `static/index.html` loads playback after the capability runtime, library, and audio-session hosts.
- Exported diagnostics use `slopsmith.playback.diagnostics.v1` with pseudonymous target ids; local inspector mode may show already-visible title/artist/arrangement labels.
- Compatibility bridges currently account for `window.playSong`, legacy `song:*` events, `window.slopsmith` seek/loop helpers, loop API usage, and HTML5/JUCE route handoff.

## 1. Syntax

```bash
node --check static/capabilities.js
node --check static/capabilities/playback.js
node --check static/app.js
node --check plugins/capability_inspector/screen.js
```

## 2. Focused JS Tests

```bash
node --test tests/js/playback_domain.test.js \
  tests/js/playback_compat.test.js \
  tests/js/playback_diagnostics.test.js \
  tests/js/song_seek.test.js \
  tests/js/loop_api.test.js \
  tests/js/loop_restart.test.js \
  tests/js/capability_inspector_render.test.js
```

## 3. Full JS Regression

```bash
npm run test:js
```

## 4. Python Regression If Backend/Diagnostics Changed

```bash
pytest tests/test_diagnostics_bundle.py tests/test_diagnostics_redact.py tests/test_plugins.py tests/test_plugin_runtime_idempotence.py -q
```

## 5. Browser Smoke

When Docker is unavailable, run the app server directly:

```bash
PYTHONPATH=lib:. uv run uvicorn server:app --host 127.0.0.1 --port 8000
npm test -- tests/browser/check-errors.spec.ts
```

## Representative Validation Scenarios

### Idle Inspection

1. Load the app without starting a song.
2. Dispatch `playback.inspect`.
3. Expect `idle` or `no-session`, no thrown error, and no raw media handles.

### User-Authorized Start

1. Start a playable song from the library UI.
2. Inspect playback.
3. Expect a safe session id, pseudonymous target id, loading/ready/playing lifecycle events, media readiness, and requester attribution for the user/core control.

### Plugin Fresh Start Boundary

1. Dispatch `playback.start` from a plugin/background requester while idle without `authorization: user-action`.
2. Expect `user-action-required` and no audible playback.

### Active Session Controls

1. Start playback through the UI.
2. Dispatch plugin/requester `pause`, `resume`, `seek`, `set-loop`, and `clear-loop` commands against the active session.
3. Expect explicit outcomes, requester attribution, and no duplicate song starts.

### Conflict Resolution

1. While a plugin/automation resume or seek is pending, issue a user pause/stop/seek.
2. Expect the user action to decide final transport state.
3. For same-priority commands, expect latest non-stale request to win.

### Seek And Stale Handling

1. Run concurrent seeks and a song switch.
2. Expect old-session seek completions to report `stale` or `cancelled` and not mutate the current session.
3. Expect completed seeks to include requested, from, and landed times.

### Loop Lifecycle

1. Set a valid loop and verify the loop is committed only after seek-to-start lands.
2. Set invalid boundaries and verify current loop state is unchanged.
3. Let playback reach the loop end and verify one loop restart event.
4. Clear the loop and inspect inactive state.

### Route Change

1. Start playback on the browser route.
2. Trigger browser/native route reevaluation where supported.
3. Expect session identity and current time to be preserved when safe.
4. Force an unsafe handoff in a harness and expect paused/degraded state with a bounded safe reason.

### Diagnostics

1. Export diagnostics after normal playback, failed start, stale seek, route degradation, and loop activity.
2. Verify exported snapshots include stable pseudonymous playback target ids, route status, lifecycle phase, loop state, bridge hits, and bounded history.
3. Verify exported snapshots exclude titles, artists, arrangement display text, raw filenames, paths, secret URLs, handles, route-private objects, buffers, samples, waveforms, and recordings.

### Capability Inspector

1. Open the Capability Inspector.
2. Verify the playback domain shows owner, requesters/observers, current session, route summary, loop state, bridge hits, recent outcomes, and lifecycle summaries.
3. Verify local inspector may show user-visible song metadata already visible in the app, while exported diagnostics remain pseudonymous.
