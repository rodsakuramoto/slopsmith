# Feature Specification: Playback Control Plane

**Feature Branch**: `008-playback`
**Created**: 2026-05-31
**Status**: Draft
**Input**: User description: "Create the spec for the next slice: playback"

## Clarifications

### Session 2026-05-31

- Q: Can plugins start fresh audible playback from idle or stopped state? → A: Fresh playback start requires explicit user action; plugins may inspect/observe and may control an already-active session.
- Q: How should conflicting playback requests be resolved? → A: Explicit user actions take priority; within the same priority, latest non-stale request wins.
- Q: How should active playback handle playback route changes? → A: Route changes preserve the session and current time when possible; unsafe handoff pauses and reports degraded.
- Q: How much playback target identity may diagnostics expose? → A: Exported diagnostics use stable pseudonymous target IDs only; local inspector may show user-visible title, artist, and arrangement.
- Q: How much playback history should diagnostics retain? → A: Diagnostics retain a bounded recent history per playback session, such as recent outcomes and lifecycle summaries.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Control Song Playback Through One Surface (Priority: P1)

A player can start a song, pause, resume, stop, and seek through one shared playback surface, and every plugin or support tool can observe the same authoritative playback state.

**Why this priority**: Playback is the central player workflow. Before plugins can migrate away from wrapper chains, core must expose one reliable control plane for the transport actions users already expect.

**Independent Test**: Can be tested by selecting a playable song, starting playback, pausing, resuming, seeking, stopping, and confirming current transport state and lifecycle events through the playback domain.

**Acceptance Scenarios**:

1. **Given** a playable song and arrangement are selected, **When** the user starts playback, **Then** the playback domain records the active song, arrangement, transport state, media readiness, and safe start outcome.
2. **Given** playback is active, **When** the user pauses and resumes, **Then** the playback domain records the correct paused and playing states without starting a duplicate song session.
3. **Given** playback is active, **When** the user seeks to a valid time, **Then** the playback domain records the requested target, landed time, and seek outcome.
4. **Given** playback is active, **When** the user stops or leaves the player, **Then** the playback domain records the session as stopped and emits a stop lifecycle event.
5. **Given** no playable song is selected, **When** playback is requested, **Then** the result is a safe no-target or unavailable outcome rather than a silent failure.

---

### User Story 2 - Migrate Playback Participants Safely (Priority: P2)

A plugin author can inspect playback, observe playback lifecycle events, and request permitted controls for an already-active playback session through the shared domain while legacy playback wrappers continue to work during migration.

**Why this priority**: Many plugins currently coordinate with playback by wrapping shared song-start and transport surfaces. A domain-level contract prevents wrapper ordering bugs, duplicate playback starts, and unclear ownership.

**Independent Test**: Can be tested by registering representative requesters and observers, running playback actions, and confirming owner attribution, requester attribution, lifecycle events, and compatibility bridge hits remain deterministic.

**Acceptance Scenarios**:

1. **Given** a plugin observes playback lifecycle, **When** a song starts, pauses, seeks, resumes, or ends, **Then** the observer receives ordered redaction-safe events without wrapping core playback behavior.
2. **Given** a plugin requests a permitted playback action for an already-active session, **When** the request is valid, **Then** the playback domain attributes the action to the requester and returns the resulting transport state.
3. **Given** a legacy playback wrapper still runs, **When** it participates in song start or transport behavior, **Then** the behavior remains usable and the legacy path is recorded as a compatibility bridge.
4. **Given** multiple participants observe the same lifecycle event, **When** playback changes state, **Then** event order and state snapshots remain deterministic and no participant starts duplicate playback.
5. **Given** a participant is disabled, unavailable, or incompatible, **When** playback actions occur, **Then** the participant does not block core playback and diagnostics explain the skipped or degraded participation.

---

### User Story 3 - Inspect Media State And Playback Failures (Priority: P3)

A user or maintainer troubleshooting playback can tell whether playback is loading, ready, playing, paused, seeking, ended, stopped, unavailable, denied, degraded, or failed without exposing private song paths or raw media handles.

**Why this priority**: Playback failures can come from missing audio, extraction errors, unsupported formats, browser/native route failures, stale song switches, or plugin wrappers. Clear diagnostics reduce vague playback bug reports.

**Independent Test**: Can be tested by forcing loading, ready, playing, paused, seeking, ended, stopped, unavailable, no-target, unsupported, degraded, and failed outcomes and verifying diagnostics distinguish them safely.

**Acceptance Scenarios**:

1. **Given** a song is loading, **When** playback state is inspected, **Then** the domain reports loading progress and the intended playback target without exposing local paths.
2. **Given** media cannot be loaded, **When** playback start is requested, **Then** the domain reports unavailable or failed with a bounded safe reason.
3. **Given** playback is already changing songs, **When** a stale action completes after a newer action, **Then** the playback domain ignores the stale result and reports the current active session.
4. **Given** diagnostics are exported, **When** playback state is included, **Then** the snapshot contains stable pseudonymous playback target ids, transport state, safe media status, bridge hits, and bounded recent per-session outcomes and lifecycle summaries without raw song metadata, raw media handles, or local file paths.

---

### User Story 4 - Coordinate Loops And Playback Timing (Priority: P4)

A player can set, inspect, and clear loop or focused-practice timing state through the playback domain, and requesters can understand the current media clock consistently during seeks, pauses, and route changes.

**Why this priority**: Looping and seek timing are common practice workflows. They must be coordinated with transport state before higher-level practice, note-detection, or panel features depend on playback timing.

**Independent Test**: Can be tested by setting a loop, seeking inside and outside it, pausing/resuming, clearing the loop, and confirming timing snapshots and loop lifecycle events remain consistent.

**Acceptance Scenarios**:

1. **Given** a song is loaded, **When** the user sets a valid loop region, **Then** the playback domain records the loop start, loop end, current enabled state, and requester attribution.
2. **Given** a loop is active, **When** playback reaches the loop end, **Then** the domain records a loop restart event and keeps the transport state consistent.
3. **Given** a loop is active, **When** the user clears it, **Then** the playback domain reports no active loop and emits a loop-cleared event.
4. **Given** playback is paused, seeking, or route-changing, **When** a requester inspects timing, **Then** the domain reports a stable current time, duration when known, playback rate, and loop state.

### Edge Cases

- Playback is requested before any song or arrangement has been selected.
- A song has metadata but no playable media URL or playable media route.
- A song switch starts while an earlier start, load, seek, or readiness event is still pending.
- A plugin or UI requester asks to pause, resume, stop, or seek while no playback session is active.
- A requester seeks to a negative time, beyond duration, or to a non-finite target.
- A playback route clamps, rejects, or rolls back a seek target.
- Playback reaches the end of a song while loop state is active or while a seek is pending.
- A loop region is invalid because the end is not after the start, either boundary is outside the playable duration, or the target song changes.
- The app changes playback route while playback is active.
- A playback route changes while the current time can or cannot be safely carried forward.
- Playback is paused by the user while an automation requester expects playback to continue.
- Multiple requesters issue transport actions in quick succession.
- A user action conflicts with a plugin or automation playback request.
- A plugin rehydrates repeatedly and tries to register the same playback observer or legacy wrapper more than once.
- A participant observes playback events but becomes disabled or unavailable mid-session.
- Browser or native media reports a time that differs from the chart/player time.
- Diagnostics are requested before any playback session has started.
- Playback outcomes include local paths, raw filenames, media handles, route-private objects, or secret-bearing reason text.
- Legacy song-start or transport wrappers run during the migration window.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide an authoritative playback control plane for starting, pausing, resuming, stopping, seeking, inspecting, and reporting playback state.
- **FR-002**: System MUST represent the active playback session with a safe session id, playback target, arrangement reference, transport state, readiness state, timing summary, route summary, and bounded safe reason when unavailable, degraded, or failed.
- **FR-003**: System MUST expose explicit playback outcomes including handled, denied, degraded, failed, no-owner, no-handler, no-target, unsupported-command, incompatible-version, unavailable, stale, cancelled, and stopped.
- **FR-004**: System MUST allow requesters and support tooling to inspect current playback state without reading private player globals, raw media handles, or route-private objects.
- **FR-005**: System MUST emit observable lifecycle events when playback is requested, loading, ready, started, paused, resumed, seeking, seeked, ended, stopped, unavailable, degraded, failed, or superseded by a newer playback target.
- **FR-006**: System MUST attribute playback actions to a requester where known, including user actions, core controls, bundled plugins, and compatibility-backed legacy paths.
- **FR-006a**: System MUST require explicit user action before fresh audible playback starts from idle, stopped, or no-session state; plugin requesters MAY inspect playback, observe playback, and request permitted controls for an already-active playback session.
- **FR-007**: System MUST preserve current user-facing playback behavior during migration while recording compatibility bridge hits for legacy song-start, transport, seek, loop, or media-snapshot surfaces that still run.
- **FR-008**: System MUST make repeated participant hydration idempotent so the same playback observer, requester, or compatibility-backed participant appears once with updated status and last-seen metadata.
- **FR-009**: System MUST prevent duplicate song starts caused by multiple requesters, legacy wrappers, or stale asynchronous completions for the same playback target.
- **FR-009a**: System MUST resolve conflicting playback requests by prioritizing explicit user actions over plugin or automation requests; within the same priority level, the latest non-stale request wins.
- **FR-010**: System MUST ignore or safely report stale playback actions whose target no longer matches the current active playback session.
- **FR-011**: System MUST distinguish no selected playback target, unavailable media, failed media load, denied action, unsupported command, incompatible participant version, route degradation, and stopped state.
- **FR-012**: System MUST keep playback transport ownership separate from audio-input, audio-monitoring, audio-effects, stems, note-detection, visualization, and UI placement domains.
- **FR-013**: System MUST provide a redaction-safe media snapshot that includes current transport state, intended playback target, duration when known, current time, playback rate, readiness state, loop state, and safe route summary.
- **FR-014**: System MUST NOT expose raw audio/video elements, media handles, local file paths, raw song filenames, plugin-private route objects, audio buffers, samples, waveform data, or recording contents through playback state or diagnostics.
- **FR-015**: System MUST use stable pseudonymous playback target ids in exported diagnostics and MUST redact song titles, artists, arrangements, DLC paths, local filenames, URLs with secrets, and platform route identifiers from exported diagnostics; local inspector views MAY show user-visible title, artist, and arrangement already visible in the app.
- **FR-016**: System MUST coordinate seek requests so each seek outcome reports requested time, landed time when known, requester attribution, and whether the seek was completed, clamped, cancelled, rolled back, stale, or failed.
- **FR-017**: System MUST ensure pause, resume, stop, and seek requests against inactive playback produce explicit safe outcomes rather than ambiguous state changes.
- **FR-018**: System MUST support loop inspection, loop set, and loop clear as playback-domain state without requiring requesters to read private player timing state.
- **FR-019**: System MUST validate loop regions and reject or safely report invalid loop boundaries without mutating the current loop state.
- **FR-020**: System MUST emit loop lifecycle events when a loop is set, cleared, restarted, rejected, or made stale by a playback target change.
- **FR-021**: System MUST keep timing snapshots stable during pause, seek, route change, and media stall states so requesters can distinguish chart time, media time, and known uncertainty where applicable.
- **FR-022**: System MUST include playback participants, active session state, loop state, bridge hits, recent outcomes, and lifecycle event summaries in diagnostics.
- **FR-022a**: System MUST retain a bounded recent diagnostic history per playback session, including recent outcomes and lifecycle summaries, and MUST NOT retain unbounded full-session playback history.
- **FR-023**: System MUST provide enough safe metadata for support tooling to distinguish core controls, plugin requesters, plugin observers, browser media route, native/desktop media route, and compatibility-backed playback paths.
- **FR-024**: System MUST handle playback route degradation without silently transferring ownership to audio-mix, audio-input, audio-monitoring, stems, or audio-effects domains.
- **FR-024a**: System MUST preserve the active playback session and current time during playback route changes when safe; if a safe handoff is not possible, the system MUST pause playback and report degraded with a bounded safe reason.
- **FR-025**: System MUST document the migration path for playback requesters and observers, including start/stop/seek/loop behavior, media snapshot access, lifecycle events, legacy bridge behavior, and removal gates.
- **FR-026**: System MUST leave note scoring, pitch detection, effect-chain editing, recording capture, input source selection, live monitoring, stem playback state, plugin scanning, and UI contribution placement outside this feature except for playback state they consume or observe.
- **FR-027**: System MUST allow playback status inspection before any song has been played and report an idle/no-session state without errors.
- **FR-028**: System MUST make playback state changes observable within 1 second for normal play, pause, resume, stop, seek, loop set, and loop clear actions in focused validation scenarios.
- **FR-029**: System MUST report ended state separately from stopped state so requesters can distinguish natural song completion from user stop.
- **FR-030**: System MUST avoid creating new legacy-only playback integration points once the native playback domain exists.

### Key Entities

- **Playback Session**: The coordinator-owned record for the current or most recent song playback lifecycle, including target, state, timing, route summary, outcomes, and no raw media handles.
- **Playback Target**: A redaction-safe reference to the song, arrangement, source format, and requested start context that playback should load or control.
- **Playback Requester**: A user action, core control, plugin, or compatibility-backed path that asks to inspect playback or perform a permitted playback action; fresh audible starts are limited to explicit user action.
- **Playback Observer**: A participant that watches playback lifecycle events without owning transport state.
- **Transport State**: The current user-visible state such as idle, loading, ready, playing, paused, seeking, ended, stopped, unavailable, degraded, or failed.
- **Media Snapshot**: A redaction-safe summary of current media readiness, current time, duration, playback rate, route status, loop state, and bounded reason fields.
- **Seek Request**: A transport action with requester attribution, requested time, landed time when known, completion status, and safe reason for clamping, cancellation, rollback, staleness, or failure.
- **Loop Region**: A playback-domain timing constraint with start time, end time, enabled state, requester attribution, and lifecycle state.
- **Playback Outcome**: A bounded diagnostic record describing a playback operation, requester, target, outcome, status, and safe reason.
- **Playback Diagnostic History**: A bounded recent per-session collection of playback outcomes and lifecycle summaries used for support without retaining full unbounded app-session history.
- **Compatibility Bridge Hit**: A record that a legacy playback wrapper, transport helper, seek helper, loop helper, or media snapshot path was used during migration.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of focused start, pause, resume, stop, seek, ended, loop set, and loop clear scenarios produce distinct playback state changes and observable lifecycle events.
- **SC-002**: 100% of no-target, unavailable media, failed media load, stale action, unsupported-command, incompatible-version, denied, degraded, and stopped scenarios produce distinct safe outcomes in focused validation scenarios.
- **SC-003**: 100% of exported playback diagnostics snapshots contain stable pseudonymous playback target ids and zero raw song titles, artists, arrangements, media handles, local paths, raw filenames, secret-bearing URLs, audio buffers, sample data, waveform data, recordings, or route-private objects.
- **SC-004**: A requester can determine current playback target, transport state, readiness state, current time, duration when known, playback rate, route summary, and loop state in one inspection step in 100% of tested cases.
- **SC-005**: Two rapid start requests for different playback targets leave exactly one active playback session, and stale completion from the older target does not overwrite the current state in 100% of focused validation scenarios.
- **SC-005a**: When explicit user actions conflict with plugin or automation playback requests, the user action determines the final transport state in 100% of focused conflict validation scenarios.
- **SC-006**: Seeking reports requested and landed time, including clamped, cancelled, stale, rollback, and failed outcomes, in 100% of focused seek validation scenarios.
- **SC-007**: Rehydrating the same playback participant five times in one session creates one participant record, with no duplicate observers or compatibility bridge entries visible to users.
- **SC-008**: Native playback-domain participation and compatibility-backed playback wrappers never create duplicate user-visible transport actions in representative migration scenarios.
- **SC-009**: Support maintainers can identify pseudonymous playback target, route status, lifecycle phase, loop state, compatibility bridge involvement, and failure outcome for a representative playback issue in under 5 minutes using exported diagnostics or the local inspector.
- **SC-009a**: Exported diagnostics include bounded recent per-session playback outcomes and lifecycle summaries, and exclude unbounded full app-session playback history, in 100% of focused diagnostics validation scenarios.
- **SC-010**: Normal play, pause, resume, stop, seek, loop set, and loop clear state changes are reflected in playback inspection and diagnostics within 1 second in focused validation scenarios.
- **SC-010a**: Active playback route changes either preserve session identity and current time or pause with a degraded outcome in 100% of focused route-change validation scenarios.
- **SC-011**: Playback lifecycle observers receive ordered events for start/loading/ready/play/pause/seek/end/stop in 100% of focused observer validation scenarios.
- **SC-012**: The playback slice introduces no new ownership of input source selection, live monitoring, effect-chain editing, note scoring, recording capture, stem playback state, plugin scanning, or UI contribution placement in review validation.

## Assumptions

- The capability runtime and Capability Inspector are available as foundation work for this feature.
- Slopsmith remains a self-hosted, single-user app with one primary user-visible playback session at a time.
- Playback is a safe domain because it controls already-selected media transport, but diagnostics can still reveal private song paths or local filenames if not redacted.
- Existing core controls, bundled plugins, and external plugins may still rely on legacy song-start or transport wrappers during migration.
- The playback domain owns transport lifecycle and timing summaries, while audio-mix owns faders/routes/analyser summaries, audio-input owns source selection, audio-monitoring owns live monitoring, stems owns stem playback state, visualization owns rendering, and future audio-effects owns effect-chain state.
- Playback route details may come from browser media or desktop/native media paths, but the playback domain exposes only route summaries and transport outcomes.
- Loop state is treated as playback timing state, not a practice-session or note-detection feature.
- Exported diagnostics represent song metadata with stable pseudonymous playback target ids rather than titles, artists, arrangements, raw filenames, or local paths.
- This feature focuses on playback control, lifecycle observation, timing/loop state, compatibility attribution, diagnostics, and safe state inspection.
