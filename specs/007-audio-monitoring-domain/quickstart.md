# Quickstart: Audio Monitoring Control Plane

This quickstart describes the validation path for the `audio-monitoring` planning slice. It assumes the audio graph/session host and audio-input domain are already present.

## 1. Review the Design Boundary

Read these artifacts in order:

1. [spec.md](spec.md)
2. [research.md](research.md)
3. [data-model.md](data-model.md)
4. [contracts/audio-monitoring-control-plane.md](contracts/audio-monitoring-control-plane.md)
5. [contracts/diagnostics-schema.md](contracts/diagnostics-schema.md)
6. [contracts/testing-contract.md](contracts/testing-contract.md)

Confirm the implementation keeps these ownership lines:

- `audio-input` owns source identity, source selection, and input open/close readiness.
- `audio-monitoring` owns monitoring provider selection, start/stop/status lifecycle, requester references, direct-monitor state, and monitoring diagnostics.
- Providers own live audio handles, streams, nodes, native handles, effect chains, and platform APIs.
- `audio-mix` owns faders, route summaries, and analyser summaries.
- Future `audio-effects` work owns chain editing, plugin loading, NAM/IR/model state, presets, bypass, and plugin editor windows.

## 2. Inspect Current Runtime

Confirm the monitoring surface is available and syntactically valid:

```bash
node --check static/capabilities/audio-session.js
node --test tests/js/audio_session_monitoring.test.js
```

Expected baseline behavior:

- `audio-monitoring` is registered as a sensitive provider-coordinator domain.
- Runtime diagnostics include providers, selected provider, active/stopped sessions, direct-monitor state, bridge hits, and recent outcomes.
- Provider registration, selected provider, shared sessions, direct-monitor conflict rules, and user-action authorization are covered by focused tests.

## 3. Implement Runtime Changes

Work in `static/capabilities/audio-session.js` first.

Recommended order:

1. Add monitoring constants, normalizers, outcome helpers, and safe summary redaction.
2. Add provider registry state and APIs such as `registerMonitoringProvider`, `unregisterMonitoringProvider`, `listMonitoringProviders`, `inspectMonitoring`, and `selectMonitoringProvider`.
3. Replace ad hoc `startMonitoring` with provider selection, input readiness, start authorization, provider operation dispatch, shared-session creation, and degraded/failure normalization.
4. Replace ad hoc `stopMonitoring` with requester release tracking and final-provider-stop semantics.
5. Add direct-monitor preference/status helpers and conflict evaluation.
6. Extend diagnostics snapshot with providers, selected provider, sessions, direct-monitor state, and bridge hits.
7. Update capability owner metadata commands/events/operations.

## 4. Update Support UI and Docs

Update support surfaces after runtime state is available:

- [plugins/capability_inspector/screen.js](../../plugins/capability_inspector/screen.js): show monitoring providers, selected provider, sessions, requesters, direct-monitor state, bridge hits, and recent outcomes.
- [docs/capability-roadmap.md](../../docs/capability-roadmap.md): mark monitoring slice migration status and removal gates.
- [docs/capability-domains.md](../../docs/capability-domains.md): document provider/requester lifecycle and user-action boundary.
- [docs/capability-recipes.md](../../docs/capability-recipes.md): add runtime examples for monitoring providers and requesters.
- [docs/capability-safety-matrix.md](../../docs/capability-safety-matrix.md): update command/outcome notes.

## 5. Validate Focused Runtime Scenarios

Run focused JS tests while developing:

```bash
node --test tests/js/audio_session_monitoring.test.js
node --test tests/js/audio_session_input.test.js
node --test tests/js/audio_session_compat.test.js
node --test tests/js/audio_session_host.test.js
node --test tests/js/capability_inspector_render.test.js
```

Then run all JS tests:

```bash
npm run test:js
```

Scenario checklist:

- One provider registers and appears in diagnostics.
- Re-registering the provider updates one record instead of creating duplicates.
- Native provider suppresses compatibility-backed duplicate provider.
- Inspect/status are prompt-free and do not call provider start handlers or audio-input open handlers.
- User-authorized start creates active session.
- Multiple providers without selected/default provider return `provider-selection-required`.
- Background fresh start returns `user-action-required`.
- Background requester attaches to an already active compatible session.
- Two requesters share one active provider session.
- Provider stop occurs only after final requester release.
- Missing input/output and incompatible channel/source requirements are blocking, not active degraded.
- High latency or unsupported direct-monitor control can be active degraded.
- Direct-monitor requester conflict returns degraded/unsupported without mutating user/default preference.
- Diagnostics redact sensitive labels, handles, paths, and raw audio data.

## 6. Run Syntax and Browser Checks

Always run syntax checks after runtime/UI edits:

```bash
node --check static/capabilities.js
node --check static/capabilities/audio-session.js
node --check plugins/capability_inspector/screen.js
```

Run browser smoke if the inspector or visible player controls change:

```bash
npm test -- tests/browser/check-errors.spec.ts
```

If a local server is needed for browser validation, use the existing Slopsmith dev path and avoid adding a new frontend build step.

## 7. Optional Backend Validation

Backend changes are not expected. If implementation touches diagnostics export/import or plugin metadata loading, run:

```bash
uv run pytest tests/test_diagnostics_bundle.py tests/test_plugins.py -v
```

Run the full backend suite before a broad PR if shared diagnostics/plugin loading changed:

```bash
uv run pytest
```

## 8. Manual Acceptance Smoke

With a monitoring provider such as Audio Engine/NAM available:

1. Open Capability Inspector.
2. Confirm Audio Monitoring shows the provider, selected/default state, and safe availability.
3. Start monitoring from a visible user action.
4. Confirm active session, requester attribution, selected source reference, and direct-monitor status.
5. Switch songs or stop playback and confirm monitoring remains active.
6. Reload the app and confirm provider/source preference is restored but monitoring is stopped.
7. Attempt a plugin/background start from stopped state and confirm `user-action-required`.
8. Start monitoring as user, then attach a compatible plugin requester and confirm no duplicate provider start.
9. Stop requesters in reverse order and confirm provider stop happens after the final release.
10. Export diagnostics and confirm no raw device labels, hardware identifiers, local paths, audio buffers, live handles, or recordings appear.
