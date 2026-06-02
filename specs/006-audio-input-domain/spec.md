# Feature Specification: Audio Input Control Plane

**Feature Branch**: `006-audio-input-domain`  
**Created**: 2026-05-30  
**Status**: Draft  
**Input**: User description: "Proceed with the next domain audio-input"

## Clarifications

### Session 2026-05-30

- Q: How should audio-input identify the same source across reloads and native/legacy providers for persistence and duplicate suppression? → A: Providers supply a redaction-safe logical source key.
- Q: When may audio-input trigger input permission prompts? → A: Only on explicit open/start live input; inspect/list/select do not prompt.
- Q: What does audio-input own when a source is opened or closed? → A: Audio-input coordinates open/close state and outcomes only; providers and downstream domains own actual stream or node handles.
- Q: How should channel shape affect source selection? → A: Users select sources; requesters specify required channel shape at open/start time.
- Q: How should simultaneous requesters share opened input? → A: Share one open session per source and compatible channel shape; close after the last requester releases it.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Select A Trusted Input Source (Priority: P1)

A player chooses which instrument or microphone input Slopsmith should use, sees whether it is available, and can rely on that choice being respected by audio features that need live input.

**Why this priority**: Audio-input is only valuable if the user can make an explicit, understandable source choice before note detection, monitoring, recording, or other input consumers build on it.

**Independent Test**: Can be tested by registering representative input sources, selecting one, changing availability, and confirming the selected source and its status are visible through the audio-input domain without using plugin-private state.

**Acceptance Scenarios**:

1. **Given** at least one input source is available, **When** the user selects it, **Then** the audio-input domain records that source as selected and exposes the selection to authorized consumers.
2. **Given** a selected source becomes unavailable, **When** the user or a consumer inspects input state, **Then** the source is still identifiable as the selected source but its availability and degradation reason are clear.
3. **Given** no source has been selected yet, **When** an input consumer asks for current input state, **Then** the result indicates that no selected source is available rather than silently choosing an unknown source.

---

### User Story 2 - Migrate Input Providers And Requesters Safely (Priority: P2)

A plugin author can provide or request audio input through a native audio-input contract while existing browser or desktop input handshakes continue to work during migration.

**Why this priority**: Input behavior currently spans browser permissions, desktop/native bridges, and plugin-specific assumptions. The migration must let providers move to the new domain without breaking plugins that still use legacy paths.

**Independent Test**: Can be tested by registering one native input provider and one legacy input bridge, then confirming both are represented in diagnostics and that native source state is preferred when both describe the same logical source.

**Acceptance Scenarios**:

1. **Given** a provider registers a native input source, **When** the input list is inspected, **Then** the source appears with provider attribution, availability, channel summary, and safe display metadata.
2. **Given** a plugin still uses a legacy input handoff, **When** it participates in live input, **Then** the behavior remains usable and the legacy path is recorded as a compatibility bridge.
3. **Given** native and legacy paths describe the same logical source, **When** support data is inspected, **Then** the native source owns the authoritative state and the legacy path is reported as compatibility-backed rather than creating duplicate user-visible sources.

---

### User Story 3 - Explain Permission And Device Failures (Priority: P3)

A user or maintainer troubleshooting live input can tell whether a source is unavailable because permission was denied, the device disappeared, the provider failed, the channel configuration is incompatible, or no owner exists.

**Why this priority**: Input failures are sensitive and platform-dependent. Clear outcome states reduce vague "audio not working" reports while keeping device identity private.

**Independent Test**: Can be tested by forcing granted, denied, unavailable, incompatible, no-owner, no-handler, degraded, and failed input outcomes and verifying that diagnostics distinguish them with redacted details.

**Acceptance Scenarios**:

1. **Given** permission is denied, **When** a source is opened or input state is inspected, **Then** the outcome or source state is denied and diagnostics include a redaction-safe reason.
2. **Given** a selected device disappears, **When** the input state is inspected, **Then** the source is marked unavailable and consumers receive an explicit unavailable result.
3. **Given** a provider fails while opening or closing a source, **When** diagnostics are exported, **Then** the failure outcome identifies the provider and operation without exposing raw audio, device labels, stable hardware identifiers, or local paths.

---

### User Story 4 - Keep Input State Stable Across Sessions (Priority: P4)

A player who has chosen an input source can reload, switch songs, hydrate plugins, or move between browser and desktop-capable paths without duplicate sources or stale selections.

**Why this priority**: The input domain becomes a shared foundation for later note-detection and monitoring work. Its state must be stable before downstream domains depend on it.

**Independent Test**: Can be tested by selecting a source, reloading or rehydrating providers, switching songs, and confirming the selected source, safe label, availability, and diagnostics remain consistent without duplicate source records.

**Acceptance Scenarios**:

1. **Given** a provider registers the same source repeatedly, **When** input state is inspected, **Then** the source appears once with updated availability and last-seen metadata.
2. **Given** the app reloads after a user selected a source, **When** the same provider/source is available again, **Then** the selection is restored or proposed as the prior choice without selecting a different source silently.
3. **Given** a song switch occurs while an input source is selected, **When** the next session begins, **Then** the input selection remains separate from playback transport and the selected source does not duplicate.

### Edge Cases

- A browser or desktop provider is unavailable, disabled, or not yet hydrated when a requester asks for input state.
- Permission is denied, revoked, or not yet requested.
- A source disappears after selection or reappears with different channel availability.
- Multiple providers report the same physical or logical source.
- A provider returns sensitive labels, stable hardware identifiers, local paths, or secret-bearing reason text.
- A requester asks to open or use a source before the user has selected any source.
- A user or requester inspects, lists, or selects sources before permission is granted; the operation must not trigger a permission prompt.
- A source supports mono input, stereo input, or multiple channels and a requester needs a specific channel shape at open/start time.
- Multiple requesters ask to open the same selected source with compatible or incompatible channel requirements.
- A provider registers an incompatible contract version or unsupported source metadata.
- A provider throws, rejects, times out, or returns malformed data while describing, opening, or closing a source.
- A provider or requester needs a live stream or audio node after an open operation; audio-input records state and outcomes without exposing the handle through diagnostics or source snapshots.
- Local preference storage is unavailable when remembering a prior selected source.
- A diagnostic snapshot is requested before any input provider has registered.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide an authoritative audio-input control plane for discovering input sources, selecting a source, inspecting current state, and reporting source availability.
- **FR-002**: System MUST represent each input source with a stable provider-scoped source identifier, provider-supplied redaction-safe logical source key, provider attribution, kind, redaction-safe label or pseudonym, channel summary, availability, selected state, and bounded reason when unavailable or degraded.
- **FR-003**: System MUST support provider-owned source operations for enumeration, description, opening, and closing where those operations are applicable to the provider.
- **FR-004**: System MUST allow requesters to inspect current input state without reading browser, desktop, or plugin-private globals.
- **FR-005**: System MUST expose explicit outcomes for input operations, including handled, denied, degraded, failed, no-owner, no-handler, unsupported-command, overridden, and incompatible-version.
- **FR-006**: System MUST preserve unavailable as a distinct source status from denied, failed, disabled, and incompatible.
- **FR-007**: System MUST record permission-denied outcomes separately from device-unavailable and provider-failed outcomes.
- **FR-008**: System MUST emit observable events when sources are registered, removed, selected, unavailable, denied, degraded, opened, or closed.
- **FR-009**: System MUST preserve existing legacy input handoffs during the compatibility period by mapping them into audio-input diagnostics and source state where feasible.
- **FR-010**: System MUST record compatibility bridge hits for legacy browser, desktop, or plugin-specific input source handoffs that still occur during migration.
- **FR-011**: System MUST prevent duplicate user-visible input sources when native and legacy paths share the same logical source key; native source state wins and the legacy path is reported as compatibility-backed.
- **FR-012**: System MUST make repeated provider hydration idempotent so the same logical source appears once with updated last-seen and availability metadata.
- **FR-013**: System MUST keep the selected source stable across song switches and app reloads when the same logical source key is still available, while avoiding silent selection of a different source when it is not.
- **FR-014**: System MUST allow known sources to remain visible as unavailable or disabled when they are temporarily inaccessible.
- **FR-015**: System MUST include audio-input sources, selected source state, provider attribution, bridge hits, and recent operation outcomes in diagnostics.
- **FR-016**: System MUST redact or pseudonymize device labels, stable hardware identifiers, local file paths, secrets, and raw platform identifiers in diagnostics and support surfaces.
- **FR-017**: System MUST NOT expose raw audio buffers, sample data, live waveform data, or recording contents through audio-input diagnostics.
- **FR-018**: System MUST give support tooling enough safe metadata to distinguish browser-provided, desktop/native-provided, plugin-provided, and compatibility-backed input sources.
- **FR-019**: System MUST document the migration path for input provider and requester plugins, including native source registration, selection, diagnostics, legacy bridge behavior, and removal gates.
- **FR-020**: System MUST leave note scoring, monitoring lifecycle, recording capture, audio effects, playback transport, and plugin installation behavior outside this feature except for the input source metadata they consume.
- **FR-021**: System MUST handle source open/close failures without leaving the selected source in an ambiguous state.
- **FR-022**: System MUST make channel availability visible as summary metadata without requiring consumers to parse device-specific labels.
- **FR-023**: System MUST reject or degrade unsupported source metadata and incompatible provider versions with diagnostic outcomes rather than silently accepting unsafe state.
- **FR-024**: System MUST avoid creating new legacy-only input integration points once the native audio-input path exists.
- **FR-025**: System MUST NOT trigger input permission prompts during source inspection, source listing, or source selection; permission prompts may occur only when the user explicitly opens or starts live input.
- **FR-026**: System MUST coordinate source open and close state, requester attribution, and outcomes without exposing or brokering raw MediaStream, AudioNode, native handle, or equivalent live audio objects through audio-input state, diagnostics, or capability payloads.
- **FR-027**: System MUST keep user selection at the source level and require requesters that open or start live input to declare any required channel shape, producing a distinct incompatible outcome when the selected source cannot satisfy it.
- **FR-028**: System MUST coordinate one open input session per selected source and compatible channel shape, track requester references for that session, and close the provider-owned session only after the last requester releases it.

### Key Entities

- **Audio Input Source**: A provider-owned input option such as a browser microphone, desktop/native audio device, plugin-provided stream, or virtual source, described with safe identity, a redaction-safe logical source key, and availability metadata.
- **Input Provider**: The participant that can enumerate, describe, open, or close one or more input sources.
- **Input Requester**: A consumer such as note detection, monitoring, recording, or a plugin workflow that needs current input state without owning source identity; when opening live input, it declares any required channel shape.
- **Selected Input**: The user's current preferred input source, keyed by its redaction-safe logical source key, and its current availability state.
- **Open Input Session**: A coordinator-owned record for a selected source plus compatible channel shape, including requester references, open/close state, safe outcomes, and no live audio handles.
- **Channel Summary**: Redaction-safe metadata about usable channel count and channel shape, without raw labels or stable device identifiers; it informs compatibility but is not a separate user-selected device.
- **Permission State**: The user-visible and diagnostic state describing whether input access is granted, denied, pending, unavailable, or failed.
- **Compatibility Bridge Hit**: A record that a legacy input handoff or source-selection surface was used during migration.
- **Input Outcome**: A bounded diagnostic record describing an input operation, provider, source, requester when known, status, outcome, and safe reason, without live audio handles or sample data.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of registered input sources appear with provider attribution, availability, selected state, and redaction-safe identity in audio-input diagnostics.
- **SC-002**: 100% of permission denied, unavailable, failed, incompatible, no-owner, and no-handler scenarios produce distinct outcomes in focused validation scenarios.
- **SC-003**: 100% of diagnostics exports for input sources contain zero raw audio buffers, waveform/sample data, raw device labels, stable hardware identifiers, secrets, or unredacted local paths.
- **SC-004**: Rehydrating an input provider five times in one session creates one source record per logical source, with no duplicate user-visible entries.
- **SC-005**: A user-selected source is restored or reported as unavailable within 1 second after app load when the provider has registered.
- **SC-006**: A requester can determine the current selected source, availability, and channel summary in one inspection step in 100% of tested cases.
- **SC-007**: Native and compatibility-backed representations with the same logical source key never create duplicate user-visible source entries in representative migration scenarios.
- **SC-008**: Support maintainers can identify provider, source status, permission outcome, and compatibility bridge involvement for a representative input failure in under 5 minutes using diagnostics or the inspector.
- **SC-009**: Song switching preserves the selected input source without changing playback transport or requiring provider re-registration in 100% of tested song-switch scenarios.
- **SC-010**: New bundled input consumers added after this feature use audio-input state rather than adding new legacy-only source handoffs in 100% of reviewed cases.
- **SC-011**: Source inspection, source listing, and source selection trigger zero input permission prompts in focused validation scenarios; permission prompts occur only during explicit open/start live-input flows.
- **SC-012**: 100% of audio-input source snapshots, operation outcomes, and diagnostics contain no live stream handles, audio-node handles, native capture handles, raw buffers, sample data, or waveform data in focused validation scenarios.
- **SC-013**: 100% of focused channel-shape validation scenarios keep the selected source unchanged while returning handled or incompatible outcomes based on the requester-declared channel requirement.
- **SC-014**: Two compatible requesters opening the same selected source create one provider-owned open session and keep it open until both requesters release it in focused validation scenarios.

## Assumptions

- The audio graph/session slice and audio-mix control-plane slice are available as foundation work for this feature.
- Slopsmith remains a self-hosted, single-user app with one primary user-controlled input selection at a time.
- Audio-input is sensitive because source identity, device labels, and permission state can reveal private hardware or environment details.
- Existing browser, desktop/native, and plugin-specific input paths may coexist during migration.
- Source selection persistence should prefer restoring the same logical source when available and should not silently choose a different source when unavailable.
- Provider-owned source availability may change while the app is running.
- Later note-detection, monitoring, recording, and audio-effects domains may consume audio-input state but are not implemented by this feature.
- This feature focuses on source identity, availability, selection, provider/requester migration, compatibility attribution, diagnostics, and safe state inspection.
