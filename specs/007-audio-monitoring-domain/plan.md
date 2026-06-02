# Implementation Plan: Audio Monitoring Control Plane

**Branch**: `007-audio-monitoring-domain` | **Date**: 2026-05-30 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/007-audio-monitoring-domain/spec.md`

## Summary

Make `audio-monitoring` the authoritative, redaction-safe control plane for live monitoring provider selection, start/stop/status lifecycle, shared requester coordination, direct-monitor state, and compatibility diagnostics. The implementation extends the existing `core.audio.session` host beyond ad hoc monitoring session records by adding monitoring provider registration, selected/default provider policy, explicit user-action authorization for fresh starts, audio-input readiness integration, provider-owned `monitoring.start`/`monitoring.stop`/`monitoring.status` operations, shared monitoring sessions with requester references, direct-monitor conflict handling, native-over-compatibility duplicate suppression, and bounded diagnostics that never expose live audio handles or raw device identity.

## Technical Context

**Language/Version**: Vanilla JavaScript in the source-served browser frontend; Python 3.12/FastAPI only for unchanged diagnostics/export or plugin metadata test surfaces
**Primary Dependencies**: Existing `window.slopsmith` event bus, `static/capabilities.js` (`capability-pipelines.v1`), `static/capabilities/audio-session.js`, `static/diagnostics.js`, `localStorage`, existing audio-input runtime, browser Web Audio/MediaDevices permission semantics, optional `window.slopsmithDesktop.audio` and plugin/native monitoring bridges
**Storage**: In-memory monitoring provider/session state for the active audio session; `localStorage` for selected redaction-safe monitoring provider preference when available; selected source preference remains owned by audio-input; diagnostics contributions in memory/export bundle; no new database/schema
**Testing**: `node --check`; Node JS tests under `tests/js/` focused on `audio_session_monitoring`, `audio_session_input`, `audio_session_compat`, `audio_session_host`, and `capability_inspector_render`; existing pytest diagnostics/plugin tests only if diagnostics export/import or plugin loading changes; focused browser/manual smoke for Capability Inspector/player-visible monitoring UI changes
**Target Platform**: Self-hosted single-user Slopsmith browser app served by Docker or local dev server, with optional desktop/native audio monitoring bridge
**Project Type**: Vanilla web app with FastAPI backend and plugin runtime
**Performance Goals**: Prompt-free `inspect`/status paths settle within the normal capability dispatch budget; provider `monitoring.start`/`monitoring.stop`/`monitoring.status` operations fail with explicit outcomes instead of hanging; direct-monitor status updates appear within 1 second for supporting providers; final-requester stop reaches stopped state within 1 second in focused validation; diagnostics stay bounded — recent outcomes and per-snapshot size are capped so the audio-session contribution stays well within the client diagnostics buffer (~256 KB hard cap in `static/diagnostics.js`)
**Constraints**: No frontend framework/build step; no new mandatory env vars or host paths; no auth/multi-user model; no raw device labels, stable hardware identifiers, local paths, secrets, raw audio buffers, sample data, waveform data, recordings, MediaStream handles, AudioNode handles, native handles, or provider-private live objects in monitoring state, diagnostics, or capability payloads; permission prompts only on explicit user-authorized live input flows; active monitoring survives song switches/playback stops but never auto-resumes after app reload
**Scale/Scope**: Single local user, one user-visible selected/default monitoring provider, multiple monitoring providers during migration, native and compatibility-backed representations of the same logical monitoring path, multiple simultaneous requesters sharing compatible monitoring sessions

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Result | Notes |
|-----------|--------|-------|
| I. Self-Hosted, Single-User, Docker-First | PASS | No auth, tenant model, mandatory env var, backend service, or host path is introduced. Optional desktop/native monitoring remains optional. |
| II. Vanilla Frontend - No Frameworks | PASS | Plan uses source-served vanilla JS, existing globals, and browser/native bridge APIs only. |
| III. Plugins Are the Extension Point | PASS | Plugins/providers keep actual monitoring implementation, effect chains, streams, native handles, and platform details; core coordinates only shared monitoring control-plane state and diagnostics. |
| IV. Backwards-Compatible CDLC Library | PASS | No DLC file mutation, song format change, or highway WebSocket contract change is required. Monitoring remains independent of song playback transport while the app is running. |
| V. Pure-Function Core Libraries, Tested | PASS | No new Python library architecture or import-time side effects are planned; validation is JS-focused with diagnostics coverage as needed. |
| VI. Observability Over Chattiness | PASS | Diagnostics distinguish provider/source/direct-monitor/requester/outcome state without raw input data, device labels, paths, handles, or secrets. |
| VII. Versioned, Migration-Aware Settings | PASS | Provider preference persistence uses existing client preference storage and degrades safely; no settings import/export schema change is required. |

## Project Structure

### Documentation (this feature)

```text
specs/007-audio-monitoring-domain/
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- checklists/
|   `-- requirements.md
|-- contracts/
|   |-- audio-monitoring-control-plane.md
|   |-- diagnostics-schema.md
|   |-- manifest-examples.md
|   |-- migration-notes.md
|   `-- testing-contract.md
`-- tasks.md              # Created later by /speckit-tasks
```

### Source Code (repository root)

```text
static/
|-- capabilities.js                  # Existing dispatch/outcome/diagnostics primitives
|-- capabilities/
|   `-- audio-session.js              # Extend audio-monitoring provider/session state, start/stop/status, direct-monitor rules, redaction, bridges
|-- diagnostics.js                    # Existing browser diagnostics contribution namespace
`-- index.html                        # Existing script ordering; no framework/build changes

plugins/
`-- capability_inspector/screen.js    # Surface monitoring providers, selection, sessions, requesters, direct-monitor state, bridges, outcomes

docs/
|-- capability-domains.md             # Provider/requester lifecycle and user-action boundary guidance
|-- capability-recipes.md             # Manifest/runtime recipes for monitoring providers and requesters
|-- capability-roadmap.md             # 007 migration status and removal gates when implemented
`-- capability-safety-matrix.md       # Monitoring command/provider operation/outcome notes

tests/
|-- js/
|   |-- audio_session_monitoring.test.js
|   |-- audio_session_input.test.js
|   |-- audio_session_compat.test.js
|   |-- audio_session_host.test.js
|   `-- capability_inspector_render.test.js
`-- browser/
    `-- check-errors.spec.ts          # Focused smoke if visible monitoring/inspector UI changes
```

**Structure Decision**: Keep this migration in the existing vanilla frontend/runtime surface. `static/capabilities/audio-session.js` remains the `audio-monitoring` domain owner; providers keep platform/native/live audio handles; audio-input remains the selected-source/open-session owner; the inspector and docs become support/migration surfaces. No backend route, new service, frontend framework, or persistent schema is needed.

## Complexity Tracking

No constitutional violations are introduced. No complexity exceptions are required.

## Phase 0: Research Summary

See [research.md](research.md). Key decisions:

- Extend the existing audio-session host instead of creating a parallel monitoring runtime.
- Model monitoring providers separately from monitoring sessions so prompt-free inspection and provider selection work before start.
- Use selected/default provider policy and return `provider-selection-required` when multiple compatible providers exist with no choice.
- Require explicit user action for every fresh monitoring start; background requesters may only inspect or attach to active compatible sessions.
- Treat audio-input open-session readiness as the input boundary for monitoring start.
- Normalize provider operations and outcomes across `monitoring.start`, `monitoring.stop`, and `monitoring.status`.
- Share compatible monitoring sessions by provider/source/requester references and stop only after the final requester releases.
- Treat user/default direct-monitor state as authoritative; requester requirements produce degraded/unsupported status without changing it.
- Keep diagnostics bounded and redaction-safe, including provider summaries, selected provider, sessions, requesters, direct-monitor state, bridge hits, and recent outcomes.
- Keep compatibility bridges visible until migration removal gates pass.

## Phase 1: Design Summary

Design artifacts created:

- [data-model.md](data-model.md) defines monitoring providers, selected provider, requesters, start authorization, sessions, selected source references, direct-monitor state/requirements, outcomes, bridge hits, blocking failures, and non-blocking degradations.
- [contracts/audio-monitoring-control-plane.md](contracts/audio-monitoring-control-plane.md) defines domain commands, provider operations, events, normalized outcomes, compatibility rules, start authorization, sharing, and stop semantics.
- [contracts/diagnostics-schema.md](contracts/diagnostics-schema.md), [contracts/manifest-examples.md](contracts/manifest-examples.md), [contracts/migration-notes.md](contracts/migration-notes.md), and [contracts/testing-contract.md](contracts/testing-contract.md) capture supporting diagnostics, declaration, migration, and validation contracts.
- [quickstart.md](quickstart.md) defines validation order and representative audio-monitoring scenarios.

## Post-Design Constitution Check

| Principle | Result | Notes |
|-----------|--------|-------|
| I. Self-Hosted, Single-User, Docker-First | PASS | Design remains local and single-user with no deployment inputs. |
| II. Vanilla Frontend - No Frameworks | PASS | UI/runtime changes stay in source-served JS and existing DOM/CSS. |
| III. Plugins Are the Extension Point | PASS | Plugins/providers retain actual monitoring implementation and live handles; core coordinates shared state, lifecycle policy, and diagnostics. |
| IV. Backwards-Compatible CDLC Library | PASS | Playback/source formats, DLC files, and highway data remain unchanged. |
| V. Pure-Function Core Libraries, Tested | PASS | Planned coverage is focused on JS runtime and diagnostics; no Python library architecture change. |
| VI. Observability Over Chattiness | PASS | Monitoring provider/source/requester/direct-monitor/bridge outcomes are diagnosable without raw device or audio data. |
| VII. Versioned, Migration-Aware Settings | PASS | Provider preference persistence uses existing client preference storage and degrades safely when unavailable. |
