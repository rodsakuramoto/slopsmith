# Contract: Audio Input Validation

## Focused Node Tests

Add or extend tests under `tests/js/`.

Required scenarios:

- `register-source` requires `sourceId`, `providerId`, and `logicalSourceKey`.
- Re-registering the same logical source updates one record and does not duplicate user-visible sources.
- Native source wins over compatibility-backed source with the same logical source key.
- `inspect`, `list-sources`, and `select-source` do not call provider open/enumeration code that could prompt for permission.
- Selected source restore uses the same logical source key and does not silently select a different source.
- Permission denied, unavailable, failed, incompatible, no-owner, and no-handler produce distinct outcomes/statuses.
- `open-source` records requester attribution and returns no live handles.
- Compatible requesters share one open session; provider close runs only after the last requester releases.
- Incompatible channel shape returns an incompatible outcome and leaves selection unchanged.
- Diagnostics snapshots contain no raw source ids, raw labels, stable hardware ids, paths, secrets, live handles, buffers, samples, or waveform data.
- Legacy bridge hits are recorded for compatibility-backed source paths.

Suggested files:

- `tests/js/audio_session_input.test.js`
- `tests/js/audio_session_compat.test.js`
- `tests/js/audio_session_host.test.js`
- `tests/js/capability_inspector_render.test.js`

## Syntax And Runtime Checks

Run after implementation:

```bash
node --check static/capabilities/audio-session.js
node --test tests/js/audio_session_input.test.js tests/js/audio_session_compat.test.js tests/js/audio_session_host.test.js
```

If inspector rendering changes:

```bash
node --test tests/js/capability_inspector_render.test.js
```

If diagnostics export shape changes:

```bash
pytest tests/test_diagnostics_bundle.py -q
```

## Browser/Manual Permission Checks

Because actual browser permission prompts depend on host/browser state, validate representative behavior manually or with a focused browser smoke where possible:

- Opening the app and inspecting capability diagnostics does not request microphone/input permission.
- Selecting a source does not request microphone/input permission.
- Explicitly starting monitoring or another live-input consumer is the first action that may prompt.
- Denying permission yields a denied outcome and redaction-safe diagnostics.
- Reload after selecting a source restores the same logical source or reports it unavailable within the target window.

For local browser validation without Docker, use the known direct server launch pattern:

```bash
PYTHONPATH=lib:. uv run uvicorn server:app --host 127.0.0.1 --port 8000
```

## Review Checks

- No new frontend framework, build step, mandatory env var, or database schema.
- No new legacy-only bundled input consumers.
- Docs and safety matrix list the final command/event/provider operation names.
- Capability Inspector can summarize source status, selected source, open sessions, bridge hits, and recent outcomes without raw device/audio data.