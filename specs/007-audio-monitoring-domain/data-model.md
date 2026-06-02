# Data Model: Audio Monitoring Control Plane

## Monitoring Provider

Represents a participant that can start, stop, or report status for a live monitoring path.

**Fields**:
- `providerId`: stable runtime id, unique within the monitoring domain.
- `ownerPluginId`: plugin/core id that owns the provider.
- `label`: redaction-safe display label.
- `sourceMode`: `native`, `compatibility`, or `core`.
- `compatibilitySource`: optional legacy surface name for diagnostics.
- `logicalMonitoringKey`: stable redaction-safe key used for duplicate suppression.
- `availability`: `available`, `pending`, `unavailable`, `disabled`, `denied`, `failed`, `incompatible`, or `unknown`.
- `operations`: supported operations such as `monitoring.start`, `monitoring.stop`, and `monitoring.status`.
- `operationHandlers`: runtime-only provider functions; excluded from diagnostics.
- `directMonitor`: provider capability summary with `control`, `state`, `reason`, and `lastChangedAt`.
- `latencySummary`: optional bounded latency bucket/value supplied by provider.
- `reason`: bounded safe reason for unavailable, degraded, denied, or failed state.
- `registeredAt`, `lastSeenAt`, `lastChangedAt`: ISO timestamps.
- `supersededBy`: provider id that owns the visible native representation when compatibility duplicates exist.

**Relationships**:
- Has zero or more `Monitoring Session` records.
- May be the `Selected Monitoring Provider`.
- May produce `Monitoring Outcome` records and `Compatibility Bridge Hit` records.

**Validation rules**:
- `providerId` and `logicalMonitoringKey` are required.
- `operationHandlers` must never appear in diagnostics snapshots.
- Raw device labels, paths, native handles, audio nodes, and streams are rejected or stripped from provider summaries.
- Native providers supersede compatibility providers with the same `logicalMonitoringKey`.

## Selected Monitoring Provider

Represents the user's chosen/default provider for future starts.

**Fields**:
- `providerId`: current effective provider id when available.
- `logicalMonitoringKey`: persisted redaction-safe key.
- `availability`: current availability of the resolved provider.
- `restored`: whether the value came from persisted preference.
- `restoreStatus`: `available`, `restored`, `missing-provider`, `unavailable`, `disabled`, or `failed`.
- `selectedAt`, `lastSelectedAt`, `lastRestoredAt`: ISO timestamps.
- `requesterId`: actor that selected it, usually `user` or a UI surface.

**Relationships**:
- Resolves to one visible `Monitoring Provider` when available.
- Used by `Monitoring Start Authorization` when the start payload omits a provider.

**Validation rules**:
- If exactly one compatible provider exists, it can be treated as the effective default without writing a user preference.
- If multiple compatible providers exist and no selected/default provider exists, start returns `provider-selection-required`.
- Persistence stores only logical keys and safe ids, never raw device identity.

## Monitoring Requester

Represents a user action, plugin, or feature that needs monitoring active.

**Fields**:
- `requesterId`: sanitized id for attribution.
- `source`: capability dispatch source or plugin id.
- `purpose`: bounded safe purpose string.
- `requiredChannelShape`: optional `mono`, `stereo`, `multi`, or `unknown`.
- `directMonitorRequirement`: optional `muted`, `unmuted`, `none`, or `unknown`.
- `authorization`: `user-action`, `attach-existing`, or `background`.
- `requestedAt`: ISO timestamp.

**Relationships**:
- Belongs to a `Monitoring Session` while active.
- May create `Monitoring Outcome` records.

**Validation rules**:
- Requester ids are normalized to a short safe token.
- Fresh starts with `authorization: background` return `user-action-required` unless attaching to an already active compatible session.
- Requester requirements cannot override the user/default direct-monitor setting.

## Monitoring Start Authorization

Represents whether a start request is allowed to activate live monitoring.

**Fields**:
- `mode`: `user-action`, `attach-existing`, or `background`.
- `isFreshStart`: true when no compatible active session exists.
- `compatibleSessionId`: active session id when attaching.
- `outcome`: `allowed`, `attached`, or `user-action-required`.
- `reason`: bounded safe reason.

**Relationships**:
- Evaluated before provider `monitoring.start` is called.
- Creates a `Monitoring Outcome` when denied or attached.

**Validation rules**:
- Fresh starts require explicit user action.
- Attachments are allowed only when provider, source reference, channel requirement, and direct-monitor policy are compatible.
- Authorization checks must not trigger input permission prompts.

## Monitoring Session

Coordinator-owned record for an active, degraded, stopped, unavailable, denied, failed, or orphaned monitoring path.

**Fields**:
- `monitoringId`: unique session id.
- `sessionKey`: deterministic key from provider, selected source, channel shape, and direct-monitor policy.
- `providerId`, `logicalMonitoringKey`: provider attribution.
- `sourceRef`: selected source reference from audio-input, including `logicalSourceKey`, `sourceId`, and `providerId` when known.
- `openInputSessionId`: optional audio-input open session id.
- `state`: `active`, `degraded`, `stopped`, `unavailable`, `denied`, `failed`, `orphaned`, or `unknown`.
- `requesters`: list of requester refs.
- `directMonitor`: direct-monitor state summary.
- `latencySummary`: optional provider-supplied bounded summary.
- `reason`: bounded safe reason.
- `startedAt`, `lastUsedAt`, `stoppedAt`, `updatedAt`: ISO timestamps.

**Relationships**:
- References one `Monitoring Provider`.
- References one selected source/open session from `audio-input`.
- Owns many `Monitoring Requester` references.

**Validation rules**:
- Compatible requesters share an existing session instead of creating another provider start.
- Provider stop is called only after the final requester releases the session.
- Session summaries must never include live audio handles or raw provider payloads.

**State transitions**:
- `unknown` -> `active`: provider start handled.
- `unknown` -> `degraded`: provider start handled with non-blocking degradation.
- `unknown` -> `denied`/`unavailable`/`failed`: provider or input readiness blocks start.
- `active` -> `degraded`: provider reports high latency, unsupported direct-monitor control, or partial non-critical routing.
- `active`/`degraded` -> `stopped`: final requester stops or user explicitly stops.
- `active`/`degraded` -> `unavailable`/`orphaned`: provider disappears, is disabled, or becomes incompatible.
- `stopped` -> `active`: only after a new explicit user-authorized start.

## Selected Source Reference

Redaction-safe source reference owned by `audio-input` and consumed by monitoring.

**Fields**:
- `logicalSourceKey`: persisted redaction-safe source key.
- `sourceId`: current source id when known.
- `providerId`: input provider id when known.
- `availability`: current source availability.
- `channelSummary`: safe channel shape/count summary.
- `openSessionId`: optional currently opened input session id.

**Relationships**:
- Resolved by `audio-input` during monitoring start/status.
- Included in `Monitoring Session` and `Monitoring Outcome` summaries.

**Validation rules**:
- Monitoring never owns source identity or selection.
- Missing input readiness or no usable selected source is a blocking failure/unavailable outcome, not a degraded active session.

## Direct Monitoring State

Represents whether dry input is audible directly, muted, unsupported, unavailable, or unknown.

**Fields**:
- `state`: `muted`, `unmuted`, `unsupported`, `unavailable`, or `unknown`.
- `control`: `supported`, `unsupported`, `unavailable`, or `unknown`.
- `preference`: user/default desired state, `muted` or `unmuted` when set.
- `applied`: whether the provider reports the preference is applied.
- `reason`: bounded safe reason.
- `lastChangedAt`: ISO timestamp.

**Relationships**:
- Stored/reported as part of `Monitoring Provider` and `Monitoring Session`.
- Compared against `Direct Monitoring Requirement` during starts/inspection.

**Validation rules**:
- User/default preference is authoritative.
- Unsupported control may produce degraded status while monitoring remains active.
- Direct-monitor state changes while stopped update preference/status but do not start monitoring.

## Direct Monitoring Requirement

Requester-declared constraint for dry input state.

**Fields**:
- `requesterId`: requester attribution.
- `requiredState`: `muted`, `unmuted`, or `none`.
- `strict`: whether unmet requirement should be `unsupported` rather than `degraded`.
- `reason`: bounded safe purpose.

**Relationships**:
- Evaluated against `Direct Monitoring State` during start/inspect.
- Produces `Monitoring Outcome` or per-requester degraded/unsupported status when unmet.

**Validation rules**:
- Requirements do not mutate the selected user/default direct-monitor preference.
- Conflicts are reported to the requester and diagnostics.

## Monitoring Outcome

Bounded record of a monitoring operation.

**Fields**:
- `domain`: always `audio-monitoring`.
- `operation`: `inspect`, `register-provider`, `unregister-provider`, `select-provider`, `start`, `stop`, `status`, or `set-direct-monitor`.
- `providerId`, `monitoringId`, `requesterId`: attribution fields when known.
- `logicalSourceKey`, `sourceId`, `openInputSessionId`: safe source/session references when known.
- `outcome`: normalized outcome.
- `status`: provider/session state.
- `reason`: bounded safe reason.
- `timestamp`: ISO timestamp.

**Relationships**:
- Recent outcomes appear in audio-session diagnostics.
- Refer to providers, sessions, requesters, source refs, and bridge hits.

**Validation rules**:
- Outcomes are capped to the existing recent-outcome budget.
- Reasons are redacted and length-bounded.
- `denied`, `unavailable`, `degraded`, `failed`, `incompatible`, `incompatible-version`, `provider-selection-required`, and `user-action-required` remain distinct.

## Compatibility Bridge Hit

Record that a legacy monitoring path was observed during migration.

**Fields**:
- `bridgeId`: e.g. `audio-monitoring.audio-barrier` or future monitoring-specific bridge id.
- `legacySurface`: redaction-safe surface name.
- `participantId`/`providerId`: attribution.
- `operation`: `start`, `stop`, `status`, `direct-monitor`, or `readiness`.
- `outcome`, `status`, `reason`: bounded state.
- `timestamp`: ISO timestamp.

**Relationships**:
- Appears under `domains['audio-monitoring'].bridges` in diagnostics.
- May be linked to a `Monitoring Provider` when a native provider supersedes the legacy path.

**Validation rules**:
- Bridge hits are diagnostics-only when a native provider owns the same logical path.
- Bridge payloads must not contain raw device labels, local paths, or live objects.

## Blocking Monitoring Failure

A condition that prevents monitoring from becoming active.

**Examples**:
- No selected/usable input source.
- Input permission denied.
- No usable output path.
- Missing compatible provider when required.
- Provider start failure or malformed provider response.

**Validation rules**:
- Blocking failures return `failed`, `denied`, `unavailable`, `no-owner`, `no-handler`, `incompatible`, `incompatible-version`, `provider-selection-required`, or `user-action-required` as appropriate.
- Blocking failures do not create an active degraded session.

## Non-Blocking Monitoring Degradation

A condition where monitoring can still become active but with degraded status.

**Examples**:
- High latency summary.
- Unsupported direct-monitor control.
- Partial non-critical routing.

**Validation rules**:
- Degraded status is allowed only when input and output are usable and the player can hear a valid monitoring path.
- Degradation reason must be bounded and safe for diagnostics.
