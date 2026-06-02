# Feature Specification: Audio Monitoring Control Plane

**Feature Branch**: `007-audio-monitoring-domain`
**Created**: 2026-05-30
**Status**: Draft
**Input**: User description: "Let's move on to the audio-monitoring domain"

## Clarifications

### Session 2026-05-30

- Q: How should audio-monitoring choose a provider when multiple compatible monitoring providers are registered? → A: Use a user-selected/default monitoring provider; if multiple providers exist and none is selected, return a provider-selection-required outcome.
- Q: What should happen to active monitoring across song switches, playback stops, and app reloads? → A: Keep active monitoring through song switches and playback stop; after app reload, restore provider/source preference but require an explicit start before live audio resumes.
- Q: How should direct-monitor mute conflicts be resolved when requesters have different preferences? → A: User/default direct-monitor setting wins; requesters may declare a required state and get degraded/unsupported if it cannot be satisfied.
- Q: When should degraded monitoring block start versus allow an active degraded session? → A: Start succeeds as degraded for non-blocking issues like high latency or unsupported direct-monitor control; missing input/no usable output fails.
- Q: When may plugins or requesters start live monitoring without direct user action? → A: Fresh monitoring start requires explicit user action; non-user requesters may inspect or attach to an already active compatible session, otherwise receive user-action-required.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Start And Stop Live Monitoring (Priority: P1)

A player can start and stop live instrument monitoring through one shared monitoring surface, with clear status about whether monitoring is active, stopped, unavailable, denied, degraded, or failed.

**Why this priority**: Audio-monitoring is only useful if the user can reliably control whether live input is being heard and can understand the current monitoring state without depending on a plugin-specific screen.

**Independent Test**: Can be tested by registering a monitoring provider, selecting an available input source, starting monitoring, stopping monitoring, and confirming the monitoring state and events are visible through the domain.

**Acceptance Scenarios**:

1. **Given** an available monitoring provider and selected input source, **When** the user starts live monitoring, **Then** the monitoring domain records an active monitoring session with provider attribution, requester attribution, source reference, and safe status.
2. **Given** monitoring is active, **When** the user stops live monitoring, **Then** the monitoring domain records the session as stopped and the provider receives a stop request.
3. **Given** no monitoring provider is available, **When** monitoring is started, **Then** the result clearly reports no-owner or unavailable without changing source selection.
4. **Given** monitoring is active, **When** the user switches songs or stops playback, **Then** monitoring remains active unless the user or final requester explicitly stops it.
5. **Given** the app reloads after monitoring was active, **When** the same provider and source are available again, **Then** the provider/source preference is restored but live monitoring remains stopped until the user explicitly starts it.
6. **Given** monitoring can start but reports high latency or unsupported direct-monitor control, **When** the user starts monitoring, **Then** the domain records an active degraded session rather than a failed start.
7. **Given** monitoring is not already active, **When** a plugin or non-user requester asks to start monitoring without explicit user action, **Then** the domain returns user-action-required and does not start live audio.

---

### User Story 2 - Coordinate Monitoring Across Providers And Requesters (Priority: P2)

A plugin author can provide or request monitoring through a shared contract so desktop/native monitoring, browser monitoring, and plugin-hosted monitoring can coexist during migration.

**Why this priority**: Current monitoring behavior can be owned by desktop audio, browser audio graphs, NAM-style amp paths, or other plugins. A shared domain prevents duplicate starts, conflicting stops, and unclear ownership.

**Independent Test**: Can be tested by registering multiple monitoring participants, starting monitoring from different requesters, and confirming that provider ownership, requester references, and lifecycle outcomes remain deterministic.

**Acceptance Scenarios**:

1. **Given** a monitoring provider registers its capabilities, **When** diagnostics are inspected, **Then** the provider appears with supported operations, availability, and safe status metadata.
2. **Given** two compatible requesters need the same monitoring provider, **When** both request monitoring, **Then** the domain records requester references and does not create duplicate provider sessions.
3. **Given** a requester releases monitoring while another requester still needs it, **When** the first requester stops, **Then** provider monitoring remains active until the final requester releases it.
4. **Given** multiple compatible monitoring providers are available and no default provider is selected, **When** monitoring is started without an explicit provider choice, **Then** the domain returns provider-selection-required instead of choosing arbitrarily.
5. **Given** monitoring is already active, **When** a compatible plugin requester asks to monitor the same provider and source, **Then** the requester may attach to the existing session without creating a new live start prompt.

---

### User Story 3 - Control Direct Monitoring Behavior (Priority: P3)

A player can choose whether dry input is heard directly or only after the configured monitoring/effects path, and support tooling can explain that choice without exposing device identity.

**Why this priority**: Direct monitoring affects what the player hears immediately. If the dry path is accidentally audible or muted, the experience feels broken even when the input device and effect chain are working.

**Independent Test**: Can be tested by toggling direct monitoring mute while monitoring is active and confirming the setting is reflected in monitoring status and persists with the current monitoring configuration.

**Acceptance Scenarios**:

1. **Given** monitoring is active, **When** the user mutes direct monitoring, **Then** the domain reports direct monitoring as muted and the provider applies the setting if supported.
2. **Given** a provider cannot control direct monitoring, **When** the user attempts to change it, **Then** the domain returns an unsupported or degraded outcome with a safe reason.
3. **Given** support diagnostics are exported, **When** direct monitoring state is included, **Then** the snapshot reports muted, unmuted, unavailable, or unsupported without raw device labels or audio data.
4. **Given** a requester requires a direct-monitor state that conflicts with the user/default setting, **When** monitoring is started or inspected, **Then** the user/default setting remains in effect and the requester receives degraded or unsupported status.

---

### User Story 4 - Explain Monitoring Failures Safely (Priority: P4)

A user or maintainer troubleshooting monitoring can tell whether the failure came from input permission, missing input selection, device unavailability, provider failure, unsupported provider operation, incompatible channel requirements, or a stopped provider.

**Why this priority**: Monitoring touches sensitive live input and native/browser audio paths. Clear safe outcomes reduce vague "I cannot hear my guitar" reports while protecting private hardware and environment details.

**Independent Test**: Can be tested by forcing denied, unavailable, failed, no-owner, no-handler, unsupported-command, incompatible, incompatible-version, degraded, and stopped outcomes and verifying diagnostics distinguish them.

**Acceptance Scenarios**:

1. **Given** input permission is denied during monitoring start, **When** monitoring state is inspected, **Then** the outcome is permission denied and the reason is redaction-safe.
2. **Given** the selected input source is unavailable, **When** a requester starts monitoring, **Then** the result identifies input unavailable rather than reporting a generic monitoring failure.
3. **Given** there is no usable output path or no usable input source, **When** monitoring start is requested, **Then** the result is failed or unavailable rather than active degraded.
4. **Given** a provider throws, times out, or returns malformed status, **When** diagnostics are inspected, **Then** the provider, operation, outcome, and bounded safe reason are visible without raw audio, device labels, stable hardware identifiers, or local paths.

### Edge Cases

- Monitoring is started before any input source has been selected.
- Monitoring is started while the selected input source is denied, unavailable, degraded, or incompatible with the requested channel shape.
- Multiple compatible monitoring providers are registered but no user-selected or default provider exists.
- A plugin or background requester attempts a fresh monitoring start without explicit user action.
- A plugin or background requester attaches to an already active compatible monitoring session.
- A provider supports status inspection but not start or stop operations.
- A provider starts monitoring successfully but reports degraded latency, missing direct-monitor control, or partial routing.
- A provider reports high latency, unsupported direct-monitor control, or partial non-blocking routing while input and output are usable.
- A provider has no usable input source or no usable output path.
- Multiple requesters start monitoring through the same provider, then stop in different orders.
- A provider disappears, is disabled, or rehydrates while monitoring is active.
- A plugin rehydrates repeatedly and attempts to register the same monitoring participant more than once.
- The app switches songs or stops playback while monitoring is active.
- The app reloads after monitoring was active and the same provider/source returns.
- Monitoring status is requested before any provider has hydrated.
- A provider reports sensitive device names, stable hardware identifiers, local paths, raw audio buffers, waveform data, or live handles.
- A stop request fails after monitoring was reported active.
- Direct monitoring mute is changed while monitoring is stopped.
- A requester declares a direct-monitor requirement that conflicts with the user/default direct-monitor setting.
- Monitoring is active through a legacy browser, desktop, or plugin-specific path during migration.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide an authoritative audio-monitoring control plane for inspecting monitoring state, starting monitoring, stopping monitoring, and reporting provider availability.
- **FR-002**: System MUST represent each monitoring provider with provider attribution, supported operations, availability, source mode, current state, and bounded safe reason when unavailable, degraded, or failed.
- **FR-003**: System MUST support provider-owned operations for monitoring start, monitoring stop, and monitoring status where those operations are applicable to the provider.
- **FR-004**: System MUST allow requesters to inspect monitoring state without reading browser, desktop, native, or plugin-private globals.
- **FR-005**: System MUST require monitoring start requests to reference the selected input source or an explicit redaction-safe source reference from the audio-input domain.
- **FR-005a**: System MUST support a user-selected or default monitoring provider and MUST return provider-selection-required when multiple compatible providers are available and no provider has been selected or supplied by the requester.
- **FR-006**: System MUST use audio-input open-session outcomes as the input readiness boundary for monitoring start rather than silently opening unknown input sources.
- **FR-007**: System MUST keep source selection ownership in audio-input and monitoring lifecycle ownership in audio-monitoring.
- **FR-008**: System MUST expose explicit monitoring outcomes including handled, denied, degraded, failed, no-owner, no-handler, unsupported-command, incompatible, incompatible-version, unavailable, provider-selection-required, user-action-required, and stopped.
- **FR-009**: System MUST distinguish permission-denied, input-unavailable, provider-unavailable, provider-failed, unsupported-command, incompatible channel/source requirements, incompatible contract version, and stopped states.
- **FR-009a**: System MUST allow monitoring start to succeed with degraded status only for non-blocking issues such as high latency, unsupported direct-monitor control, or partial non-critical routing; missing input readiness or no usable output path MUST fail or report unavailable.
- **FR-009b**: System MUST require explicit user action for every fresh monitoring start that could open live input or produce sound; non-user requesters may inspect state or attach to an already active compatible monitoring session, otherwise they MUST receive user-action-required.
- **FR-010**: System MUST emit observable events when monitoring starts, stops, becomes unavailable, is denied, degrades, fails, or changes direct-monitor state.
- **FR-011**: System MUST coordinate shared monitoring sessions so compatible requesters do not create duplicate provider starts for the same provider and source.
- **FR-012**: System MUST track requester references for shared monitoring and request provider stop only after the final requester releases the monitoring session.
- **FR-013**: System MUST handle provider disappearance, disablement, or incompatible version by marking active monitoring sessions degraded, unavailable, or orphaned with a safe reason.
- **FR-014**: System MUST make repeated provider hydration idempotent so the same monitoring provider appears once with updated status and last-seen metadata.
- **FR-014a**: System MUST keep active monitoring running through song switches and playback stops until the user or final requester explicitly stops monitoring.
- **FR-014b**: System MUST NOT auto-resume live monitoring after app reload; it MUST restore the selected/default provider and selected source preference when available and require an explicit start before live audio resumes.
- **FR-015**: System MUST preserve existing legacy monitoring paths during the compatibility period by mapping observed behavior into monitoring diagnostics where feasible.
- **FR-016**: System MUST record compatibility bridge hits for legacy browser, desktop, native, or plugin-specific monitoring starts, stops, readiness barriers, and direct-monitor toggles that still occur during migration.
- **FR-017**: System MUST prevent duplicate user-visible monitoring providers when native and compatibility-backed participants describe the same logical monitoring path; native provider state wins and the compatibility path is diagnostics-only.
- **FR-018**: System MUST expose direct-monitor mute state as monitoring status when a provider can report or control it.
- **FR-019**: System MUST allow providers that cannot control direct monitoring to report unsupported or unavailable direct-monitor control without failing unrelated monitoring operations.
- **FR-019a**: System MUST treat the user-selected or default direct-monitor state as authoritative; requester-declared direct-monitor requirements MUST NOT silently change it and MUST produce degraded or unsupported outcomes when unmet.
- **FR-020**: System MUST include monitoring providers, active sessions, requester references, selected source references, direct-monitor state, bridge hits, and recent outcomes in diagnostics.
- **FR-021**: System MUST redact or pseudonymize device labels, stable hardware identifiers, local paths, secrets, and raw platform identifiers in monitoring diagnostics and support surfaces.
- **FR-022**: System MUST NOT expose raw audio buffers, sample data, waveform data, recordings, MediaStream handles, AudioNode handles, native handles, or equivalent live objects through monitoring state or diagnostics.
- **FR-023**: System MUST give support tooling enough safe metadata to distinguish browser-provided, desktop/native-provided, plugin-provided, and compatibility-backed monitoring paths.
- **FR-024**: System MUST document the migration path for monitoring provider and requester plugins, including native registration, start/stop/status behavior, direct-monitor state, diagnostics, legacy bridge behavior, and removal gates.
- **FR-025**: System MUST leave note scoring, pitch detection, effect-chain editing, plugin scanning, playback transport, recording capture, and stem playback outside this feature except for monitoring state or source references they consume.
- **FR-026**: System MUST handle monitoring start and stop failures without leaving monitoring state ambiguous or reporting stopped monitoring as still active.
- **FR-027**: System MUST allow monitoring status inspection without triggering input permission prompts; permission prompts may occur only when monitoring start explicitly requires live input access through the selected source.
- **FR-028**: System MUST report monitoring latency, direct-monitor mute state, and provider degradation as bounded summary fields when providers supply them.

### Key Entities

- **Monitoring Provider**: A participant that can start, stop, or report status for a live monitoring path such as desktop/native monitoring, browser monitoring, or plugin-hosted monitoring.
- **Selected Monitoring Provider**: The user's chosen or default provider for monitoring starts when more than one compatible provider exists.
- **Monitoring Requester**: A user action, plugin, or feature that needs monitoring active and can be attributed in start and stop outcomes.
- **Monitoring Start Authorization**: Whether a start request is backed by explicit user action, is an attachment to an existing compatible session, or must be rejected as user-action-required.
- **Monitoring Session**: A coordinator-owned record for a provider plus selected source reference, current state, requester references, safe status fields, and no live audio handles.
- **Selected Source Reference**: A redaction-safe reference to the input source that monitoring should use, owned by the audio-input domain.
- **Direct Monitoring State**: Whether dry input is muted, unmuted, unsupported, unavailable, or unknown for the active monitoring path.
- **Direct Monitoring Requirement**: An optional requester-declared requirement for dry input mute state that can be satisfied, degraded, or unsupported without overriding the user's/default setting.
- **Monitoring Status Summary**: Redaction-safe provider status such as active, stopped, unavailable, degraded, denied, failed, latency summary, and bounded reason.
- **Blocking Monitoring Failure**: A missing input source, denied input, unavailable provider, or unusable output path that prevents monitoring from becoming active.
- **Non-Blocking Monitoring Degradation**: A condition such as high latency, unsupported direct-monitor control, or partial non-critical routing where monitoring can still become active with degraded status.
- **Monitoring Outcome**: A bounded diagnostic record describing a monitoring operation, provider, requester, source reference when known, outcome, status, and safe reason.
- **Compatibility Bridge Hit**: A record that a legacy monitoring path, readiness barrier, or direct-monitor toggle was used during migration.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of registered monitoring providers appear with provider attribution, availability, supported operations, and redaction-safe status in monitoring diagnostics.
- **SC-002**: 100% of handled, denied, degraded, failed, unavailable, no-owner, no-handler, unsupported-command, incompatible, incompatible-version, provider-selection-required, user-action-required, and stopped scenarios produce distinct outcomes in focused validation scenarios.
- **SC-003**: 100% of diagnostics exports for monitoring contain zero raw audio buffers, waveform/sample data, recordings, live handles, raw device labels, stable hardware identifiers, secrets, or unredacted local paths.
- **SC-004**: Rehydrating a monitoring provider five times in one session creates one provider record per logical monitoring path, with no duplicate user-visible entries.
- **SC-005**: A requester can determine current monitoring state, provider attribution, selected source reference, and direct-monitor state in one inspection step in 100% of tested cases.
- **SC-006**: Two compatible requesters starting monitoring for the same provider and selected source create one provider-owned monitoring session and keep it active until both requesters release it in focused validation scenarios.
- **SC-007**: Starting monitoring with no selected source, denied input, unavailable input, or incompatible channel shape returns a distinct safe outcome in 100% of focused validation scenarios.
- **SC-007a**: High latency, unsupported direct-monitor control, and partial non-critical routing produce active degraded sessions, while missing input readiness and no usable output path fail or report unavailable in 100% of focused validation scenarios.
- **SC-008**: Native and compatibility-backed representations of the same logical monitoring path never create duplicate user-visible provider entries in representative migration scenarios.
- **SC-009**: Support maintainers can identify provider, source readiness, direct-monitor state, compatibility bridge involvement, and failure outcome for a representative monitoring issue in under 5 minutes using diagnostics or the inspector.
- **SC-010**: Monitoring status inspection triggers zero input permission prompts in focused validation scenarios; permission prompts occur only during explicit start flows that require live input access.
- **SC-011**: Direct-monitor mute changes are reflected in monitoring status within 1 second for providers that support direct-monitor control.
- **SC-012**: Stopping the last requester for an active shared monitoring session results in a stopped monitoring state within 1 second in focused validation scenarios.
- **SC-013**: Active monitoring remains active across song switches and playback stops in 100% of focused validation scenarios unless explicitly stopped.
- **SC-014**: After app reload, provider/source preference is restored but live monitoring is not active until explicit start in 100% of focused validation scenarios.
- **SC-015**: Requesters with direct-monitor requirements that conflict with the user/default setting receive degraded or unsupported outcomes without changing that setting in 100% of focused validation scenarios.
- **SC-016**: Non-user requesters attempting fresh monitoring starts receive user-action-required, while compatible requesters attaching to already active sessions succeed, in 100% of focused validation scenarios.

## Assumptions

- The audio graph/session and audio-input control-plane slices are available as foundation work for this feature.
- Slopsmith remains a self-hosted, single-user app with one user-visible monitoring state per active provider/source path.
- Audio-monitoring is sensitive because it involves live input access, device readiness, latency, and hardware/environment status.
- Existing browser, desktop/native, NAM-style, and plugin-specific monitoring paths may coexist during migration.
- Audio-input owns source identity, source selection, permission boundary, and source open-session readiness; audio-monitoring owns monitoring lifecycle and monitoring status.
- Monitoring is independent from song playback transport while the app is running, but live monitoring must not auto-resume after reload because live audio handles and user consent cannot be safely preserved across process lifetime.
- Fresh monitoring starts are user-authorized actions because they can open live input and produce sound; background/plugin automation can observe or attach but cannot initiate live monitoring from stopped state.
- Audio-mix owns faders, route summaries, and analyser summaries; audio-monitoring may reference route or latency summaries but does not own mixer faders.
- Audio-effects, note-detection, recording, playback, and plugin-management domains may consume monitoring state later but are not implemented by this feature.
- Direct monitoring is treated as monitoring topology/status rather than a normal mixer fader.
- User/default direct-monitor preference is the authority for what the player hears; requester requirements are compatibility constraints, not commands to override the user.
- Degraded monitoring is acceptable only when the player can still hear a valid monitoring path; conditions that prevent input readiness or output audibility are blocking failures.
- This feature focuses on monitoring provider/requester lifecycle, direct-monitor state, compatibility attribution, diagnostics, and safe state inspection.
