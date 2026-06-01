# Implementation Plan: Audio Graph/Session Capability Slice

**Branch**: `004-audio-graph-session` | **Date**: 2026-05-29 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/004-audio-graph-session/spec.md`

## Summary

Promote the first concrete capability-domain slice after the migration standard: a core-owned audio session host for each active player/song that coordinates `audio-mix`, `audio-input`, `audio-monitoring`, and `stems`. The implementation approach is to add the native audio-session host boundary to the existing browser capability runtime, bridge current fader/stem/analyser/route globals into attributed capability participants, surface redacted diagnostics and Inspector state, and preserve legacy user-visible behavior while blocking new bundled legacy-only audio coupling.

## Technical Context

**Language/Version**: Vanilla JavaScript in the source-served browser frontend; Python 3.12/FastAPI only for existing diagnostics/test surfaces touched by validation  
**Primary Dependencies**: Existing `window.slopsmith` event bus, `static/capabilities.js` (`capability-pipelines.v1`), `static/audio-mixer.js`, `static/highway.js`, Capability Inspector plugin, Web Audio APIs, optional `window.slopsmithDesktop.audio` bridge  
**Storage**: `localStorage` for existing user mix preferences; diagnostics contributions in memory/export bundle; no new persistent database schema  
**Testing**: `node --check`, Node JS tests under `tests/js/`, pytest diagnostics/plugin-runtime tests, focused Playwright/manual player scenarios  
**Target Platform**: Self-hosted single-user Slopsmith browser app, including Docker-served web UI and optional desktop wrapper audio bridge  
**Project Type**: Web app with vanilla browser frontend, FastAPI backend, and plugin runtime  
**Performance Goals**: Inspect/register/fader/automation dispatch should settle within the existing capability handler budget for UI-visible operations; diagnostics snapshots remain bounded by the 64 KB capability snapshot limit; audio route/fader changes must not block highway WebSocket message processing  
**Constraints**: No frontend framework or build pipeline; no new mandatory env vars or host paths; sensitive device/source diagnostics must use redaction plus per-bundle pseudonyms; one core audio session host coordinates the four domains for each active player/song  
**Scale/Scope**: Single local user, one primary active player/song at a time, plugin participants from bundled and external plugins, optional splitscreen visualization panels sharing the player audio session

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Result | Notes |
|-----------|--------|-------|
| I. Self-Hosted, Single-User, Docker-First | PASS | No auth, tenant model, mandatory env var, or host path is introduced. Optional desktop audio bridge remains optional. |
| II. Vanilla Frontend - No Frameworks | PASS | Plan uses source-served vanilla JS modules under `static/` and existing browser APIs only. |
| III. Plugins Are the Extension Point | PASS | Core owns coordination/diagnostics only; plugin DSP, stem playback, monitoring, and visualization features remain plugin-owned participants. |
| IV. Backwards-Compatible CDLC Library | PASS | No DLC file mutation, PSARC/sloppak format change, or highway message breaking change is required. |
| V. Pure-Function Core Libraries, Tested | PASS | No new import-time Python side effects; validation adds focused JS/pytest coverage around runtime behavior and diagnostics. |
| VI. Observability Over Chattiness | PASS | Diagnostics are redaction-first, bounded, and explain native vs compatibility outcomes with per-bundle pseudonyms. |
| VII. Versioned, Migration-Aware Settings | PASS | Existing `localStorage` volume behavior is preserved; no settings import/export schema change is required. |

## Project Structure

### Documentation (this feature)

```text
specs/004-audio-graph-session/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── legacy-inventory.md
├── checklists/
│   ├── domain-migration.md
│   └── requirements.md
├── contracts/
│   ├── audio-domain-contract.md
│   └── migration-notes.md
└── tasks.md              # Created later by /speckit-tasks
```

### Source Code (repository root)

```text
static/
├── capabilities.js                  # Existing runtime primitives and diagnostics vocabulary
├── capabilities/
│   ├── library.js                    # Reference native provider-coordinator domain
│   └── audio-session.js              # Planned core-owned audio session/domain host
├── audio-mixer.js                    # Existing fader registry, to become compatibility bridge/client
├── highway.js                        # Existing route/JUCE/HTML5 handoff, to report audio-session route state
├── diagnostics.js                    # Existing browser diagnostics contribution namespace
└── index.html                        # Script ordering and player controls remain source-served

plugins/
├── capability_inspector/screen.js    # Support visibility for active audio domains and bridges
└── highway_3d/screen.js              # Existing analyser consumer used as compatibility validation input

docs/
├── capability-domains.md             # Domain documentation and plugin author guidance
├── capability-roadmap.md             # Promote audio domains from deferred to active when implemented
├── capability-recipes.md             # Manifest examples for audio participants/requesters
└── capability-safety-matrix.md       # Safety classes and command summary

tests/
├── js/                               # Runtime/unit coverage for capability behavior and bridges
├── browser/                          # Focused player/audio UI smoke scenarios when needed
└── test_diagnostics_bundle.py        # Diagnostics export redaction/shape coverage when backend bundle shape changes
```

**Structure Decision**: Keep the implementation in the existing vanilla frontend/runtime surface. Add one core audio-session capability module modeled after `static/capabilities/library.js`, then migrate existing audio globals into compatibility clients instead of introducing a framework, backend service, or plugin-specific host.

## Complexity Tracking

No constitutional violations are introduced. No complexity exceptions are required.

## Phase 0: Research Summary

See [research.md](research.md). Key decisions:

- Use a core-owned audio session host per active player/song.
- Promote the four audio domains together because current bugs cross routing, faders, analyser access, monitoring, and stems.
- Preserve existing fader/stem/analyser/JUCE behavior through compatibility bridges with diagnostics.
- Use per-bundle pseudonyms for sensitive audio source/device correlation.
- Keep playback transport and note detection as downstream consumers, not responsibilities of this slice.

## Phase 1: Design Summary

Design artifacts created:

- [data-model.md](data-model.md) defines audio session, participants, routes, sources, monitoring sessions, stem automation claims, analyser taps, bridges, diagnostics outcomes, and migration notes.
- [contracts/audio-domain-contract.md](contracts/audio-domain-contract.md) defines the public domain commands, provider operations, events, dispatch outcomes, and diagnostics payload expectations.
- [contracts/migration-notes.md](contracts/migration-notes.md) defines plugin-author migration guidance for covered legacy surfaces.
- [quickstart.md](quickstart.md) defines validation order and representative scenarios.

## Post-Design Constitution Check

| Principle | Result | Notes |
|-----------|--------|-------|
| I. Self-Hosted, Single-User, Docker-First | PASS | Design remains local and single-user; no new deployment inputs. |
| II. Vanilla Frontend - No Frameworks | PASS | Contracts are implemented through existing source-served JS and plugin runtime. |
| III. Plugins Are the Extension Point | PASS | Core coordinates shared session state; feature-specific audio processing remains plugin-owned. |
| IV. Backwards-Compatible CDLC Library | PASS | Song format behavior is preserved and PSARC/sloppak routing differences become diagnosable. |
| V. Pure-Function Core Libraries, Tested | PASS | Planned coverage is focused on JS runtime and diagnostics; no Python library architecture change. |
| VI. Observability Over Chattiness | PASS | Diagnostics are explicit, redacted, bounded, and distinguish native failures from bridge failures. |
| VII. Versioned, Migration-Aware Settings | PASS | Existing volume/localStorage behavior remains compatible and import/export semantics are unchanged. |
