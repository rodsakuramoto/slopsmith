# Implementation Plan: Playback Control Plane

**Branch**: `008-playback` | **Date**: 2026-05-31 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/008-playback/spec.md`

## Summary

Promote song playback into a first-class `playback` capability domain that owns redaction-safe transport state, lifecycle events, media snapshots, seek/loop outcomes, route-change diagnostics, requester attribution, and legacy bridge accounting. The implementation keeps the actual transport behavior in the existing player code (`static/app.js`) and exposes it through a new core playback capability owner that uses the existing capability registry, event bus, diagnostics contribution pattern, and Capability Inspector support surfaces. Fresh audible playback starts remain user-action-only; plugins may observe, inspect, and control already-active sessions through bounded commands instead of wrapping `window.playSong` or reading raw media globals.

## Technical Context

**Language/Version**: Vanilla JavaScript in the source-served frontend; Python 3.12/FastAPI only for unchanged WebSocket, loop persistence, diagnostics bundle, and plugin-loading surfaces
**Primary Dependencies**: Existing `window.slopsmith` event bus, `static/capabilities.js` (`capability-pipelines.v1`), `static/app.js` playback/loop/JUCE transport functions, `static/highway.js` song lifecycle and clock helpers, `static/diagnostics.js`, `plugins/capability_inspector/screen.js`, `localStorage`, browser `HTMLAudioElement`, optional `window.slopsmithDesktop.audio` JUCE/native bridge
**Storage**: In-memory playback session, participants, request priority, route summary, bridge hits, and bounded recent per-session history; existing loop persistence endpoints remain unchanged; no new database/schema or mandatory settings file
**Testing**: `node --check`; focused Node JS tests under `tests/js/` for playback domain, compatibility bridges, diagnostics redaction, route changes, seek behavior, loop behavior, and inspector rendering; existing pytest diagnostics/plugin tests only if diagnostics export/import or plugin loading changes; focused Playwright/browser smoke for player and inspector console errors
**Target Platform**: Self-hosted single-user Slopsmith browser app served by Docker or local dev server, with optional desktop/native playback route
**Project Type**: Vanilla web app with FastAPI backend and plugin runtime
**Performance Goals**: Normal play/pause/resume/stop/seek/loop state changes visible through `playback.inspect` and diagnostics within 1 second; command handlers return explicit outcomes instead of hanging; route handoff preserves session/time or pauses degraded within focused validation; diagnostics stay within the existing 64 KB capability snapshot budget
**Constraints**: No frontend framework/build step; no new auth, tenant model, mandatory env var, host path, database, or backend service; exported diagnostics must not expose song titles, artists, arrangements, raw filenames, local paths, secret-bearing URLs, raw media elements/handles, audio buffers, samples, waveforms, recordings, or route-private objects; fresh audible starts require explicit user action
**Scale/Scope**: Single local user, one primary user-visible playback session at a time, multiple observer/requester participants during migration, one active browser or native route at a time, bounded current/recent playback diagnostic history

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Result | Notes |
|-----------|--------|-------|
| I. Self-Hosted, Single-User, Docker-First | PASS | No auth, multi-user model, mandatory env var, host path, or service is introduced. Optional desktop/native transport remains optional. |
| II. Vanilla Frontend - No Frameworks | PASS | Plan uses source-served JS, existing globals, existing DOM controls, and existing capability/event modules only. |
| III. Plugins Are the Extension Point | PASS | Plugins become playback requesters/observers rather than transport owners; actual plugin features remain out of core and migrate away from wrapper chains through compatibility bridges. |
| IV. Backwards-Compatible CDLC Library | PASS | PSARC/sloppak loading, DLC files, arrangement ids, and the highway WebSocket contract remain unchanged. |
| V. Pure-Function Core Libraries, Tested | PASS | No new Python library architecture or import-time side effects are planned; validation is JS-focused with diagnostics/export tests only if touched. |
| VI. Observability Over Chattiness | PASS | Playback state, route status, bridge hits, and recent outcomes become diagnosable without raw media handles, paths, secret URLs, or exported song metadata. |
| VII. Versioned, Migration-Aware Settings | PASS | No settings import/export schema change is required; existing loop persistence remains unchanged and playback diagnostics are runtime snapshots. |

## Project Structure

### Documentation (this feature)

```text
specs/008-playback/
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- checklists/
|   `-- requirements.md
|-- contracts/
|   |-- playback-control-plane.md
|   |-- diagnostics-schema.md
|   |-- migration-notes.md
|   `-- testing-contract.md
`-- tasks.md              # Created later by /speckit-tasks
```

### Source Code (repository root)

```text
static/
|-- app.js                            # Existing transport adapter: playSong, pause/resume, stop, seek, loops, route changes, event bridge calls
|-- capabilities.js                   # Existing dispatch/outcome/diagnostics primitives; add playback active-domain metadata as needed
|-- capabilities/
|   |-- audio-session.js              # Existing adjacent audio domains; do not transfer ownership into playback
|   `-- playback.js                   # New playback domain owner, command normalization, state, diagnostics, bridge hits
|-- diagnostics.js                    # Existing browser diagnostics contribution namespace
`-- index.html                        # Existing script ordering; load playback capability after capability runtime and before/with app adapter wiring

plugins/
`-- capability_inspector/screen.js    # Surface playback owner, requesters/observers, session state, route, loop, bridges, outcomes

docs/
|-- capability-domains.md             # Playback command/event/requester/observer lifecycle guidance
|-- capability-recipes.md             # Migration recipes for playback requesters/observers
|-- capability-roadmap.md             # 008 migration status and removal gates
`-- capability-safety-matrix.md       # Playback command/outcome/redaction notes

tests/
|-- js/
|   |-- playback_domain.test.js
|   |-- playback_compat.test.js
|   |-- playback_diagnostics.test.js
|   |-- song_seek.test.js
|   |-- loop_api.test.js
|   |-- loop_restart.test.js
|   `-- capability_inspector_render.test.js
`-- browser/
    `-- check-errors.spec.ts          # Focused smoke if visible player/inspector wiring changes
```

**Structure Decision**: Keep the actual media transport inside the existing player (`static/app.js`) and add `static/capabilities/playback.js` as the domain owner/coordinator. `static/app.js` exposes a redaction-safe transport adapter and emits bridge/lifecycle updates; the capability owner normalizes commands/outcomes, stores bounded state/history, contributes diagnostics, and keeps plugin-facing behavior off private globals. Audio-input, audio-monitoring, audio-mix, stems, visualization, and note-detection keep their separate ownership boundaries.

## Complexity Tracking

No constitutional violations are introduced. No complexity exceptions are required.

## Phase 0: Research Summary

See [research.md](research.md). Key decisions:

- Add a dedicated `playback` capability owner instead of folding transport lifecycle into `audio-session` or leaving it as ad hoc `window.playSong` wrappers.
- Treat `static/app.js` as the transport adapter and keep browser/JUCE media handles private.
- Make fresh audible starts user-action-only while allowing plugin observers and permitted controls for active sessions.
- Resolve conflicts by prioritizing explicit user actions, then latest non-stale same-priority requests.
- Reuse existing generation-token and serialized-seek patterns for stale action handling.
- Preserve active sessions/time across safe route changes and pause with degraded status when handoff is unsafe.
- Keep loop state in playback but leave saved-loop persistence unchanged.
- Export stable pseudonymous target ids and bounded recent per-session history only.
- Account for legacy playback wrappers, song events, media globals, loop helpers, seek helpers, and audio-element shims through compatibility bridge hits.

## Phase 1: Design Summary

Design artifacts created:

- [data-model.md](data-model.md) defines playback sessions, targets, requesters, observers, transport states, media snapshots, seek requests, loop regions, outcomes, diagnostic history, route summaries, and compatibility bridge hits.
- [contracts/playback-control-plane.md](contracts/playback-control-plane.md) defines the playback domain commands, events, outcomes, authorization rules, requester priority, route-change behavior, and legacy event bridging.
- [contracts/diagnostics-schema.md](contracts/diagnostics-schema.md) defines exported/local diagnostics payloads, pseudonymous target identity, history caps, bridge hits, and redaction rules.
- [contracts/migration-notes.md](contracts/migration-notes.md) defines wrapper migration recipes and bridge-removal gates.
- [contracts/testing-contract.md](contracts/testing-contract.md) defines the required validation scenarios for commands, conflicts, route changes, loops, diagnostics, and inspector rendering.
- [quickstart.md](quickstart.md) defines validation order and representative playback scenarios.

## Post-Design Constitution Check

| Principle | Result | Notes |
|-----------|--------|-------|
| I. Self-Hosted, Single-User, Docker-First | PASS | Design remains local and single-user with no deployment inputs. |
| II. Vanilla Frontend - No Frameworks | PASS | Runtime/UI changes stay in source-served JS and existing DOM/CSS. |
| III. Plugins Are the Extension Point | PASS | Plugins migrate to requester/observer roles; bridge accounting supports existing wrappers until removal gates pass. |
| IV. Backwards-Compatible CDLC Library | PASS | Song formats, DLC files, loop persistence endpoints, and highway WebSocket payloads remain stable. |
| V. Pure-Function Core Libraries, Tested | PASS | Planned coverage is JS-focused; no Python core library change is required. |
| VI. Observability Over Chattiness | PASS | Diagnostics distinguish target pseudonyms, route, state, loop, conflicts, bridges, and outcomes without raw media data or exported song metadata. |
| VII. Versioned, Migration-Aware Settings | PASS | No settings schema change; existing saved-loop storage remains the only persistence path touched. |
