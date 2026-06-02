# Tasks: Audio Monitoring Control Plane

**Input**: Design documents from `/specs/007-audio-monitoring-domain/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: Included because the feature specification defines independent test scenarios and [contracts/testing-contract.md](contracts/testing-contract.md) requires focused JS/browser validation.

**Organization**: Tasks are grouped by user story so each story can be implemented and tested as an independent increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files and does not depend on incomplete tasks
- **[Story]**: User story label for traceability (`US1`, `US2`, `US3`, `US4`)
- Every task includes at least one exact repository file path

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Align shared docs, command inventory, and test scaffolding before runtime implementation starts.

- [X] T001 [P] Update the audio-monitoring migration status and active-slice notes in docs/capability-roadmap.md
- [X] T002 [P] Update stable audio-monitoring commands, provider operations, safety notes, and outcome list in docs/capability-safety-matrix.md
- [X] T003 [P] Update monitoring provider/requester manifest and runtime examples in docs/capability-recipes.md
- [X] T004 [P] Update audio-monitoring provider/requester lifecycle guidance and user-action boundary notes in docs/capability-domains.md
- [X] T005 [P] Add monitoring provider factory helpers, provider call capture, and direct-monitor summary fixtures in tests/js/audio_session_test_harness.js

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add shared monitoring model primitives that all user stories depend on.

**Critical**: No user story work should begin until this phase is complete.

- [X] T006 Add audio-monitoring constants for states, outcomes, operation names, authorization modes, direct-monitor states, and selected-provider storage key in static/capabilities/audio-session.js
- [X] T007 Add monitoring normalization helpers for provider ids, logicalMonitoringKey, requester refs, sourceRef summaries, authorization payloads, directMonitor summaries, latency summaries, and bounded safe reasons in static/capabilities/audio-session.js
- [X] T008 Add canonical monitoring state containers for monitoringProviders, selectedMonitoringProvider, monitoringSessions, requester references, and monitoring bridge hits in static/capabilities/audio-session.js
- [X] T009 Add monitoring safe-summary and live-handle stripping helpers that reject raw audio buffers, MediaStream handles, AudioNode handles, native handles, raw device labels, local paths, and secrets in static/capabilities/audio-session.js
- [X] T010 Extend audio-monitoring owner metadata with stable select-provider and set-direct-monitor commands, provider registration, provider selection, direct-monitor events, degraded/failed/denied/incompatible/user-action-required outcomes, and monitoring.status operation descriptions in static/capabilities/audio-session.js

**Checkpoint**: The audio-monitoring host can represent providers, sessions, requesters, direct-monitor summaries, and safe outcomes, even before individual story behavior is complete.

---

## Phase 3: User Story 1 - Start And Stop Live Monitoring (Priority: P1) MVP

**Goal**: A player can start and stop live monitoring through the shared domain, with clear active/stopped/unavailable/denied/degraded/failed state and no silent background starts.

**Independent Test**: Register a monitoring provider, select an available input source, start monitoring from a user action, stop monitoring, and confirm state/events/diagnostics through the domain.

### Tests for User Story 1

- [X] T011 [US1] Add user-authorized start, provider start dispatch, active session payload, monitoring-started event, and selected source reference tests in tests/js/audio_session_monitoring.test.js
- [X] T012 [US1] Add stop, monitoring-stopped event, no provider, unavailable provider, active degraded start with monitoring-degraded event, denied/unavailable/failed start events, background user-action-required, song switch persistence, and reload no-auto-resume tests in tests/js/audio_session_monitoring.test.js

### Implementation for User Story 1

- [X] T013 [US1] Implement registerMonitoringProvider, unregisterMonitoringProvider, listMonitoringProviders, and inspectMonitoring for a single available provider in static/capabilities/audio-session.js
- [X] T014 [US1] Implement selected/default provider resolution for no provider, one provider, explicit providerId, and selected logicalMonitoringKey in static/capabilities/audio-session.js
- [X] T015 [US1] Implement monitoring start authorization so fresh background/plugin starts return user-action-required while user-action starts proceed in static/capabilities/audio-session.js
- [X] T016 [US1] Integrate monitoring start with audio-input selected source and open-session readiness summaries without changing source ownership in static/capabilities/audio-session.js
- [X] T017 [US1] Implement provider monitoring.start dispatch with active, denied, unavailable, failed, and active degraded outcome normalization in static/capabilities/audio-session.js
- [X] T018 [US1] Implement provider monitoring.stop dispatch for user stop and stopped/no-handler/failed stop outcomes in static/capabilities/audio-session.js
- [X] T019 [US1] Preserve active monitoring sessions across startSession, stopSession, song switches, and playback stops in static/capabilities/audio-session.js
- [X] T020 [US1] Restore selected monitoring provider preference after reload while leaving live monitoring stopped until explicit start in static/capabilities/audio-session.js
- [X] T021 [US1] Validate the MVP start/stop/user-action/reload scenarios from specs/007-audio-monitoring-domain/quickstart.md using tests/js/audio_session_monitoring.test.js

**Checkpoint**: User Story 1 is independently functional; the player can start/stop monitoring through the domain and background requesters cannot silently start live audio.

---

## Phase 4: User Story 2 - Coordinate Monitoring Across Providers And Requesters (Priority: P2)

**Goal**: Monitoring providers and requesters can coexist during migration without duplicate provider starts, arbitrary provider choice, or conflicting stop behavior.

**Independent Test**: Register multiple providers/requesters, start monitoring from different requesters, and confirm provider ownership, requester references, sharing, and lifecycle outcomes remain deterministic.

### Tests for User Story 2

- [X] T022 [US2] Add idempotent provider registration, provider availability update, native-over-compatibility duplicate suppression, and provider-selection-required tests in tests/js/audio_session_monitoring.test.js
- [X] T023 [US2] Add shared session attach, compatible background requester attach, requester reference counting, final-requester provider stop, and provider disappearance/orphaning tests in tests/js/audio_session_monitoring.test.js
- [X] T024 [P] [US2] Add monitoring bridge-hit and native-over-legacy diagnostics tests for audio-monitoring.audio-barrier and legacy start/stop/direct-monitor surfaces in tests/js/audio_session_compat.test.js

### Implementation for User Story 2

- [X] T025 [US2] Implement logicalMonitoringKey duplicate suppression with native providers superseding compatibility-backed providers in static/capabilities/audio-session.js
- [X] T026 [US2] Implement provider selection persistence and provider-selection-required outcomes when multiple compatible providers exist with no explicit or selected provider in static/capabilities/audio-session.js
- [X] T027 [US2] Implement deterministic monitoring session keys by provider, selected source, requiredChannelShape, and direct-monitor policy in static/capabilities/audio-session.js
- [X] T028 [US2] Implement compatible requester attach so background requesters can attach to active sessions without re-calling monitoring.start in static/capabilities/audio-session.js
- [X] T029 [US2] Implement requester reference tracking and final-requester monitoring.stop behavior in static/capabilities/audio-session.js
- [X] T030 [US2] Implement provider disappearance, disablement, unregister, and incompatible-version handling that marks active sessions unavailable, degraded, or orphaned with safe reasons in static/capabilities/audio-session.js
- [X] T031 [US2] Implement monitoring-specific bridge-hit recording for legacy readiness, start, stop, and direct-monitor toggle paths through recordBridgeHit in static/capabilities/audio-session.js
- [X] T032 [US2] Validate provider coordination, requester sharing, provider-selection-required, compatibility bridge, and orphaning scenarios from specs/007-audio-monitoring-domain/quickstart.md using tests/js/audio_session_monitoring.test.js and tests/js/audio_session_compat.test.js

**Checkpoint**: User Story 2 is independently functional; migrated and legacy monitoring paths can coexist without duplicate user-visible providers or conflicting requester stops.

---

## Phase 5: User Story 3 - Control Direct Monitoring Behavior (Priority: P3)

**Goal**: A player can see and control dry direct-monitor behavior, and requesters with direct-monitor requirements receive degraded/unsupported status without overriding the user's setting.

**Independent Test**: Toggle direct-monitor mute while monitoring is active, inspect status, and confirm provider-supported, provider-unsupported, and requester-conflict outcomes are visible and redaction-safe.

### Tests for User Story 3

- [X] T033 [US3] Add direct-monitor state normalization, user preference, provider apply, unsupported control, direct-monitor-changed event, and stopped-state preference tests in tests/js/audio_session_monitoring.test.js
- [X] T034 [US3] Add direct-monitor requester requirement conflict tests for muted/unmuted requirements, degraded requester status, unsupported requester status, and unchanged user/default preference in tests/js/audio_session_monitoring.test.js

### Implementation for User Story 3

- [X] T035 [US3] Implement direct-monitor preference storage, normalization, and status summaries for muted, unmuted, unsupported, unavailable, and unknown in static/capabilities/audio-session.js
- [X] T036 [US3] Implement stable set-direct-monitor command behavior plus a setDirectMonitoringState helper that updates user/default preference and applies provider control only when supported in static/capabilities/audio-session.js
- [X] T037 [US3] Include directMonitorPreference and directMonitorRequirement in monitoring.start provider requests without letting requester requirements mutate the user/default setting in static/capabilities/audio-session.js
- [X] T038 [US3] Implement direct-monitor conflict evaluation that returns degraded or unsupported requester status when the user/default setting cannot satisfy a requester requirement in static/capabilities/audio-session.js
- [X] T039 [US3] Emit direct-monitor-changed events and update active monitoring session summaries within 1 second for supporting providers in static/capabilities/audio-session.js
- [X] T040 [US3] Validate direct-monitor supported, unsupported, stopped-state, and requester-conflict scenarios from specs/007-audio-monitoring-domain/quickstart.md using tests/js/audio_session_monitoring.test.js

**Checkpoint**: User Story 3 is independently functional; direct-monitor state is user-authoritative, visible, and safe for support tooling.

---

## Phase 6: User Story 4 - Explain Monitoring Failures Safely (Priority: P4)

**Goal**: Users and maintainers can distinguish monitoring failures by source, provider, direct-monitor, compatibility bridge, and outcome without exposing private audio/device data.

**Independent Test**: Force denied, unavailable, failed, no-owner, no-handler, unsupported-command, incompatible, incompatible-version, degraded, provider-selection-required, user-action-required, and stopped outcomes and verify diagnostics distinguish them safely.

### Tests for User Story 4

- [X] T041 [US4] Add monitoring outcome tests for denied, unavailable, failed, no-owner, no-handler, unsupported-command, incompatible channel/source requirements, incompatible-version, provider-selection-required, user-action-required, stopped, malformed provider data, provider timeout, prompt-free inspect/status with no provider start or audio-input open side effects, and matching failure/degraded event emissions in tests/js/audio_session_monitoring.test.js
- [X] T042 [P] [US4] Add monitoring diagnostics redaction tests for raw device labels, stable hardware ids, local paths, secrets, raw audio buffers, samples, waveform data, MediaStream handles, AudioNode handles, native handles, and provider-private payloads in tests/js/audio_session_host.test.js
- [X] T043 [P] [US4] Add Capability Inspector render tests for monitoring providers, selected provider, active sessions, requester refs, direct-monitor state, bridge hits, and recent failure outcomes in tests/js/capability_inspector_render.test.js

### Implementation for User Story 4

- [X] T044 [US4] Implement monitoring.status provider operation dispatch with prompt-free inspection, malformed response handling, timeout handling, and bounded safe reasons in static/capabilities/audio-session.js
- [X] T045 [US4] Extend monitoring diagnostics snapshot with providers, selectedProvider, sessions, totalProviders, totalSessions, directMonitor summary, bridges, and recent outcomes in static/capabilities/audio-session.js
- [X] T046 [US4] Redact and pseudonymize monitoring provider, source, session, bridge, and outcome summaries to exclude raw labels, paths, hardware ids, handles, buffers, samples, waveforms, recordings, and secrets in static/capabilities/audio-session.js
- [X] T047 [US4] Record bounded monitoring outcomes with providerId, monitoringId, requesterId, logicalSourceKey, sourceId, openInputSessionId, bridgeId, status, and safe reason in static/capabilities/audio-session.js
- [X] T048 [US4] Render monitoring providers, selected provider, sessions, requester refs, direct-monitor state, bridge hits, and recent outcomes in plugins/capability_inspector/screen.js
- [X] T049 [US4] Validate failure distinction, diagnostics redaction, and Capability Inspector support scenarios from specs/007-audio-monitoring-domain/quickstart.md using tests/js/audio_session_monitoring.test.js, tests/js/audio_session_host.test.js, and tests/js/capability_inspector_render.test.js

**Checkpoint**: User Story 4 is independently functional; monitoring failures are diagnosable without exposing raw audio or device identity.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final documentation, validation, and cleanup across all stories.

- [X] T050 [P] Update implementation-specific validation commands and manual scenarios in specs/007-audio-monitoring-domain/quickstart.md
- [X] T051 [P] Update monitoring migration notes and removal gates after implementation in specs/007-audio-monitoring-domain/contracts/migration-notes.md
- [X] T052 [P] Add changelog entry for the audio-monitoring control-plane migration in CHANGELOG.md
- [X] T053 Run JavaScript syntax checks for static/capabilities/audio-session.js and plugins/capability_inspector/screen.js using specs/007-audio-monitoring-domain/quickstart.md
- [X] T054 Run focused Node tests for tests/js/audio_session_monitoring.test.js, tests/js/audio_session_input.test.js, tests/js/audio_session_compat.test.js, tests/js/audio_session_host.test.js, and tests/js/capability_inspector_render.test.js
- [X] T055 Run full JavaScript test suite with npm run test:js using package.json and tests/js/audio_session_monitoring.test.js
- [X] T056 Run browser smoke validation for tests/browser/check-errors.spec.ts when Capability Inspector or player-visible monitoring UI changes in plugins/capability_inspector/screen.js
- [X] T057 Run focused backend diagnostics validation with tests/test_diagnostics_bundle.py and tests/test_plugins.py if monitoring implementation changes diagnostics export/import or plugin metadata loading
- [X] T058 Verify implementation and documentation remain within the non-goals for effect-chain editing, note scoring, pitch detection, recording capture, playback transport, stem playback, and plugin scanning in specs/007-audio-monitoring-domain/spec.md and docs/capability-domains.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; documentation inventory and test harness tasks can start immediately.
- **Foundational (Phase 2)**: Depends on Setup for final terminology and blocks all user stories.
- **User Stories (Phase 3+)**: Depend on Foundational completion.
- **Polish (Phase 7)**: Depends on the desired user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Start after Foundational; provides MVP start/stop control, user-action boundary, selected source integration, and lifecycle basics.
- **User Story 2 (P2)**: Start after Foundational and can run after or alongside US1 once provider records exist; final attach/ref-count behavior should be checked against US1 start/stop semantics.
- **User Story 3 (P3)**: Start after Foundational and can run after US1 active-session summaries exist; direct-monitor requirements integrate with US2 requester refs when both are complete.
- **User Story 4 (P4)**: Start after Foundational; best completed after US1-US3 so diagnostics and inspector tests cover providers, sessions, direct-monitor, and requester conflicts.

### Within Each User Story

- Tests first; confirm they fail before implementation.
- Runtime host changes before inspector/docs validation.
- Provider and source summaries before start/stop dispatch.
- Diagnostics redaction before diagnostics export or support-surface validation.
- Story complete before moving to the next priority unless parallel capacity is explicitly available.

---

## Parallel Opportunities

- T001, T002, T003, T004, and T005 can run in parallel.
- US1 has no safe intra-story [P] task because the MVP tests and runtime work converge on tests/js/audio_session_monitoring.test.js and static/capabilities/audio-session.js.
- T024 can run in parallel with T022/T023 during US2 because it touches tests/js/audio_session_compat.test.js instead of tests/js/audio_session_monitoring.test.js.
- US3 has no safe intra-story [P] task because direct-monitor tests and runtime work converge on tests/js/audio_session_monitoring.test.js and static/capabilities/audio-session.js.
- T042 and T043 can run in parallel during US4 because they touch separate test files.
- T050, T051, and T052 can run in parallel during polish because they touch separate docs files.

---

## Parallel Example: User Story 1

```text
No file-safe intra-story parallel task is marked for US1. Run T011-T021 sequentially because the story intentionally keeps MVP tests and runtime behavior concentrated in tests/js/audio_session_monitoring.test.js and static/capabilities/audio-session.js.
```

## Parallel Example: User Story 2

```text
Task: T023 Add shared requester/ref-count tests in tests/js/audio_session_monitoring.test.js
Task: T024 Add bridge-hit diagnostics tests in tests/js/audio_session_compat.test.js
```

## Parallel Example: User Story 3

```text
No file-safe intra-story parallel task is marked for US3. Run T033-T040 sequentially because the direct-monitor story intentionally keeps tests and runtime behavior concentrated in tests/js/audio_session_monitoring.test.js and static/capabilities/audio-session.js.
```

## Parallel Example: User Story 4

```text
Task: T042 Add monitoring diagnostics redaction tests in tests/js/audio_session_host.test.js
Task: T043 Add Capability Inspector monitoring render tests in tests/js/capability_inspector_render.test.js
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 for User Story 1.
3. Stop and validate single-provider start/stop, selected source integration, explicit user-action start, background `user-action-required`, active degraded, song-switch persistence, and reload no-auto-resume behavior.
4. Demo audio-monitoring through capability dispatch and diagnostics before adding multi-provider/requester coordination.

### Incremental Delivery

1. Foundation: shared model, normalization, command registration, redaction helpers, and test harness.
2. MVP: US1 single-provider start/stop, lifecycle, selected source integration, and user-action boundary.
3. Coordination: US2 provider selection, duplicate suppression, shared requesters, final-stop semantics, provider disappearance, and bridge accounting.
4. Direct Monitoring: US3 user/default direct-monitor preference, provider apply/status, and requester conflict behavior.
5. Supportability: US4 status inspection, failure distinctions, diagnostics redaction, and Capability Inspector detail.
6. Polish: docs, changelog, syntax checks, focused JS tests, browser smoke, and optional backend diagnostics validation.

### Parallel Team Strategy

With multiple implementers:

1. Complete Setup and Foundational together.
2. After Foundational, split story work by files where possible:
   - Developer A: US1 runtime and tests in static/capabilities/audio-session.js and tests/js/audio_session_monitoring.test.js
   - Developer B: US2 compatibility tests/docs and runtime bridge/provider-selection work in tests/js/audio_session_compat.test.js and static/capabilities/audio-session.js
   - Developer C: US4 inspector and diagnostics tests in plugins/capability_inspector/screen.js, tests/js/audio_session_host.test.js, and tests/js/capability_inspector_render.test.js
3. Coordinate all edits to static/capabilities/audio-session.js through small reviewed patches because most runtime stories converge there.

### Scope Control

This task list intentionally excludes effect-chain editing, VST/NAM/IR loading, bypass, presets, plugin editor windows, note scoring, pitch detection algorithms, recording capture, take storage, waveform display, stem playback ownership, playback transport ownership, plugin scanning, and raw input source identity ownership except where monitoring consumes safe source references from audio-input.

---

## Notes

- [P] tasks touch different files or clearly separable docs/tests and can run in parallel after their phase dependencies are met.
- [US1], [US2], [US3], and [US4] labels map directly to the user stories in [spec.md](spec.md).
- Every story has focused validation and can be stopped at its checkpoint for independent review.
- Do not commit automatically; use the configured Spec Kit git hook only when the user asks for it.
