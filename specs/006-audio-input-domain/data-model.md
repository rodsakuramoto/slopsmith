# Data Model: Audio Input Control Plane

## Audio Input Source

Provider-owned input option such as a browser microphone, desktop/native device, plugin stream, or virtual source.

Fields:

- `sourceId`: provider-supplied runtime identifier that MUST be globally unique across providers — it is the registry key, so a provider must namespace it (e.g. prefix with its provider id); registering a `sourceId` already owned by another provider is rejected. Required for commands but redacted/pseudonymized in diagnostics. The stable cross-provider handle is `logicalSourceKey`.
- `logicalSourceKey`: provider-supplied redaction-safe key used for restore, repeated hydration, and native/legacy duplicate suppression. Required.
- `providerId`: participant/provider id that owns enumeration and open/close operations. Required.
- `kind`: bounded source type such as `instrument`, `microphone`, `desktop`, `plugin`, `virtual`, or `unknown`.
- `label`: redaction-safe display label or pseudonym. Raw device labels are not stored in diagnostics.
- `channelSummary`: redaction-safe channel metadata.
- `availability`: `available`, `pending`, `unavailable`, `disabled`, `denied`, `failed`, or `incompatible`.
- `selected`: whether this source matches the current selected logical source.
- `sourceMode`: `native`, `compatibility`, or `core`.
- `compatibilitySource`: legacy surface name when compatibility-backed.
- `supersededBy`: the winning source's `sourceId` (not a providerId) when this compatibility-backed source is hidden from user-visible lists; pseudonymized alongside other source ids in diagnostics.
- `reason`: bounded redaction-safe reason when unavailable, denied, failed, degraded, or incompatible.
- `registeredAt`, `lastSeenAt`, `lastChangedAt`: timestamps for hydration and diagnostics.

Validation rules:

- Registration without `sourceId`, `providerId`, or `logicalSourceKey` returns `failed` or `denied` with a safe reason.
- Incompatible contract versions return `incompatible-version` and do not become active sources.
- Native sources win over compatibility-backed sources with the same `logicalSourceKey`; legacy records remain diagnostic-only.
- Raw device labels, stable hardware ids, local paths, secrets, and native platform identifiers are rejected, redacted, or replaced with pseudonyms before diagnostics.

## Input Provider

Participant that can enumerate, describe, open, or close one or more sources.

Fields:

- `providerId`: stable runtime participant id.
- `ownerPluginId`: plugin or core owner id.
- `label`: redaction-safe provider label.
- `sourceMode`: `native`, `compatibility`, or `core`.
- `operations`: subset of `source.enumerate`, `source.describe`, `source.open`, `source.close`.
- `operationHandlers`: private runtime callbacks, never included in diagnostics.
- `availability`: provider-level `available`, `pending`, `unavailable`, `disabled`, `failed`, or `incompatible`.
- `version`: audio-input contract version.

Relationships:

- One provider owns many `Audio Input Source` records.
- One provider may own one active provider-side capture session for each open input session key.

Validation rules:

- Providers that expose open/close must settle through explicit `handled`, `denied`, `degraded`, `failed`, `no-handler`, or `incompatible-version` outcomes.
- Provider callbacks may return state and safe metadata, but never live stream or audio-node handles in command payloads.

## Selected Input

The user's current preferred input source, stored by logical source key.

Fields:

- `logicalSourceKey`: selected source key. Required when a selection exists.
- `sourceId`: current provider-scoped source id when a matching source is registered.
- `providerId`: current provider id when known.
- `availability`: current selected-source availability.
- `restored`: true when restored from persisted preference in the current app load.
- `restoreStatus`: `restored`, `missing-provider`, `not-selected`, or the selected source's current availability when it isn't simply `available` (`available`, `unavailable`, `pending`, `denied`, `disabled`, `incompatible`, `failed`). Storage availability is tracked separately on the snapshot's `storageStatus` field (`available` / `unavailable` / `failed`).
- `lastSelectedAt`, `lastRestoredAt`: timestamps.

State transitions:

- `not-selected` -> `available`: user selects a registered available source.
- `not-selected` -> `unavailable`: persisted key exists but no provider has registered it yet.
- `available` -> `unavailable`: selected source disappears or provider reports unavailable.
- `unavailable` -> `available`: same logical key reappears.
- Any state -> `not-selected`: user clears selection, if such UI is later added.

Rules:

- App reload may restore the same logical key, but must not silently select a different source.
- If preference storage is unavailable, the current session can still select a source but the snapshot reports `storageStatus: unavailable` (or `failed` when a write throws).

## Channel Summary

Redaction-safe metadata about usable channel shape.

Fields:

- `channelCount`: numeric count when known.
- `channelShape`: bounded value such as `mono`, `stereo`, `multi`, or `unknown`.
- `supports`: optional bounded list of supported shapes.
- `defaultShape`: provider-safe default shape when known.
- `reason`: safe reason for incompatible or unknown channel state.

Rules:

- Channel summary informs compatibility but is not a separate user-selected device.
- Requesters declare required channel shape at open/start time.

## Input Requester

Consumer such as note detection, monitoring, recording, or plugin workflow that needs current input state.

Fields:

- `requesterId`: stable requester/plugin id.
- `requestedChannelShape`: optional required channel shape for open/start.
- `purpose`: bounded safe purpose such as `monitoring`, `note-detection`, `recording`, or `diagnostic`.
- `openedAt`, `releasedAt`: timestamps when participating in an open input session.

Rules:

- Requesters can inspect selected source and channel summary in one step without opening live input.
- Requesters do not receive raw handles through audio-input command payloads.

## Open Input Session

Coordinator-owned record for an opened source plus compatible channel shape.

Fields:

- `openSessionId`: coordinator id, derived from selected logical key plus normalized channel shape or generated as a safe opaque id.
- `logicalSourceKey`: selected source key.
- `sourceId`: current provider-scoped source id.
- `providerId`: source provider id.
- `channelShape`: normalized channel shape for this session.
- `state`: `opening`, `open`, `closing`, `closed`, `denied`, `unavailable`, `failed`, or `incompatible`.
- `requesters`: list of safe requester references.
- `openedAt`, `lastUsedAt`, `closedAt`: timestamps.
- `reason`: bounded safe reason for non-open states.

State transitions:

- `none` -> `opening`: first requester opens selected source.
- `opening` -> `open`: provider reports success.
- `opening` -> `denied`/`unavailable`/`failed`/`incompatible`: provider or compatibility check fails.
- `open` -> `open`: compatible requester joins; requester reference is added.
- `open` -> `closing`: last requester releases.
- `closing` -> `closed` or `failed`: provider close settles.
- `open` -> `unavailable`/`failed`: provider reports loss while active.

Rules:

- Compatible requesters share one open session.
- Incompatible channel requirements return `incompatible` and do not change selected source.
- Provider close is called only after the last requester releases.
- No live stream, audio node, native handle, raw buffer, sample data, or waveform data is stored in this entity.

## Permission State

User-visible and diagnostic state for input access.

Fields:

- `state`: `not-requested`, `pending`, `granted`, `denied`, `revoked`, `unavailable`, or `failed`.
- `providerId`, `sourceId`, `logicalSourceKey`: safe identifiers where applicable.
- `lastPromptedAt`: timestamp only after explicit open/start flow.
- `reason`: bounded redaction-safe reason.

Rules:

- Inspect, listing, and selection must not trigger permission prompts.
- Denied, unavailable, and failed remain distinct outcomes.

## Compatibility Bridge Hit

Record that a legacy input handoff or source-selection surface was used during migration.

Fields:

- `bridgeId`: e.g. `audio-input.legacy-source`.
- `legacySurface`: bounded legacy surface name.
- `participantId`: provider/requester/source id when safe.
- `logicalSourceKey`: safe logical key when known.
- `outcome`: `handled`, `degraded`, `overridden`, `failed`, or related explicit outcome.
- `status`: `used`, `compatibility-backed`, `overshadowed`, or failure status.
- `hitCount`, `lastHitAt`, `reason`: bounded diagnostics.

## Input Outcome

Bounded diagnostic record for input operations.

Fields:

- `domain`: `audio-input`.
- `operation`: command, provider operation, or event name.
- `providerId`, `sourceId`, `logicalSourceKey`, `requesterId`, `openSessionId`: safe identifiers when applicable.
- `outcome`: `handled`, `denied`, `degraded`, `failed`, `no-owner`, `no-handler`, `unsupported-command`, `overridden`, or `incompatible-version`.
- `status`: bounded operation state.
- `reason`: redaction-safe reason capped to a short length.
- `timestamp`: ISO timestamp.

Rules:

- Recent outcomes are capped and oldest records are trimmed first.
- Outcomes never include live handles, raw audio, raw labels, stable hardware ids, local paths, or secrets.