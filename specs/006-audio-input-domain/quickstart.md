# Quickstart: Audio Input Control Plane

Use this after implementation tasks are complete to validate the audio-input migration.

## 1. Syntax Check

```bash
node --check static/capabilities.js
node --check static/capabilities/audio-session.js
node --check plugins/capability_inspector/screen.js
```

## 2. Focused JS Tests

```bash
node --test tests/js/audio_session_input.test.js tests/js/audio_session_compat.test.js tests/js/audio_session_host.test.js tests/js/audio_session_routes.test.js tests/js/capability_inspector_render.test.js
```

Run broader audio-session coverage when shared host behavior changes:

```bash
node --test tests/js/audio_session_*.test.js
```

## 3. Diagnostics/Inspector Checks

If diagnostics shape or inspector rendering changes:

```bash
node --test tests/js/capability_inspector_render.test.js
pytest tests/test_diagnostics_bundle.py -q
npx playwright test tests/browser/check-errors.spec.ts
```

## 4. Representative Scenarios

Validate these scenarios with focused tests and, where browser permission behavior matters, a manual/browser smoke:

1. Register one native source with a safe logical source key.
2. Register the same source repeatedly and confirm one visible record with updated `lastSeenAt`/availability.
3. Register a compatibility-backed source with the same logical source key and confirm the native source owns visible state while the bridge is diagnostic-only.
4. Select a source and verify `inspect` returns selected state without prompting for permission.
5. Reload or rehydrate providers and verify the same logical source is restored or reported unavailable within 1 second after registration.
6. Open the selected source for one requester and verify an open session is recorded without stream/node/native handles.
7. Open the same source for a second compatible requester and verify the same open session is shared.
8. Release one requester and confirm the provider session remains open.
9. Release the final requester and confirm provider close runs and the session closes.
10. Open with an incompatible channel shape and confirm an incompatible outcome without changing selected source.
11. Force denied, unavailable, failed, no-owner, no-handler, and incompatible-version outcomes and confirm diagnostics distinguish them.
12. Export or snapshot diagnostics and confirm raw device labels, hardware ids, paths, secrets, handles, buffers, samples, and waveform data are absent.

## 5. Local Browser Launch

When Docker is unavailable during development, launch directly:

```bash
PYTHONPATH=lib:. uv run uvicorn server:app --host 127.0.0.1 --port 8000
```

Then inspect the Capability Inspector and any visible input controls that tasks add.

## 6. Documentation Review

Confirm implementation tasks update:

- [docs/capability-domains.md](../../docs/capability-domains.md)
- [docs/capability-recipes.md](../../docs/capability-recipes.md)
- [docs/capability-roadmap.md](../../docs/capability-roadmap.md)
- [docs/capability-safety-matrix.md](../../docs/capability-safety-matrix.md)
- [CHANGELOG.md](../../CHANGELOG.md)