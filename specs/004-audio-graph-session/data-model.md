# Data Model: Audio Graph/Session Capability Slice

## Entity: Audio Session

**Purpose**: Core-owned host boundary for the active player/song audio graph.

**Fields**:

- `sessionId`: Stable identifier for the active player/song session.
- `playerId`: Identifier for the player surface that owns the session, defaulting to the main player.
- `songKey`: Redaction-safe song/session key; must not require raw local file paths in diagnostics.
- `songFormat`: `psarc`, `sloppak`, or `unknown`.
- `routeState`: Current `Audio Output Route` summary.
- `mixParticipants`: Ordered list of `Mix Participant` identifiers.
- `inputSources`: Ordered list of `Audio Input Source` identifiers.
- `monitoringSessions`: Current `Monitoring Session` identifiers.
- `stemState`: Current `Stem State` summary when a stem owner is present.
- `bridgeUsage`: Compatibility bridge usage summaries for the session.
- `outcomes`: Recent `Audio Diagnostics Outcome` entries, bounded for diagnostics export.

**Relationships**:

- Owns many `Mix Participant` records.
- Owns many `Audio Input Source` records.
- Owns zero or more `Monitoring Session` records.
- Coordinates one active `Stem Owner` when present.
- Emits `Audio Diagnostics Outcome` entries.

**Validation Rules**:

- Exactly one core audio session host coordinates the four domains for an active player/song.
- A session can exist without a stem owner or monitoring provider.
- A session must distinguish native capability outcomes from compatibility bridge outcomes.
- Sensitive source/device fields are redacted or represented by per-bundle pseudonyms in support exports.

**State Transitions**:

- `initializing` -> `active` when the player/song route and base participants are known.
- `active` -> `degraded` when a route, provider, or bridge fails but user-visible playback can continue.
- `active` or `degraded` -> `stopped` when the player leaves the song/session.
- Any live state -> `failed` only when the audio session cannot provide a usable route or diagnostic explanation.

## Entity: Audio Output Route

**Purpose**: User-visible route state for song audio and plugin audio.

**Fields**:

- `routeId`: Redaction-safe route identifier.
- `routeKind`: `html5`, `juce`, `stems`, `monitoring`, `plugin`, or `unknown`.
- `availability`: `available`, `unavailable`, `degraded`, or `unknown`.
- `selectedByUser`: Whether the route reflects a user-visible selection.
- `devicePseudonym`: Per-bundle pseudonym when exported in diagnostics.
- `fallbackReason`: Optional reason when the route degraded or fell back.

**Validation Rules**:

- PSARC and stem-backed routes must report the same user-visible route choice or a documented degraded outcome.
- Raw local paths and raw device labels must not appear in support exports.

## Entity: Mix Participant

**Purpose**: Participant that contributes audio, fader state, analyser data, or mix inspection data.

**Fields**:

- `participantId`: Unique participant key within the audio session.
- `ownerPluginId`: Plugin id or core id responsible for the participant.
- `label`: User-visible short label.
- `kind`: `song`, `stem`, `plugin`, `monitoring`, `analyser`, or `other`.
- `fader`: Optional `Fader Spec`.
- `operations`: Provider operations supported by the participant.
- `availability`: `available`, `disabled`, `unavailable`, `incompatible`, or `unknown`.
- `compatibilitySource`: Legacy surface name when registered through a bridge.

**Validation Rules**:

- `participantId` is unique per session.
- Fader participants must expose read and write behavior that keeps the visible mixer state synchronized with the applied value.
- Duplicate participant ids update or replace one participant deterministically and emit diagnostics.

## Entity: Fader Spec

**Purpose**: Normalized mixer control contract for a mix participant.

**Fields**:

- `id`: Unique fader id within the participant.
- `label`: Visible control label.
- `unit`: Optional display unit.
- `min`, `max`, `step`: Numeric range.
- `defaultValue`: Initial value.
- `currentValue`: Current value reported by participant read operation.

**Validation Rules**:

- `max` must be greater than `min`.
- `step` must be positive.
- Applied values are clamped or rejected with a diagnostic outcome.

## Entity: Audio Input Source

**Purpose**: Named and availability-tracked input source for monitoring and later note detection.

**Fields**:

- `sourceId`: Stable identifier within the live session.
- `providerId`: Core or plugin participant that discovered the source.
- `kind`: `microphone`, `instrument`, `system`, `virtual`, or `unknown`.
- `channelCount`: Optional safe channel count.
- `availability`: `available`, `permission-required`, `denied`, `unavailable`, or `unknown`.
- `selected`: Whether this source is currently selected for a monitoring workflow.
- `diagnosticsPseudonym`: Per-bundle pseudonym used only inside one diagnostics export.

**Validation Rules**:

- Raw device label, path, or persistent device id is not exported.
- Source correlation across one diagnostics bundle uses pseudonyms that are not stable across exports.
- Permission-denied and unavailable states are distinct.

## Entity: Monitoring Session

**Purpose**: User-visible lifecycle for mic/instrument monitoring.

**Fields**:

- `monitoringId`: Unique live monitoring session id.
- `participantId`: Monitoring provider participant.
- `sourceId`: Selected `Audio Input Source` when known.
- `state`: `idle`, `requesting-permission`, `active`, `denied`, `unavailable`, `stopped`, or `failed`.
- `startedAt`: Optional timestamp for active sessions.
- `stoppedAt`: Optional timestamp for stopped sessions.
- `failureReason`: Redacted reason when monitoring cannot start or continue.

**State Transitions**:

- `idle` -> `requesting-permission` when user or requester starts monitoring.
- `requesting-permission` -> `active` when permission and source are available.
- `requesting-permission` -> `denied` when permission is rejected.
- `active` -> `unavailable` when the source disappears.
- `active` -> `stopped` when user or provider stops monitoring.
- Any live state -> `failed` when the provider errors unexpectedly.

## Entity: Stem Owner

**Purpose**: Exclusive owner of stem mute/restore behavior for the active session.

**Fields**:

- `ownerId`: Participant id for the active owner.
- `stemIds`: Known stem ids.
- `stemStates`: Current mute/level/default state per stem when available.
- `automationClaims`: Active `Stem Automation Claim` ids.
- `availability`: `available`, `no-owner`, `disabled`, `incompatible`, or `unknown`.

**Validation Rules**:

- At most one active non-disabled stem owner can exist for a session.
- No requester can read or write private owner state directly through the native path.

## Entity: Stem Automation Claim

**Purpose**: Temporary request to change stem state without owning that state.

**Fields**:

- `claimId`: Unique claim id.
- `requesterId`: Participant requesting automation.
- `targetStemIds`: Stems affected by the request.
- `requestedAction`: `mute`, `duck`, `restore`, or `inspect`.
- `restoreSnapshot`: Owner-controlled snapshot needed to restore user-visible behavior.
- `state`: `active`, `released`, `restored`, `overridden`, `orphaned`, or `failed`.
- `createdAt`, `updatedAt`: Lifecycle timestamps.

**State Transitions**:

- `active` -> `released` when requester releases without restore.
- `active` -> `restored` when owner restores the saved state.
- `active` -> `overridden` when a user manual action supersedes automation.
- `active` -> `orphaned` when requester or owner disappears.
- Any state -> `failed` when owner cannot apply or inspect the requested target.

## Entity: Analyser Tap

**Purpose**: Read-only access point for audio-reactive consumers.

**Fields**:

- `tapId`: Unique tap id.
- `sourceKind`: `song`, `stem-mix`, `monitoring`, or `unknown`.
- `participantId`: Consumer or provider participant.
- `availability`: `available`, `unavailable`, `conflict`, or `unknown`.
- `bridgeSource`: Existing legacy source when bridged, such as direct media element tap or Stems analyser.

**Validation Rules**:

- Read-only analyser consumers must not own playback routing.
- Singleton Web Audio limitations must be represented as unavailable/conflict availability states or redaction-safe reasons, not silent failures.

## Entity: Audio Compatibility Bridge

**Purpose**: Transitional attribution and behavior-preservation layer for legacy audio surfaces.

**Fields**:

- `bridgeId`: Unique bridge id.
- `legacySurface`: Legacy API or behavior being bridged.
- `domain`: Target audio domain.
- `status`: `supported`, `deprecated-with-warning`, `blocked-for-new-bundled-code`, or `removable`.
- `hitCount`: Count of observed legacy uses when available.
- `lastOutcome`: Latest native or bridge outcome.
- `migrationNote`: Link or identifier for plugin-author guidance.

**Validation Rules**:

- Bridge failure must be distinguishable from native capability failure.
- A bridge marked removable requires bundled migration, external usage review, migration notes, and a warning/diagnostics window.

## Entity: Audio Diagnostics Outcome

**Purpose**: Bounded support-visible result for a native or bridged audio operation.

**Fields**:

- `domain`: `audio-mix`, `audio-input`, `audio-monitoring`, or `stems`.
- `operation`: Command, provider operation, event, or bridge action.
- `participantId`: Owner, provider, requester, or observer id when known.
- `bridgeId`: Compatibility bridge id when applicable.
- `outcome`: `handled`, `denied`, `overridden`, `unsupported-command`, `no-owner`, `no-handler`, `incompatible-version`, `degraded`, or `failed`.
- `status`: Optional domain status such as `available`, `unavailable`, `disabled`, `conflict`, or `unknown` when the runtime outcome alone is not specific enough.
- `reason`: Short redacted reason.
- `timestamp`: Event time.

**Validation Rules**:

- Outcomes use the bounded capability runtime vocabulary; domain-specific statuses and reasons remain redaction-safe for diagnostics export.
- Sensitive source/device identity uses per-bundle pseudonyms only.

## Entity: Audio Migration Note

**Purpose**: Plugin-author guidance for moving from a legacy surface to the new domain path.

**Fields**:

- `legacySurface`: Existing API or behavior.
- `replacementDomain`: Target capability domain.
- `replacementPath`: Command, provider operation, event, or participant declaration.
- `compatibilityPeriod`: Current support expectation.
- `warningSignal`: Diagnostic or runtime warning behavior.
- `removalGate`: Conditions required before removal.

**Validation Rules**:

- Every covered legacy surface has a migration note before it can be marked removable.
- New bundled code may not use a deprecated legacy-only path when a replacement exists.
