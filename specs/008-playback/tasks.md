# Tasks: Playback Control Plane

**Input**: Design documents from `/specs/008-playback/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md
**Tests**: Included because `contracts/testing-contract.md` and `quickstart.md` define required focused validation suites for this slice.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing. Each task follows `- [X] T### [P?] [US?] Description with file path`.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the playback-domain files and wire script loading without changing behavior yet.

- [X] T001 Create playback capability host skeleton in static/capabilities/playback.js
- [X] T002 Add playback capability script loading after static/capabilities.js in static/index.html
- [X] T003 Register playback as an active core domain review entry in static/capabilities.js
- [X] T004 [P] Add playback-focused test harness loader in tests/js/playback_test_harness.js
- [X] T005 [P] Add playback planning status entry in docs/capability-roadmap.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the shared domain owner, redaction helpers, app adapter boundary, and inspector placeholder required by all stories.

**CRITICAL**: No user story work can begin until this phase is complete.

- [X] T006 Implement playback owner registration and command dispatch skeleton in static/capabilities/playback.js
- [X] T007 Implement safe id, bounded reason, pseudonymization, and bounded history helpers in static/capabilities/playback.js
- [X] T008 Implement playback session, target, requester, observer, route, loop, and outcome normalization helpers in static/capabilities/playback.js
- [X] T009 Expose a redaction-safe playback transport adapter registration point from static/capabilities/playback.js
- [X] T010 Wire static/app.js to register playback transport callbacks without exposing audio or jucePlayer handles
- [X] T011 Emit playback diagnostics contributions through window.slopsmith.diagnostics in static/capabilities/playback.js
- [X] T012 Add collapsed playback domain placeholder rendering in plugins/capability_inspector/screen.js
- [X] T013 [P] Document playback domain boundaries in docs/capability-domains.md
- [X] T014 [P] Document playback safety outcomes in docs/capability-safety-matrix.md

**Checkpoint**: Playback domain owner loads, dispatches `inspect`, exposes safe empty diagnostics, and app transport registration is present without altering player behavior.

---

## Phase 3: User Story 1 - Control Song Playback Through One Surface (Priority: P1) MVP

**Goal**: A player can start, pause, resume, stop, seek, and inspect playback state through one authoritative playback domain.

**Independent Test**: Select a playable song, start playback, pause, resume, seek, stop, and confirm state and lifecycle events through `playback.inspect` and playback events.

### Tests for User Story 1

- [X] T015 [US1] Add idle inspect no-target no-owner no-handler and unsupported-command tests in tests/js/playback_domain.test.js
- [X] T016 [US1] Add user-authorized start lifecycle and ordered observer event delivery tests in tests/js/playback_domain.test.js
- [X] T017 [US1] Add pause resume stop ended denied and stopped state tests in tests/js/playback_domain.test.js
- [X] T018 [US1] Add seek requested landed clamped cancelled rolled-back stale failed and 1-second propagation tests in tests/js/playback_domain.test.js
- [X] T019 [US1] Add playback adapter fixture support in tests/js/playback_test_harness.js

### Implementation for User Story 1

- [X] T020 [US1] Implement playback.inspect idle and active session snapshots in static/capabilities/playback.js
- [X] T021 [US1] Implement playback.start user-action authorization and no-target outcomes in static/capabilities/playback.js
- [X] T022 [US1] Route UI-started playSong lifecycle into playback.start state updates in static/app.js
- [X] T023 [US1] Implement playback.pause playback.resume and playback.stop command handlers in static/capabilities/playback.js
- [X] T024 [US1] Route togglePlay and player teardown pause resume stop outcomes into playback state in static/app.js
- [X] T025 [US1] Implement playback.seek command normalization and landed-time reporting in static/capabilities/playback.js
- [X] T026 [US1] Route _audioSeek results and song:seek lifecycle into playback state in static/app.js
- [X] T027 [US1] Emit playback requested loading ready started paused resumed seeking seeked ended stopped unavailable degraded failed superseded route-changing route-changed and bridge-hit events in static/capabilities/playback.js
- [X] T028 [US1] Keep existing song lifecycle events backward-compatible while mirroring playback events in static/app.js
- [X] T029 [US1] Update playback command and event documentation in docs/capability-domains.md

**Checkpoint**: User Story 1 is fully functional and testable independently as the MVP.

---

## Phase 4: User Story 2 - Migrate Playback Participants Safely (Priority: P2)

**Goal**: Plugin authors can inspect, observe, and request permitted active-session controls through playback while legacy wrappers continue to work and are diagnosed.

**Independent Test**: Register representative requesters/observers, run playback actions, and confirm deterministic attribution, event order, bridge hits, user-action boundary, and no duplicate starts.

### Tests for User Story 2

- [X] T030 [US2] Add requester observer idempotent registration and ordered lifecycle delivery tests in tests/js/playback_compat.test.js
- [X] T031 [US2] Add plugin fresh-start user-action-required and incompatible-version tests in tests/js/playback_compat.test.js
- [X] T032 [US2] Add user-priority conflict same-priority latest non-stale and denied outcome tests in tests/js/playback_compat.test.js
- [X] T033 [US2] Add legacy playSong song-event transport-helper and bridge-hit event tests in tests/js/playback_compat.test.js

### Implementation for User Story 2

- [X] T034 [US2] Implement requester and observer registration merge semantics in static/capabilities/playback.js
- [X] T035 [US2] Implement explicit user-action priority and same-priority latest non-stale conflict policy in static/capabilities/playback.js
- [X] T036 [US2] Enforce plugin background fresh-start denial in static/capabilities/playback.js
- [X] T037 [US2] Record compatibility bridge hits for window.playSong and legacy song events in static/app.js
- [X] T038 [US2] Record compatibility bridge hits for window.slopsmith.seek setLoop clearLoop getLoop helpers in static/app.js
- [X] T039 [US2] Record compatibility bridge hits for audio element and native route shims in static/app.js
- [X] T040 [US2] Prevent native playback-domain commands and legacy wrapper paths from creating duplicate visible transport actions in static/capabilities/playback.js
- [X] T041 [US2] Render playback requesters observers and bridge hits in plugins/capability_inspector/screen.js
- [X] T042 [US2] Add playback requester observer migration recipes in docs/capability-recipes.md
- [X] T043 [US2] Add playback bridge removal gates in docs/capability-roadmap.md

**Checkpoint**: User Story 2 works independently with migration diagnostics and no duplicate starts.

---

## Phase 5: User Story 3 - Inspect Media State And Playback Failures (Priority: P3)

**Goal**: Users and maintainers can inspect playback states, media failures, route status, bridge involvement, and recent outcomes without leaking private media identity.

**Independent Test**: Force loading, ready, playing, paused, seeking, ended, stopped, unavailable, no-target, unsupported, degraded, stale, and failed outcomes and verify diagnostics distinguish them safely.

### Tests for User Story 3

- [X] T044 [US3] Add exported diagnostics redaction tests in tests/js/playback_diagnostics.test.js
- [X] T045 [US3] Add bounded history trimming tests for 50 current-session outcomes/events, 5 stopped sessions, 20 stopped-session outcomes/events, and snapshot-budget trimming in tests/js/playback_diagnostics.test.js
- [X] T046 [US3] Add no-owner no-handler unsupported-command incompatible-version denied unavailable failed stale degraded stopped and cancelled outcome diagnostics tests in tests/js/playback_diagnostics.test.js
- [X] T047 [US3] Add local inspector metadata versus exported pseudonym tests in tests/js/playback_diagnostics.test.js
- [X] T048 [P] [US3] Add playback inspector rendering tests in tests/js/capability_inspector_render.test.js

### Implementation for User Story 3

- [X] T049 [US3] Implement exported diagnostics schema slopsmith.playback.diagnostics.v1 in static/capabilities/playback.js
- [X] T050 [US3] Implement exported pseudonymous target and route summaries in static/capabilities/playback.js
- [X] T051 [US3] Implement local-inspector display metadata mode without exporting raw song identity in static/capabilities/playback.js
- [X] T052 [US3] Implement bounded recent per-session outcomes and lifecycle summaries with 50 current-session outcomes/events, 5 stopped sessions, 20 stopped-session outcomes/events, and snapshot-budget trimming in static/capabilities/playback.js
- [X] T053 [US3] Normalize no-owner no-handler unsupported-command incompatible-version denied unavailable failed degraded stale cancelled stopped and ended diagnostics in static/capabilities/playback.js
- [X] T054 [US3] Render playback session route media loop recent outcomes and failures in plugins/capability_inspector/screen.js
- [X] T055 [US3] Include playback diagnostics schema guidance in docs/capability-domains.md
- [X] T056 [US3] Add diagnostics privacy notes for playback in docs/capability-safety-matrix.md

**Checkpoint**: User Story 3 works independently through diagnostics and inspector support views.

---

## Phase 6: User Story 4 - Coordinate Loops And Playback Timing (Priority: P4)

**Goal**: Playback exposes loop and timing state consistently across seeks, pauses, route changes, and loop restarts.

**Independent Test**: Set a loop, seek inside/outside it, pause/resume, clear it, trigger loop restart, route-change timing snapshots, and confirm loop/timing lifecycle events remain consistent.

### Tests for User Story 4

- [X] T057 [US4] Extend loop set clear inspect command tests in tests/js/playback_domain.test.js
- [X] T058 [P] [US4] Extend loop validation and off-target landing tests in tests/js/loop_api.test.js
- [X] T059 [P] [US4] Extend loop restart lifecycle and stale target tests in tests/js/loop_restart.test.js
- [X] T060 [US4] Add route-change timing preservation degraded fallback and 1-second propagation tests in tests/js/playback_domain.test.js
- [X] T061 [P] [US4] Extend seek stale route-changing timing tests in tests/js/song_seek.test.js

### Implementation for User Story 4

- [X] T062 [US4] Implement playback set-loop clear-loop and inspect loop command handlers in static/capabilities/playback.js
- [X] T063 [US4] Route setLoop clearLoop and loop restart set cleared rejected and stale lifecycle events into playback state in static/app.js
- [X] T064 [US4] Report loop rejected stale and cleared outcomes without mutating invalid loop state in static/capabilities/playback.js
- [X] T065 [US4] Include chartTime mediaTime playbackRate duration and timeUncertainty in playback media snapshots in static/capabilities/playback.js
- [X] T066 [US4] Route HTML5 to JUCE and JUCE to HTML5 handoff outcomes into playback route summaries in static/app.js
- [X] T067 [US4] Pause and report degraded playback route state on unsafe route handoff in static/app.js
- [X] T068 [US4] Render playback loop and route-changing timing details in plugins/capability_inspector/screen.js
- [X] T069 [US4] Document loop and route-change playback semantics in docs/capability-domains.md

**Checkpoint**: User Story 4 works independently for loop and timing workflows.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final documentation, validation, and cleanup across all playback stories.

- [X] T070 [P] Update playback implementation notes in specs/008-playback/quickstart.md
- [X] T071 [P] Update playback migration summary in specs/008-playback/contracts/migration-notes.md
- [X] T072 [P] Update CHANGELOG.md with playback control plane entry
- [X] T073 Run syntax validation commands from specs/008-playback/quickstart.md
- [X] T074 Run focused Node playback validation commands from specs/008-playback/quickstart.md
- [X] T075 Run npm run test:js validation from package.json
- [X] T076 Run pytest diagnostics regression if diagnostics export/import changed using specs/008-playback/quickstart.md
- [X] T077 Run Playwright browser smoke using tests/browser/check-errors.spec.ts
- [X] T078 Review exported playback diagnostics against specs/008-playback/contracts/diagnostics-schema.md
- [X] T079 Review capability ownership boundaries against specs/008-playback/plan.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: No dependencies; can start immediately.
- **Phase 2 Foundational**: Depends on Phase 1; blocks all user stories.
- **Phase 3 US1**: Depends on Phase 2; MVP and base playback surface.
- **Phase 4 US2**: Depends on Phase 2 and can start after US1 command/event shape is stable; migration should not break US1.
- **Phase 5 US3**: Depends on Phase 2 and can start once US1 state snapshots exist; diagnostics can broaden as US2/US4 add bridge and loop data.
- **Phase 6 US4**: Depends on Phase 2 and US1 seek/session shape; loop/timing can be implemented after MVP playback commands.
- **Phase 7 Polish**: Depends on selected user stories being complete.

### User Story Dependencies

- **US1 (P1)**: No story dependencies after foundation; required MVP.
- **US2 (P2)**: Uses US1 command/event/session primitives but remains independently testable through compatibility and requester/observer fixtures.
- **US3 (P3)**: Uses US1 snapshots and can independently validate diagnostics; bridge fields integrate with US2 when present.
- **US4 (P4)**: Uses US1 seek/session primitives and existing loop helpers; independently validates loop/timing behavior.

### Within Each User Story

- Test tasks should be written before implementation tasks for the story.
- Domain owner behavior in static/capabilities/playback.js should precede static/app.js adapter calls for that behavior.
- static/app.js adapter wiring should precede inspector rendering that depends on live state.
- Documentation tasks can run after the relevant behavior is implemented.

### Parallel Opportunities

- T004 and T005 can run in parallel with T001-T003.
- T013 and T014 can run in parallel after domain boundaries are known.
- Test tasks marked [P] can be authored in parallel when they touch different files.
- US2 bridge tests, US3 diagnostics tests, and US4 loop tests can be authored in parallel after Phase 2.
- Documentation updates in docs/ and specs/ can run in parallel with final validation once implementation semantics are stable.

---

## Parallel Example: Setup And Foundation

```bash
Task: "T004 [P] Add playback-focused test harness loader in tests/js/playback_test_harness.js"
Task: "T005 [P] Add playback planning status entry in docs/capability-roadmap.md"
Task: "T013 [P] Document playback domain boundaries in docs/capability-domains.md"
Task: "T014 [P] Document playback safety outcomes in docs/capability-safety-matrix.md"
```

---

## Parallel Example: Cross-File Story Tests

```bash
Task: "T048 [P] [US3] Add playback inspector rendering tests in tests/js/capability_inspector_render.test.js"
Task: "T058 [P] [US4] Extend loop validation and off-target landing tests in tests/js/loop_api.test.js"
Task: "T059 [P] [US4] Extend loop restart lifecycle and stale target tests in tests/js/loop_restart.test.js"
Task: "T061 [P] [US4] Extend seek stale route-changing timing tests in tests/js/song_seek.test.js"
```

---

## Parallel Example: Polish Documentation

```bash
Task: "T070 [P] Update playback implementation notes in specs/008-playback/quickstart.md"
Task: "T071 [P] Update playback migration summary in specs/008-playback/contracts/migration-notes.md"
Task: "T072 [P] Update CHANGELOG.md with playback control plane entry"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 setup.
2. Complete Phase 2 foundation.
3. Complete Phase 3 User Story 1.
4. Stop and validate `playback.inspect`, user-authorized start, pause, resume, stop, seek, ended state, and lifecycle events.
5. Demo the MVP without migrating external plugins yet.

### Incremental Delivery

1. Setup + foundation establishes the `playback` domain and app adapter.
2. US1 delivers the core player control plane.
3. US2 migrates requesters/observers and legacy bridge accounting.
4. US3 makes diagnostics and inspector support complete.
5. US4 coordinates loop/timing/route edge cases.
6. Polish runs the full quickstart validation.

### Parallel Team Strategy

1. One developer owns static/capabilities/playback.js foundation.
2. One developer owns static/app.js adapter wiring.
3. One developer owns test harness and focused tests.
4. One developer owns inspector and docs.
5. Merge in story order to keep MVP behavior stable.

---

## Notes

- [P] tasks touch different files or independent test sections and can run in parallel.
- [US1]-[US4] labels map directly to user stories in specs/008-playback/spec.md.
- Existing legacy playback surfaces stay available until migration gates pass.
- Do not add new legacy-only playback integration points.
- Do not expose raw media handles, paths, filenames, secret URLs, route-private objects, buffers, samples, waveforms, or recordings in playback state or diagnostics.
