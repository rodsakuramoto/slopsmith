# Tasks: Audio Input Control Plane

**Input**: Design documents from `/specs/006-audio-input-domain/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: Included because the feature specification defines independent test scenarios and [contracts/testing-contract.md](contracts/testing-contract.md) requires focused JS/browser validation.

**Organization**: Tasks are grouped by user story so each story can be implemented and tested as an independent increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files and does not depend on incomplete tasks
- **[Story]**: User story label for traceability (`US1`, `US2`, `US3`, `US4`)
- Every task includes at least one exact repository file path

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Align shared docs and command inventory before implementation starts.

- [X] T001 [P] Update the audio-input migration status and active-slice notes in docs/capability-roadmap.md
- [X] T002 [P] Update stable audio-input commands, provider operations, and safety notes in docs/capability-safety-matrix.md
- [X] T003 [P] Update native audio-input provider/requester manifest guidance in docs/capability-recipes.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add shared runtime/test infrastructure that all user stories depend on.

**Critical**: No user story work should begin until this phase is complete.

- [X] T004 [P] Extend audio-session JS test helpers for localStorage state, event capture, deterministic provider callbacks, and diagnostics snapshots in tests/js/audio_session_test_harness.js
- [X] T005 Add audio-input constants and normalization helpers for availability, source modes, logical source keys, channel shapes, requester ids, and bounded reasons in static/capabilities/audio-session.js
- [X] T006 Add canonical audio-input state containers for providers, sources, selected input, open input sessions, and input bridge hits in static/capabilities/audio-session.js
- [X] T007 Add shared redaction, pseudonymization, safe-summary, and live-handle stripping helpers for audio-input payloads in static/capabilities/audio-session.js
- [X] T008 Extend the audio-input owner registration with list-sources, open-source, close-source, permission-denied, source-opened, source-closed, and source-open-degraded command/event metadata in static/capabilities/audio-session.js

**Checkpoint**: The audio-input host can represent the new model and expose the command surface, even if individual commands still return degraded or placeholder results.

---

## Phase 3: User Story 1 - Select A Trusted Input Source (Priority: P1) MVP

**Goal**: A player can choose a trusted input source, see whether it is available, and have requesters inspect the selected source without reading plugin-private state.

**Independent Test**: Register representative sources, select one, change availability, and confirm the selected source and status are visible through audio-input diagnostics/inspect without triggering live input.

### Tests for User Story 1

- [X] T009 [US1] Add source registration, list-sources, inspect, select-source, no-selection, unavailable-selected-source, and prompt-free selection tests in tests/js/audio_session_input.test.js

### Implementation for User Story 1

- [X] T010 [US1] Implement register-source validation for sourceId, providerId, logicalSourceKey, availability, kind, label, and channelSummary in static/capabilities/audio-session.js
- [X] T011 [US1] Implement list-sources and inspect responses with selected source summaries and redaction-safe source identities in static/capabilities/audio-session.js
- [X] T012 [US1] Implement select-source by logicalSourceKey or sourceId without opening live input or silently selecting a different source in static/capabilities/audio-session.js
- [X] T013 [US1] Emit source-registered, source-selected, and source-availability-changed events with safe payloads in static/capabilities/audio-session.js
- [X] T014 [US1] Validate the source registration, selection, no-selection, unavailable-source, and prompt-free inspect scenarios from specs/006-audio-input-domain/quickstart.md using tests/js/audio_session_input.test.js

**Checkpoint**: User Story 1 is independently functional; audio-input can list, inspect, and select sources without private globals or permission prompts.

---

## Phase 4: User Story 2 - Migrate Input Providers And Requesters Safely (Priority: P2)

**Goal**: Native audio-input providers/requesters work while legacy browser, desktop, or plugin-specific input handoffs remain attributed and usable during migration.

**Independent Test**: Register one native input provider and one legacy/compatibility bridge for the same logical source, then confirm diagnostics represent both while native source state owns the visible source.

### Tests for User Story 2

- [X] T015 [US2] Add native-provider, explicit source.enumerate invocation, compatibility-backed-source, bridge-hit, and native-over-legacy duplicate suppression tests in tests/js/audio_session_compat.test.js

### Implementation for User Story 2

- [X] T016 [US2] Implement sourceMode, compatibilitySource, supersededBy, and compatibility-backed source summaries in static/capabilities/audio-session.js
- [X] T017 [US2] Implement native-over-compatibility duplicate suppression by logicalSourceKey with deterministic visible source ordering in static/capabilities/audio-session.js
- [X] T018 [US2] Implement provider operation handler storage plus an explicit source.enumerate invocation path for provider/user-requested discovery, while ensuring inspect, list-sources, and select-source never call enumeration or expose handlers in diagnostics in static/capabilities/audio-session.js
- [X] T019 [US2] Implement audio-input bridge-hit recording for legacy browser, desktop, and plugin-specific handoffs through recordBridgeHit in static/capabilities/audio-session.js
- [X] T020 [US2] Document native source registration, requester usage, compatibility bridge behavior, and removal gates in docs/capability-domains.md
- [X] T021 [P] [US2] Update audio-input provider/requester manifest examples for open-source and close-source requests in docs/capability-recipes.md
- [X] T022 [P] [US2] Update audio-input stable commands and provider operations after implementation in docs/capability-safety-matrix.md
- [X] T023 [US2] Validate the native-vs-legacy migration scenarios from specs/006-audio-input-domain/quickstart.md using tests/js/audio_session_compat.test.js

**Checkpoint**: User Story 2 is independently functional; migrated and legacy input paths can coexist without duplicate user-visible sources.

---

## Phase 5: User Story 3 - Explain Permission And Device Failures (Priority: P3)

**Goal**: A user or maintainer can distinguish denied, unavailable, failed, incompatible, no-owner, and no-handler input states without leaking device or audio data.

**Independent Test**: Force granted, denied, unavailable, incompatible, no-owner, no-handler, degraded, and failed outcomes and verify diagnostics distinguish them with redacted details.

### Tests for User Story 3

- [X] T024 [US3] Add open-source and close-source outcome tests for denied, unavailable, failed, incompatible, no-owner, no-handler, unsupported-command, malformed provider data, and permission-denied/source-opened/source-open-degraded/source-closed event payloads in tests/js/audio_session_input.test.js
- [X] T025 [P] [US3] Add diagnostics redaction tests for raw source ids, raw labels, stable hardware ids, paths, secrets, live handles, buffers, samples, and waveform data in tests/js/audio_session_host.test.js
- [X] T026 [P] [US3] Add Capability Inspector render tests for audio-input sources, selected state, open sessions, bridge hits, and failure outcomes in tests/js/capability_inspector_render.test.js

### Implementation for User Story 3

- [X] T027 [US3] Implement open-source command dispatch with provider source.open routing, requester attribution, permission-denied, unavailable, failed, incompatible, and no-owner outcomes plus permission-denied, source-opened, and source-open-degraded events in static/capabilities/audio-session.js
- [X] T028 [US3] Implement close-source command dispatch with provider source.close routing, no-handler handling, failed close outcomes, and source-closed events in static/capabilities/audio-session.js
- [X] T029 [US3] Record bounded audio-input outcomes with providerId, sourceId, logicalSourceKey, requesterId, openSessionId, status, and safe reason in static/capabilities/audio-session.js
- [X] T030 [US3] Extend audio-input diagnostics snapshots with selected input, openSessions, storageStatus, totalSources, totalOpenSessions, bridges, and recent outcomes in static/capabilities/audio-session.js
- [X] T031 [US3] Render audio-input source status, selected input, open sessions, bridge hits, and recent failure outcomes in plugins/capability_inspector/screen.js
- [X] T032 [US3] Validate the permission, device failure, diagnostics, and raw-data exclusion scenarios from specs/006-audio-input-domain/quickstart.md using tests/js/audio_session_input.test.js and tests/js/audio_session_host.test.js

**Checkpoint**: User Story 3 is independently functional; failures are diagnosable without exposing raw device or audio data.

---

## Phase 6: User Story 4 - Keep Input State Stable Across Sessions (Priority: P4)

**Goal**: Selected input state remains stable across reloads, provider rehydration, song switches, and simultaneous compatible requesters without duplicates or stale selections.

**Independent Test**: Select a source, reload or rehydrate providers, switch songs, open the same compatible source for multiple requesters, and confirm selected state, availability, diagnostics, and open sessions remain consistent.

### Tests for User Story 4

- [X] T033 [US4] Add selected-source persistence, storage-unavailable, reload restore within 1 second after provider registration, same-key reappearance, and no-silent-replacement tests in tests/js/audio_session_input.test.js
- [X] T034 [P] [US4] Add shared open session, requester reference counting, channel-shape compatibility, and last-release close tests in tests/js/audio_session_host.test.js
- [X] T035 [P] [US4] Add song-switch, startSession, stopSession, repeated hydration, and selected-source stability tests in tests/js/audio_session_routes.test.js

### Implementation for User Story 4

- [X] T036 [US4] Implement selected logical source persistence and storage-unavailable fallback using localStorage in static/capabilities/audio-session.js
- [X] T037 [US4] Implement channelSummary and requiredChannelShape compatibility helpers that return incompatible without changing selected source in static/capabilities/audio-session.js
- [X] T038 [US4] Implement shared open input sessions with requester reference tracking and provider close after the last requester releases in static/capabilities/audio-session.js
- [X] T039 [US4] Preserve selected input across startSession, stopSession, and song switching without tying selection to playback transport in static/capabilities/audio-session.js
- [X] T040 [US4] Make repeated provider hydration idempotent by logicalSourceKey with updated lastSeenAt and availability metadata in static/capabilities/audio-session.js
- [X] T041 [US4] Validate the reload, 1-second restore/reporting target, rehydration, song-switching, shared requester, and channel-shape scenarios from specs/006-audio-input-domain/quickstart.md using tests/js/audio_session_input.test.js and tests/js/audio_session_host.test.js

**Checkpoint**: User Story 4 is independently functional; downstream domains can rely on stable selected input state and shared open-session lifecycle.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final documentation, validation, and cleanup across all stories.

- [X] T042 [P] Update implementation-specific validation commands and manual scenarios in specs/006-audio-input-domain/quickstart.md
- [X] T043 [P] Update audio-input roadmap status and removal gates after implementation in docs/capability-roadmap.md
- [X] T044 [P] Add changelog entry for the audio-input control-plane migration in CHANGELOG.md
- [X] T045 Run JavaScript syntax checks for static/capabilities.js, static/capabilities/audio-session.js, and plugins/capability_inspector/screen.js using specs/006-audio-input-domain/quickstart.md
- [X] T046 Run focused Node tests for tests/js/audio_session_input.test.js, tests/js/audio_session_compat.test.js, tests/js/audio_session_host.test.js, tests/js/audio_session_routes.test.js, and tests/js/capability_inspector_render.test.js
- [X] T047 Run diagnostics and browser validation from specs/006-audio-input-domain/quickstart.md, including pytest tests/test_diagnostics_bundle.py and tests/browser/check-errors.spec.ts when diagnostics or visible UI changed
- [X] T048 Verify implementation and documentation remain within the non-goals for note scoring, monitoring DSP, recording capture, audio effects, playback transport, plugin installation, backend source services in specs/006-audio-input-domain/spec.md and docs/capability-domains.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; documentation inventory tasks can start immediately.
- **Foundational (Phase 2)**: Depends on Setup for final terminology and blocks all user stories.
- **User Stories (Phase 3+)**: Depend on Foundational completion.
- **Polish (Phase 7)**: Depends on the desired user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Start after Foundational; provides MVP source discovery, selection, and inspection.
- **User Story 2 (P2)**: Start after Foundational; can run after or alongside US1 once source summaries and logical keys exist, but final duplicate behavior should be checked against US1.
- **User Story 3 (P3)**: Start after Foundational; open/close outcomes can be developed once source/provider models exist.
- **User Story 4 (P4)**: Start after Foundational; best completed after US1/US3 so persistence and shared-session tests cover selection plus open/close lifecycle.

### Within Each User Story

- Tests first; confirm they fail before implementation.
- Host/runtime changes before inspector or documentation validation.
- Source identity and selection before open/close lifecycle.
- Diagnostics redaction before diagnostics export or support-surface validation.

---

## Parallel Opportunities

- T001, T002, and T003 can run in parallel.
- T004 can run in parallel with documentation setup because it touches the JS test harness only.
- T021 and T022 can run in parallel during US2 because they touch separate docs files.
- T025 and T026 can run in parallel during US3 because they touch separate test files.
- T034 and T035 can run in parallel during US4 because they touch separate test files.
- T042, T043, and T044 can run in parallel during polish.

---

## Parallel Example: User Story 1

```text
Task: T009 Add source registration/list/select tests in tests/js/audio_session_input.test.js
Task: T013 Emit source lifecycle events in static/capabilities/audio-session.js after T010-T012 are complete
```

## Parallel Example: User Story 2

```text
Task: T021 Update manifest examples in docs/capability-recipes.md
Task: T022 Update command inventory in docs/capability-safety-matrix.md
```

## Parallel Example: User Story 3

```text
Task: T025 Add diagnostics redaction tests in tests/js/audio_session_host.test.js
Task: T026 Add inspector render tests in tests/js/capability_inspector_render.test.js
```

## Parallel Example: User Story 4

```text
Task: T034 Add shared open session tests in tests/js/audio_session_host.test.js
Task: T035 Add song-switch stability tests in tests/js/audio_session_routes.test.js
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 for User Story 1.
3. Stop and validate source registration, list-sources, inspect, select-source, unavailable selected source, and no-selection behavior.
4. Demo audio-input source selection through capability dispatch and diagnostics before adding compatibility and open-session depth.

### Incremental Delivery

1. Foundation: shared model, normalization, command registration, redaction helpers, and test harness.
2. MVP: US1 source discovery, selection, prompt-free inspection, and selected-source visibility.
3. Migration: US2 native provider/requester behavior, compatibility bridge accounting, and duplicate suppression.
4. Supportability: US3 open/close outcomes, diagnostics redaction, and inspector detail.
5. Stability: US4 persistence, rehydration, song-switching, channel-shape compatibility, and shared requester sessions.
6. Polish: docs, changelog, syntax checks, JS tests, browser smoke, and diagnostics validation.

### Scope Control

This task list intentionally excludes note scoring, monitoring DSP, recording capture, audio effects, playback transport, plugin installation, backend source services, and new UI frameworks except where existing tests require preserving or reporting their input-source metadata.

---

## Notes

- [P] tasks touch different files and can run in parallel after their phase dependencies are met.
- [US1], [US2], [US3], and [US4] labels map directly to the user stories in [spec.md](spec.md).
- Every story has focused validation and can be stopped at its checkpoint for independent review.
- Do not commit automatically; use the configured Spec Kit git hook only when the user asks for it.