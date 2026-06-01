# Tasks: Audio Graph/Session Capability Slice

**Input**: Design documents from `/specs/004-audio-graph-session/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)
**Tests**: Included because the feature specification requires test or review evidence for native paths, compatibility paths, redaction, disabled/missing/incompatible participants, and equivalent user-visible behavior.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently after the shared foundation is complete.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the new source/test entry points and keep the feature aligned with the existing vanilla frontend structure.

- [X] T001 Create the core audio-session capability module scaffold in static/capabilities/audio-session.js
- [X] T002 [P] Register the audio-session script after the existing capability scripts in static/index.html
- [X] T003 [P] Create reusable audio-session JS test helpers in tests/js/audio_session_test_harness.js
- [X] T004 [P] Create the audio-session browser smoke-test scaffold in tests/browser/audio-session.spec.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the core-owned host boundary, active domain registration, diagnostics plumbing, and shared state model required by every user story.

**CRITICAL**: No user story work should begin until this phase is complete.

- [X] T005 Promote `audio-mix`, `audio-input`, `audio-monitoring`, and `stems` from documentation-only reservations to active review metadata in static/capabilities.js
- [X] T006 Implement core audio session lifecycle state for active player/song sessions in static/capabilities/audio-session.js
- [X] T007 Implement bounded audio diagnostics outcome recording in static/capabilities/audio-session.js
- [X] T008 Implement per-bundle source/device pseudonym and redaction helpers in static/capabilities/audio-session.js
- [X] T009 Register core runtime owners/coordinators for `audio-mix`, `audio-input`, `audio-monitoring`, and `stems` in static/capabilities/audio-session.js
- [X] T010 Contribute `slopsmith.audio_session.diagnostics.v1` snapshots through the existing diagnostics namespace in static/capabilities/audio-session.js
- [X] T011 Add foundational tests for session lifecycle, domain registration, disabled/missing/incompatible participants, unsupported-command/incompatible-version outcomes, handler timeout behavior, and diagnostics snapshot shape in tests/js/audio_session_host.test.js

**Checkpoint**: The audio session host is registered, diagnosable, redaction-safe, and ready for story-specific behavior.

---

## Phase 3: User Story 1 - Keep Audio Routing And Mix State Consistent (Priority: P1) MVP

**Goal**: PSARC, sloppak/stem-backed, plugin-assisted, and optional desktop/JUCE song paths respect the same user-visible audio session and mix state or report a clear degraded outcome.

**Independent Test**: Play representative PSARC and stem-backed songs, adjust the Song fader or route state, and verify both paths use the same session state with diagnostics explaining route/fader degradation.

### Tests for User Story 1

- [X] T012 [P] [US1] Add audio-mix command contract tests for inspect/register/unregister behavior in tests/js/audio_session_mix.test.js
- [X] T013 [P] [US1] Add route consistency and non-blocking route/fader reporting tests for HTML5, sloppak/stem, and optional JUCE fader behavior in tests/js/audio_session_routes.test.js

### Implementation for User Story 1

- [X] T014 [US1] Implement Audio Output Route state and transitions in static/capabilities/audio-session.js
- [X] T015 [US1] Implement `audio-mix` inspect/register-participant/unregister-participant command handlers in static/capabilities/audio-session.js
- [X] T016 [US1] Bridge the legacy fader registry into `audio-mix` participant registration in static/audio-mixer.js
- [X] T017 [US1] Report HTML5, sloppak, and optional JUCE route outcomes to the audio session host from static/highway.js
- [X] T018 [US1] Emit `audio-mix` participant, fader, route, degraded, and bridge-hit events in static/capabilities/audio-session.js
- [X] T019 [US1] Keep the legacy mixer UI behavior intact while reporting committed fader values through the audio-session bridge in static/audio-mixer.js
- [X] T020 [US1] Render active `audio-mix` participants, routes, and bridge state in plugins/capability_inspector/screen.js

**Checkpoint**: User Story 1 is independently usable as the MVP audio-session path.

---

## Phase 4: User Story 2 - Coordinate Stem Automation Without Overwriting Manual Choices (Priority: P2)

**Goal**: Monitoring or amp-style plugins request temporary stem changes through recorded capability claims while manual user choices take precedence.

**Independent Test**: Start a requester that mutes or ducks a stem, manually change that stem while automation is active, and verify restore behavior reports `overridden` rather than mutating private state.

### Tests for User Story 2

- [X] T021 [P] [US2] Add stem owner, claim, restore, orphan, and manual override tests in tests/js/audio_session_stems.test.js
- [X] T022 [P] [US2] Add Stems master-volume compatibility bridge hit tests in tests/js/audio_session_stems_bridge.test.js

### Implementation for User Story 2

- [X] T023 [US2] Implement active stem owner registration, availability, and inspect behavior in static/capabilities/audio-session.js
- [X] T024 [US2] Implement mute/restore claim lifecycle with owner-controlled restore snapshots in static/capabilities/audio-session.js
- [X] T025 [US2] Implement manual override recording for matching stem automation targets in static/capabilities/audio-session.js
- [X] T026 [US2] Replace direct Stems master-volume coupling with audio-session bridge calls in static/audio-mixer.js
- [X] T027 [US2] Register existing stem automation requester compatibility metadata for Stems/NAM-style ducking paths in static/capabilities/audio-session.js
- [X] T028 [US2] Emit stems owner, automation-applied, automation-restored, automation-overridden, claim-orphaned, and bridge-hit events in static/capabilities/audio-session.js
- [X] T029 [US2] Render stems owner, active claims, orphaned claims, and override outcomes in plugins/capability_inspector/screen.js

**Checkpoint**: User Story 2 works independently with a stem owner/requester workflow and no native private-state mutation.

---

## Phase 5: User Story 3 - Make Audio Input And Monitoring Diagnosable (Priority: P3)

**Goal**: Input source, permission, channel, and monitoring lifecycle failures are distinct, redaction-safe, and visible to support while preserving per-bundle correlation.

**Independent Test**: Attempt monitoring with an available source, unavailable source, denied permission, and changing source availability, then verify visible and diagnostic outcomes remain distinct and redacted.

### Tests for User Story 3

- [X] T030 [P] [US3] Add audio-input source registration, selection, redaction, and pseudonym tests in tests/js/audio_session_input.test.js
- [X] T031 [P] [US3] Add monitoring lifecycle tests for active, denied, unavailable, stopped, and failed states in tests/js/audio_session_monitoring.test.js
- [X] T032 [P] [US3] Add diagnostics bundle redaction coverage for audio source pseudonyms in tests/test_diagnostics_bundle.py

### Implementation for User Story 3

- [X] T033 [US3] Implement `audio-input` inspect/register-source/unregister-source/select-source command handlers in static/capabilities/audio-session.js
- [X] T034 [US3] Apply per-bundle pseudonym and redaction behavior to exported input-source summaries in static/capabilities/audio-session.js
- [X] T035 [US3] Implement `audio-monitoring` start/stop/inspect lifecycle command handlers in static/capabilities/audio-session.js
- [X] T036 [US3] Bridge `window.slopsmithAudioBarrier` timeout, degraded, and failed outcomes into audio-monitoring diagnostics in static/highway.js
- [X] T037 [US3] Include audio-input sources and audio-monitoring sessions in diagnostics snapshots from static/capabilities/audio-session.js
- [X] T038 [US3] Render `audio-input` and `audio-monitoring` sensitive availability and redaction-safe status in plugins/capability_inspector/screen.js

**Checkpoint**: User Story 3 can diagnose input and monitoring issues without exposing raw device identity.

---

## Phase 6: User Story 4 - Preserve Legacy Audio Behavior During Migration (Priority: P4)

**Goal**: Legacy fader, stem, analyser, input, and monitoring behavior remains user-visible and equivalent while support can see which compatibility bridge was used.

**Independent Test**: Run legacy participants through their existing APIs and verify behavior remains equivalent while diagnostics and the Capability Inspector attribute bridge hits and failures.

### Tests for User Story 4

- [X] T039 [P] [US4] Add compatibility bridge accounting tests for fader, analyser, barrier, and input surfaces in tests/js/audio_session_compat.test.js
- [X] T040 [P] [US4] Add legacy shim diagnostics snapshot tests for active audio domains in tests/js/legacy_shim_hits.test.js
- [X] T041 [P] [US4] Add browser smoke coverage for legacy fader and analyser behavior in tests/browser/audio-session-compat.spec.ts

### Implementation for User Story 4

- [X] T042 [US4] Register compatibility shim metadata for all covered audio bridges in static/capabilities/audio-session.js
- [X] T043 [US4] Attribute legacy fader, stem, analyser, barrier, and input bridge hits to capability diagnostics in static/capabilities/audio-session.js
- [X] T044 [US4] Preserve `window.slopsmith.audio` public API compatibility while attributing legacy fader behavior through `audio-mix` in static/audio-mixer.js
- [X] T045 [US4] Preserve 3D Highway analyser fallback behavior, register analyser bridge sources, and report bridge status in plugins/highway_3d/screen.js
- [X] T046 [US4] Add audio bridge-hit graph links and bridge failure details to plugins/capability_inspector/screen.js

**Checkpoint**: User Story 4 preserves legacy behavior and makes bridge usage visible.

---

## Phase 7: User Story 5 - Stage Audio Deprecation Safely (Priority: P5)

**Goal**: Release maintainers can prove all covered audio legacy surfaces have migration notes, deprecation states, adoption gates, and no net increase in legacy-only integration points.

**Independent Test**: Review docs, migration notes, checklists, and inventory after implementation and confirm each covered surface is added, removed, migrated, contained, or remaining with owner, risk, and follow-up gate.

### Tests and Review Evidence for User Story 5

- [X] T047 [P] [US5] Update active audio domain documentation and new bundled-code rules in docs/capability-domains.md
- [X] T048 [P] [US5] Update audio domain promotion status and future-domain sequencing in docs/capability-roadmap.md
- [X] T049 [P] [US5] Update audio command scope and safety classes in docs/capability-safety-matrix.md
- [X] T050 [P] [US5] Add audio participant/requester manifest examples in docs/capability-recipes.md

### Implementation for User Story 5

- [X] T051 [US5] Update migrated, contained, remaining, and no-net-increase counts in specs/004-audio-graph-session/legacy-inventory.md
- [X] T052 [US5] Add final implementation evidence links to specs/004-audio-graph-session/checklists/domain-migration.md
- [X] T053 [US5] Add changelog migration notes for audio compatibility bridges in CHANGELOG.md

**Checkpoint**: User Story 5 proves deprecation is staged safely and the slice satisfies the 003 migration standard.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, cleanup, and release-readiness checks across all stories.

- [X] T054 [P] Run JS syntax validation for static/capabilities.js, static/capabilities/library.js, static/capabilities/audio-session.js, static/audio-mixer.js, static/highway.js, and plugins/capability_inspector/screen.js
- [X] T055 [P] Run Node tests for tests/js/audio_session_*.test.js and tests/js/legacy_shim_hits.test.js
- [X] T056 [P] Run pytest diagnostics and plugin-runtime tests in tests/test_diagnostics_bundle.py, tests/test_plugin_runtime_idempotence.py, and tests/test_plugins.py
- [X] T057 [P] Run Playwright smoke tests for tests/browser/audio-session.spec.ts and tests/browser/audio-session-compat.spec.ts
- [X] T058 Record validation outcomes, omitted optional checks, and a timed under-5-minute support walkthrough in specs/004-audio-graph-session/quickstart.md
- [X] T059 Final-review all covered legacy surfaces and removal gates in specs/004-audio-graph-session/legacy-inventory.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; can start immediately.
- **Foundational (Phase 2)**: Depends on Setup; blocks every user story.
- **User Story 1 (Phase 3)**: Depends on Foundational and is the MVP.
- **User Story 2 (Phase 4)**: Depends on Foundational; can run in parallel with US1 after the shared host exists, but validates best after US1 route/mix basics are present.
- **User Story 3 (Phase 5)**: Depends on Foundational; can run in parallel with US1/US2 after the host exists.
- **User Story 4 (Phase 6)**: Depends on bridge targets from US1, US2, and US3.
- **User Story 5 (Phase 7)**: Depends on implementation evidence from US1-US4.
- **Polish (Phase 8)**: Depends on all desired user stories.

### User Story Dependencies

- **US1 (P1)**: MVP; no dependency on other user stories after Foundational.
- **US2 (P2)**: Needs Foundational claim/session primitives; independent of US3.
- **US3 (P3)**: Needs Foundational redaction/session primitives; independent of US2.
- **US4 (P4)**: Requires at least one native path and bridge target from US1-US3 to validate compatibility accounting.
- **US5 (P5)**: Requires final bridge and migration evidence from US1-US4.

### Parallel Opportunities

- Setup tasks T002-T004 can run in parallel.
- US1 test tasks T012-T013 can run in parallel.
- US2 test tasks T021-T022 can run in parallel.
- US3 test tasks T030-T032 can run in parallel.
- US4 test tasks T039-T041 can run in parallel.
- US5 documentation tasks T047-T050 can run in parallel.
- Polish validation tasks T054-T057 can run in parallel after implementation.

---

## Parallel Example: User Story 1

```bash
# After Phase 2, these test-writing tasks can proceed together:
Task: "T012 [P] [US1] Add audio-mix command contract tests for inspect/register/unregister behavior in tests/js/audio_session_mix.test.js"
Task: "T013 [P] [US1] Add route consistency tests for HTML5, sloppak/stem, and optional JUCE fader behavior in tests/js/audio_session_routes.test.js"
```

## Parallel Example: User Story 2

```bash
# After Phase 2, these stem validation tasks can proceed together:
Task: "T021 [P] [US2] Add stem owner, claim, restore, orphan, and manual override tests in tests/js/audio_session_stems.test.js"
Task: "T022 [P] [US2] Add Stems master-volume compatibility bridge hit tests in tests/js/audio_session_stems_bridge.test.js"
```

## Parallel Example: User Story 3

```bash
# After Phase 2, these sensitive input/monitoring validation tasks can proceed together:
Task: "T030 [P] [US3] Add audio-input source registration, selection, redaction, and pseudonym tests in tests/js/audio_session_input.test.js"
Task: "T031 [P] [US3] Add monitoring lifecycle tests for active, denied, unavailable, stopped, and failed states in tests/js/audio_session_monitoring.test.js"
Task: "T032 [P] [US3] Add diagnostics bundle redaction coverage for audio source pseudonyms in tests/test_diagnostics_bundle.py"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational audio session host.
3. Complete Phase 3: User Story 1 route and mix consistency.
4. Stop and validate with the Route And Mix Consistency quickstart scenario.
5. Demo if route/fader behavior and diagnostics pass.

### Incremental Delivery

1. Deliver Setup + Foundational host.
2. Deliver US1 as MVP for route and mix consistency.
3. Deliver US2 for stem automation and manual overrides.
4. Deliver US3 for input/monitoring diagnostics and privacy.
5. Deliver US4 for legacy compatibility bridge accounting.
6. Deliver US5 for migration/deprecation evidence and final docs.

### Parallel Team Strategy

With multiple implementers:

1. Work together through Setup and Foundational tasks.
2. Split US1, US2, and US3 after the host boundary exists.
3. Assign US4 to the implementer most familiar with compatibility bridges after native paths land.
4. Assign US5 to the release/docs owner once bridge behavior and diagnostics evidence are available.

---

## Format Validation Summary

- Total tasks: 59
- Setup tasks: 4
- Foundational tasks: 7
- US1 tasks: 9
- US2 tasks: 9
- US3 tasks: 9
- US4 tasks: 8
- US5 tasks: 7
- Polish tasks: 6
- Parallel-marked tasks: 21
- Checklist format: task lines use `- [X] T###` for completed tasks or `- [ ] T###` for pending tasks, optional `[P]`, required `[US#]` for user-story tasks, and exact file paths.
