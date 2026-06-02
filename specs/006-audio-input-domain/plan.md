# Implementation Plan: Audio Input Control Plane

**Branch**: `006-audio-input-domain` | **Date**: 2026-05-30 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/006-audio-input-domain/spec.md`

## Summary

Make `audio-input` the authoritative, redaction-safe control plane for input source identity, selection, availability, and open/close lifecycle coordination. The implementation extends the existing `core.audio.session` host beyond simple source registration/selection by adding provider-supplied logical source keys, native-over-legacy duplicate suppression, prompt-free inspect/list/select behavior, provider-owned open/close operations, shared open input sessions with requester references, channel-shape compatibility checks, stable selected-source restoration, compatibility bridge accounting, and bounded diagnostics that never expose live audio handles or raw sample data.

## Technical Context

**Language/Version**: Vanilla JavaScript in the source-served browser frontend; Python 3.12/FastAPI only for unchanged diagnostics/export test surfaces  
**Primary Dependencies**: Existing `window.slopsmith` event bus, `static/capabilities.js` (`capability-pipelines.v1`), `static/capabilities/audio-session.js`, `static/diagnostics.js`, `localStorage`, browser MediaDevices/Web Audio permission semantics, optional `window.slopsmithDesktop.audio` or plugin/native input bridges  
**Storage**: In-memory source/session state for the active audio session; `localStorage` for the selected redaction-safe logical source key when available; diagnostics contributions in memory/export bundle; no new database/schema  
**Testing**: `node --check`, Node JS tests under `tests/js/` focused on `audio_session_input`, compatibility, and inspector rendering; existing pytest diagnostics tests only if diagnostics bundle shape changes; focused browser/manual smoke for permission-prompt behavior when UI changes land  
**Target Platform**: Self-hosted single-user Slopsmith browser app served by Docker or local dev server, with optional desktop/native audio input bridge  
**Project Type**: Vanilla web app with FastAPI backend and plugin runtime  
**Performance Goals**: Prompt-free `inspect`, source listing, and `select-source` settle within the normal capability dispatch budget; provider `source.open`/`source.close` operations fail with explicit outcomes instead of hanging; selected-source restoration/reporting completes within 1 second after provider registration; diagnostics remain within the existing 64 KB capability snapshot budget  
**Constraints**: No frontend framework/build step; no new mandatory env vars or host paths; no raw device labels, stable hardware identifiers, local paths, secrets, raw audio buffers, sample data, waveform data, MediaStream handles, AudioNode handles, or native capture handles in audio-input state, diagnostics, or capability payloads; permission prompts only on explicit open/start live-input flows; one primary user-selected input source at a time  
**Scale/Scope**: Single local user, one primary selected source, multiple source providers, native and compatibility-backed representations of the same logical source, multiple simultaneous requesters sharing compatible open sessions

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Result | Notes |
|-----------|--------|-------|
| I. Self-Hosted, Single-User, Docker-First | PASS | No auth, tenant model, mandatory env var, backend service, or host path is introduced. Optional desktop/native input bridges remain optional. |
| II. Vanilla Frontend - No Frameworks | PASS | Plan uses source-served vanilla JS, existing globals, and browser APIs only. |
| III. Plugins Are the Extension Point | PASS | Plugins/providers keep actual stream handles and plugin-specific capture behavior; core coordinates shared source identity, selection, lifecycle state, and diagnostics. |
| IV. Backwards-Compatible CDLC Library | PASS | No DLC file mutation, song format change, or highway WebSocket contract change is required. |
| V. Pure-Function Core Libraries, Tested | PASS | No new Python library architecture or import-time side effects are planned; validation is JS-focused with diagnostics coverage as needed. |
| VI. Observability Over Chattiness | PASS | Diagnostics are bounded, redaction-safe, and distinguish denied/unavailable/failed/incompatible states without raw input data. |
| VII. Versioned, Migration-Aware Settings | PASS | Selected-source persistence uses existing client preference storage when available and degrades safely; no settings import/export schema change is required. |

## Project Structure

### Documentation (this feature)

```text
specs/006-audio-input-domain/
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- checklists/
|   `-- requirements.md
|-- contracts/
|   |-- audio-input-control-plane.md
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
|   `-- audio-session.js              # Extend audio-input host commands, source state, open sessions, redaction, bridges
|-- diagnostics.js                    # Existing browser diagnostics contribution namespace
`-- index.html                        # Existing script ordering; no framework/build changes

plugins/
`-- capability_inspector/screen.js    # Surface richer audio-input source/session/outcome diagnostics

docs/
|-- capability-domains.md             # Plugin-author guidance for native audio-input providers/requesters
|-- capability-recipes.md             # Manifest recipes for source providers and requesters
|-- capability-roadmap.md             # Mark 006 migration status and removal gates when implemented
`-- capability-safety-matrix.md       # Stable audio-input command/provider operation summary updates

tests/
|-- js/
|   |-- audio_session_input.test.js
|   |-- audio_session_compat.test.js
|   |-- audio_session_host.test.js
|   `-- capability_inspector_render.test.js
`-- browser/
    `-- check-errors.spec.ts          # Focused smoke if visible input controls/inspector UI change
```

**Structure Decision**: Keep this migration in the existing vanilla frontend/runtime surface. `static/capabilities/audio-session.js` remains the `audio-input` domain owner; providers keep platform/native capture handles; the inspector and docs become support/migration surfaces. No backend route, new service, frontend framework, or persistent schema is needed.

## Complexity Tracking

No constitutional violations are introduced. No complexity exceptions are required.

## Phase 0: Research Summary

See [research.md](research.md). Key decisions:

- Extend the existing audio-session host instead of creating a parallel input runtime.
- Require provider-supplied redaction-safe logical source keys for persistence and duplicate suppression.
- Keep source inspection, listing, and selection prompt-free; permission prompts only happen during explicit open/start live-input flows.
- Add open/close coordination without brokering live stream or node handles through audio-input payloads.
- Share one open input session per selected source and compatible channel shape, reference-counted by requester.
- Keep diagnostics bounded and redaction-safe, including bridge hits and distinct denied/unavailable/failed/incompatible outcomes.

## Phase 1: Design Summary

Design artifacts created:

- [data-model.md](data-model.md) defines input providers, sources, selected input, open input sessions, requester references, channel requirements, permission state, bridges, and outcomes.
- [contracts/audio-input-control-plane.md](contracts/audio-input-control-plane.md) defines commands, provider operations, events, source/session payloads, sharing rules, and compatibility behavior.
- [contracts/diagnostics-schema.md](contracts/diagnostics-schema.md), [contracts/manifest-examples.md](contracts/manifest-examples.md), [contracts/migration-notes.md](contracts/migration-notes.md), and [contracts/testing-contract.md](contracts/testing-contract.md) capture supporting diagnostics, declaration, migration, and validation contracts.
- [quickstart.md](quickstart.md) defines validation order and representative audio-input scenarios.

## Post-Design Constitution Check

| Principle | Result | Notes |
|-----------|--------|-------|
| I. Self-Hosted, Single-User, Docker-First | PASS | Design remains local and single-user with no deployment inputs. |
| II. Vanilla Frontend - No Frameworks | PASS | UI/runtime changes stay in source-served JS and existing DOM/CSS. |
| III. Plugins Are the Extension Point | PASS | Plugins/providers retain actual capture handles and provider-specific state; core coordinates only shared control-plane state. |
| IV. Backwards-Compatible CDLC Library | PASS | Playback/source formats and highway data remain unchanged. |
| V. Pure-Function Core Libraries, Tested | PASS | Planned coverage is focused on JS runtime and diagnostics; no Python library architecture change. |
| VI. Observability Over Chattiness | PASS | Permission, availability, bridge, and open/close outcomes are diagnosable without raw device or audio data. |
| VII. Versioned, Migration-Aware Settings | PASS | Source selection persistence uses existing client preference storage and degrades safely when unavailable. |
