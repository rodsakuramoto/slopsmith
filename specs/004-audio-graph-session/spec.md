# Feature Specification: Audio Graph/Session Capability Slice

**Feature Branch**: `004-audio-graph-session`  
**Created**: 2026-05-29  
**Status**: Implemented
**Input**: User description: "Create a spec for the first capability slice \"Audio graph/session\". Use the 003 spec as reference for the migration standard."

## Reference Standard And Domain Scope

This domain spec applies the migration standard from [specs/003-migrate-capability-domains/spec.md](../003-migrate-capability-domains/spec.md). It is the first concrete capability slice after the reference standard and must include a completed per-domain migration checklist plus a per-slice legacy inventory before planning.

The audio graph/session slice covers the coordinated user-visible audio session around song output, stem mixing, plugin audio participants, monitoring lifecycle, analyser-style read access, and named input/output source identity. It promotes the following related domains as one coordinated first slice because the issue history shows their bugs overlap:

- `audio-mix`: mix participants, faders, read-only analyser/session inspection, and output-session consistency.
- `audio-input`: named input sources, devices, channels, permission/availability state, and source identity for later note-detection work.
- `audio-monitoring`: instrument/mic monitoring lifecycle and user consent/availability diagnostics.
- `stems`: stem mute/restore ownership, automation claims, manual override precedence, and compatibility with existing stem behavior.

This slice does not implement note scoring, playback transport controls, full VST/DSP internals, multiplayer profiles, or a new frontend framework. Those remain separate domain slices or implementation details.

### Domain Contract Summary

- **Owner model**: `audio-mix`, `audio-input`, and `audio-monitoring` are core-owned multi-provider domains with deterministic coordination; `stems` is coordinated by the core audio session host while the active Stems plugin/provider remains the semantic owner of actual stem playback and state.
- **Safety classes**: `audio-mix` and `stems` are safe; `audio-input` and `audio-monitoring` are sensitive and require redacted diagnostics plus user-visible permission/availability handling.
- **Participant roles**: core audio session, song audio, stem-capable providers, monitoring providers, plugin fader/analyser participants, input-source providers, and requester/observer plugins.
- **Initial command scope**: inspect current audio session, inspect/register mix participants, inspect/register input sources, start/stop monitoring, mute/restore stems, and report current availability.
- **Initial event scope**: participant registered/removed, mix state changed, input source changed, monitoring started/stopped/failed, stem automation applied/restored/overridden, compatibility bridge hit, and device availability changed.
- **Compatibility bridge scope**: existing fader registration, stem mute state, NAM/Stems ducking behavior, direct analyser ownership, input/channel selection behavior, and output-device divergence between song formats.

## Clarifications

### Session 2026-05-29

- Q: What should own the audio graph/session host boundary for this first slice? → A: Core-owned audio session host coordinates all four domains for the active player/song.
- Q: How should sensitive audio device/source identity appear in diagnostics exports? → A: Export redacted fields plus per-bundle pseudonyms so events can be correlated within one support bundle.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Keep Audio Routing And Mix State Consistent (Priority: P1)

A user who selects an audio output, plays different song formats, adjusts faders, or enables stems needs the audio session to behave consistently regardless of whether the song is PSARC, sloppak, stem-backed, or plugin-assisted.

**Why this priority**: Audio failures are high-impact and user-visible. This slice exists because routing, fader, stem, analyser, and monitoring behavior currently spans multiple legacy paths that can disagree or fail silently.

**Independent Test**: Can be tested by using a representative song output path and a representative stem-backed output path, selecting a user-visible audio destination or mix state, and verifying both paths use the same coordinated session state with diagnostics explaining any degradation.

**Acceptance Scenarios**:

1. **Given** a user has selected an audio output or mix preference, **When** they play a PSARC song and then a stem-backed song, **Then** both routes respect the same visible audio-session choice or report a clear degraded outcome.
2. **Given** multiple audio participants expose faders or read-only analyser access, **When** they register in the audio session, **Then** the user can inspect the participants and support data shows the owner, participant, and current availability.
3. **Given** an audio device becomes unavailable, **When** the user starts or continues playback, **Then** the session reports the unavailable device status and falls back or degrades without silently switching unrelated song or plugin audio to a different hidden path.

---

### User Story 2 - Coordinate Stem Automation Without Overwriting Manual Choices (Priority: P2)

A user enabling a monitoring or amp-style plugin needs automation such as guitar-stem ducking to request temporary stem changes without permanently overwriting the user's manual stem mute, restore, or mix choices.

**Why this priority**: The motivating capability bug class is plugin-to-plugin private-state mutation. Stems should own stem state; requesters should ask for temporary changes through a recorded capability path.

**Independent Test**: Can be tested by enabling a monitoring requester that mutes or ducks a stem, manually changing the stem while automation is active, and verifying manual intent wins and restore behavior is explainable.

**Acceptance Scenarios**:

1. **Given** a requester asks to mute or duck a stem during monitoring, **When** the stem owner accepts the request, **Then** the request is recorded as automation and can be restored without reading or writing private plugin state.
2. **Given** the user manually unmutes or adjusts a stem while automation is active, **When** automation attempts to reapply its prior state, **Then** the manual choice is treated as an override rather than a failure.
3. **Given** the stem owner is unavailable, **When** a requester asks for a stem change, **Then** the outcome is reported as no-owner or no-handler instead of silently doing nothing.

---

### User Story 3 - Make Audio Input And Monitoring Diagnosable (Priority: P3)

A user or support maintainer troubleshooting microphones, instrument inputs, channels, or monitoring needs to see what source was requested, what was available, what permission or device state blocked it, and which plugin participated.

**Why this priority**: Input and monitoring issues are sensitive, platform-dependent, and often reported as vague "audio not working" bugs. The first audio slice must establish redacted source identity and lifecycle diagnostics before note detection builds on it.

**Independent Test**: Can be tested by attempting to start monitoring with an available source, unavailable source, denied permission, and changed device/channel availability, then verifying the visible and diagnostic outcomes are distinct.

**Acceptance Scenarios**:

1. **Given** an input source is available and permission is granted, **When** monitoring starts, **Then** the session records the source identity, participant, and started outcome.
2. **Given** permission is denied or a device is unavailable, **When** monitoring starts, **Then** the user receives a clear denied outcome or unavailable source status and diagnostics preserve a redacted explanation.
3. **Given** a later note-detection domain needs per-source binding, **When** it inspects audio-input state, **Then** it can rely on named source identity without inheriting a single global detector assumption.

---

### User Story 4 - Preserve Legacy Audio Behavior During Migration (Priority: P4)

A plugin author whose plugin still uses existing fader, stem, analyser, monitoring, or input/channel behavior needs the feature to preserve current workflows while showing which parts are native capability behavior and which parts are compatibility bridges.

**Why this priority**: Audio touches bundled and external plugins. Breaking existing audio plugins during the first domain migration would be worse than the status quo.

**Independent Test**: Can be tested by running a legacy participant through its existing path and verifying that user-visible behavior remains equivalent while diagnostics show compatibility usage.

**Acceptance Scenarios**:

1. **Given** a legacy fader participant still uses the existing registration behavior, **When** the audio graph/session slice is active, **Then** the participant remains usable and support data attributes the legacy path.
2. **Given** a plugin still relies on a legacy analyser or monitoring handshake, **When** the replacement path exists, **Then** the legacy path is bridged, warned, or documented according to its deprecation state.
3. **Given** a new bundled audio feature is added after the replacement exists, **When** it participates in this domain, **Then** it uses the new domain path rather than adding new legacy-only coupling.

---

### User Story 5 - Stage Audio Deprecation Safely (Priority: P5)

A release maintainer needs a clear inventory of audio legacy surfaces, migration status, warnings, and adoption gates before any legacy surface can be marked removable.

**Why this priority**: This slice is the first real test of the 003 migration standard. It must prove the project can reduce legacy audio coupling without creating a permanent second architecture.

**Independent Test**: Can be tested by reviewing the per-domain checklist and legacy inventory and confirming every affected legacy surface is added, removed, migrated, contained, or remaining with owner, risk, and follow-up gate.

**Acceptance Scenarios**:

1. **Given** a legacy audio surface has a replacement path, **When** the slice is reviewed, **Then** the surface has a deprecation state and a migration note.
2. **Given** a legacy audio surface is still used by bundled or documented external plugins, **When** removal is proposed, **Then** removal is blocked until bundled migration, external review, migration notes, and a warning/diagnostics notice window are complete.
3. **Given** the slice cannot fully migrate a legacy surface, **When** the slice ships, **Then** the remaining surface is contained or documented with owner, risk, and follow-up gate.

---

### Edge Cases

- A user plays a non-stem song and then a stem-backed song after choosing an output; both song paths must not silently use different devices.
- A stem owner or monitoring provider is disabled, unavailable, or not yet hydrated; requesters must receive no-owner/no-handler outcomes or an unavailable status/reason rather than silently mutating private state.
- A user manually changes a stem, fader, input, or monitoring state while automation is active; manual choice wins and automation is recorded as overridden when applicable.
- Multiple participants request access to the same read-only analyser or session data; the session must avoid singleton ownership collisions.
- A device appears, disappears, or changes channel availability during a session; availability changes must be observable and diagnostics-safe.
- Input or monitoring diagnostics may contain sensitive device names or paths; support exports must redact or summarize sensitive values and may use per-bundle pseudonyms to correlate events inside one diagnostics bundle.
- Playback/transport and note detection need some audio-session facts, but this slice must not absorb their domain-specific responsibilities.
- A compatibility bridge fails; support data must distinguish bridge failure from native domain failure.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The slice MUST apply the migration standard from [specs/003-migrate-capability-domains/spec.md](../003-migrate-capability-domains/spec.md), including a completed per-domain migration checklist and per-slice legacy inventory before planning.
- **FR-002**: The slice MUST define the audio graph/session domain family covering `audio-mix`, `audio-input`, `audio-monitoring`, and `stems`, including owner model, participant roles, command scope, event scope, safety classes, and excluded responsibilities.
- **FR-003**: The slice MUST establish a core-owned audio session host boundary for each active player/song that coordinates `audio-mix`, `audio-input`, `audio-monitoring`, and `stems` so new bundled audio behavior does not rely only on legacy globals, wrapper chains, direct private state access, singleton analyser ownership, or plugin-specific handshakes.
- **FR-004**: The slice MUST preserve existing user-visible behavior for covered legacy audio paths through compatibility bridges unless a legacy surface is documented as unused.
- **FR-005**: The slice MUST make song output and mix state consistent across representative PSARC and stem-backed song paths, or report a clear degraded outcome when consistency is not possible.
- **FR-006**: The slice MUST let stem owners handle mute/restore automation through recorded requests or claims rather than requesters reading or writing private stem state.
- **FR-007**: The slice MUST ensure manual user choices for stem, fader, input, or monitoring state take precedence over matching automation and are reported as overrides when automation cannot reapply.
- **FR-008**: The slice MUST represent named audio input sources, channel availability, device availability, and monitoring lifecycle in a way that later note-detection work can consume without assuming one global detector.
- **FR-009**: The slice MUST provide diagnostics for `handled`, `denied`, `overridden`, `unsupported-command`, `no-owner`, `no-handler`, `incompatible-version`, `degraded`, and `failed` runtime outcomes when those outcomes are possible, and MUST preserve `unavailable` as a redaction-safe status or reason when a device, source, owner, or provider is absent.
- **FR-010**: The slice MUST surface audio-domain owners, participants, compatibility bridges, legacy usage, and outcome state in the Capability Inspector or an equivalent support surface.
- **FR-011**: The slice MUST redact or summarize sensitive audio-input and monitoring details in support exports while preserving enough information to troubleshoot source identity, permission, and availability failures through per-bundle pseudonyms that are not stable across separate exports.
- **FR-012**: The slice MUST assign a deprecation state to every covered legacy audio surface: supported compatibility, deprecated with warning, blocked for new bundled code, or removable.
- **FR-013**: The slice MUST block new bundled audio-domain behavior from adding new legacy-only integration points once the replacement path exists.
- **FR-014**: The slice MUST define plugin-author migration notes for covered fader, stem, analyser, input, and monitoring surfaces.
- **FR-015**: The slice MUST include tests or review evidence proving native and compatibility paths preserve equivalent user-visible behavior during transition.
- **FR-016**: The slice MUST document overlap with playback/transport and note-detection domains so implementation does not rewrite shared capability runtime primitives or absorb responsibilities belonging to later slices.

### Key Entities *(include if feature involves data)*

- **Audio Graph/Session Domain Family**: The coordinated capability slice covering mix participants, input sources, monitoring lifecycle, and stem automation.
- **Audio Session Host Boundary**: The core-owned app surface for each active player/song that coordinates audio-session state across the four domains and contains legacy audio behavior during migration.
- **Mix Participant**: Song audio, stem audio, monitoring output, plugin fader, or analyser participant visible to the audio-mix domain.
- **Audio Input Source**: A named and availability-tracked input device/source/channel that can be selected, inspected, and later used by note-detection work.
- **Monitoring Session**: A user-visible lifecycle for mic/instrument monitoring that can start, stop, fail, or become unavailable.
- **Stem Owner**: The participant responsible for stem mute/restore state and manual override precedence.
- **Automation Request**: A temporary request from a participant to change stem, monitoring, or mix state without owning that state.
- **Manual Override**: A user action that takes precedence over automation for the same target.
- **Audio Compatibility Bridge**: A transitional path preserving legacy fader, stem, analyser, input, monitoring, or output behavior while attributing and diagnosing usage.
- **Audio Legacy Surface**: A covered existing audio integration point such as a fader registry, private stem state, analyser singleton, output-device path, input/channel selection behavior, or monitoring handshake.
- **Audio Diagnostics Outcome**: A support-visible result explaining what happened in a native or compatibility audio request, using redacted values and per-bundle pseudonyms for sensitive source identity when correlation is needed.
- **Audio Migration Note**: Plugin-author guidance explaining how to move from a legacy audio surface to the new audio graph/session path.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of covered future audio-domain behavior includes completed per-domain checklist evidence and a per-slice legacy inventory before implementation planning begins.
- **SC-002**: In representative validation scenarios, PSARC and stem-backed song playback respect the same user-visible output or mix state, or produce a documented degraded outcome, in 100% of tested cases.
- **SC-003**: In representative stem automation scenarios, manual user changes override automation in 100% of tested cases and diagnostics identify the override outcome.
- **SC-004**: Support maintainers can identify the audio domain, participant, compatibility bridge if any, and request outcome for a representative audio failure in under 5 minutes using the support surface.
- **SC-005**: 100% of sensitive audio-input and monitoring diagnostics included in support exports are redacted or summarized, and any source correlation uses pseudonyms scoped to one diagnostics bundle rather than stable cross-export identifiers.
- **SC-006**: 100% of covered legacy audio surfaces have a deprecation state, migration note, and adoption gate before any surface is marked removable.
- **SC-007**: The per-slice legacy inventory shows no net increase in legacy-only audio integration points before the slice proceeds to planning.
- **SC-008**: New bundled audio-domain behavior added after the replacement path exists uses the new domain path in 100% of reviewed cases.

## Assumptions

- PR #245 or its equivalent capability substrate is available, including `capability-pipelines.v1`, diagnostics, the Capability Inspector, and `library` as a native domain.
- The migration standard in `specs/003-migrate-capability-domains` is the governing reference for this slice.
- Existing audio plugins and external integrations may lag behind the new domain path, so compatibility is preserved by default.
- Device names, channel labels, and permission state may be sensitive enough to require redaction or summarization in exported diagnostics.
- This slice can define source identity needed by note detection, but note scoring and per-panel detector behavior remain a later `note-detection` domain.
- Playback transport commands such as play, pause, seek, speed, and loop remain part of a later playback/transport slice unless needed only as audio-session context.
- VST/DSP internals and plugin-specific audio processing chains are not standardized by this slice unless they participate through mix, monitoring, input, or compatibility surfaces.
