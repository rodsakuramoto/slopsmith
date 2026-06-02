# Data Model: Playback Control Plane

## Playback Session

Coordinator-owned record for the current or most recent song playback lifecycle.

**Fields**:
- `sessionId`: safe opaque id for the playback lifecycle.
- `sequence`: monotonic number used to detect stale completions.
- `state`: one of `idle`, `loading`, `ready`, `playing`, `paused`, `seeking`, `ended`, `stopped`, `unavailable`, `degraded`, `failed`.
- `target`: `Playback Target` or null.
- `transport`: `Transport State` summary.
- `media`: `Media Snapshot` summary.
- `route`: `Playback Route Summary`.
- `loop`: current `Loop Region` or inactive summary.
- `participants`: redaction-safe requester/observer summaries.
- `history`: bounded `Playback Diagnostic History`.
- `createdAt`, `updatedAt`, `stoppedAt`: ISO timestamps.

**Validation rules**:
- At most one active user-visible playback session exists.
- Stale completions MUST NOT mutate a newer session.
- Raw media handles, audio elements, native handles, URLs with secrets, local paths, raw filenames, buffers, samples, waveform data, and recordings are never stored.

**State transitions**:
- `idle -> loading -> ready -> playing` for a successful user-authorized start.
- `playing -> paused -> playing` for pause/resume.
- `playing|paused -> seeking -> playing|paused` for seek completion.
- `playing -> ended` for natural completion.
- `playing|paused|seeking|ready -> stopped` for user stop or player teardown.
- Any active state may become `degraded`, `unavailable`, or `failed` with a bounded reason.
- Newer starts supersede older starts; older completions become `stale` outcomes.

## Playback Target

Redaction-safe reference to what playback should load or control.

**Fields**:
- `targetId`: stable pseudonymous id for exported diagnostics.
- `sourceKind`: `local`, `sloppak`, `psarc`, `plugin`, or `unknown`.
- `arrangementRef`: redaction-safe arrangement index/id/name summary.
- `format`: redaction-safe format summary when known.
- `requestedBy`: requester id that initiated or selected the target.
- `localDisplay`: optional local-only title/artist/arrangement metadata for inspector views.

**Validation rules**:
- Exported diagnostics include `targetId` but not title, artist, arrangement display text, raw filenames, DLC paths, or local URLs.
- Local inspector may show metadata already visible in the app.

## Playback Requester

User action, core control, plugin, or compatibility-backed path that asks to inspect playback or perform a permitted action.

**Fields**:
- `requesterId`: stable id such as `core.player.controls`, plugin id, or compatibility surface id.
- `kind`: `user`, `core`, `plugin`, `automation`, or `compatibility`.
- `priority`: `user` or `normal`.
- `authorization`: `user-action`, `active-session`, `background`, or `none`.
- `status`: `available`, `disabled`, `unavailable`, `incompatible`, or `unknown`.
- `lastSeenAt`, `lastActionAt`: timestamps.

**Validation rules**:
- Fresh audible starts from `idle`, `stopped`, or `no-session` require `authorization: user-action`.
- Plugins may inspect, observe, and request permitted controls for active sessions.
- Rehydrating the same requester updates metadata without duplicating participant records.

## Playback Observer

Participant that watches playback lifecycle events without owning transport.

**Fields**:
- `observerId`: stable id.
- `kind`: `core`, `plugin`, or `compatibility`.
- `observes`: lifecycle event names.
- `status`: availability summary.
- `lastSeenAt`, `lastEventAt`: timestamps.

**Validation rules**:
- Observers receive redaction-safe payloads only.
- Observer failures or incompatibility do not block core playback.
- Rehydration is idempotent.

## Transport State

User-visible playback phase and timing intent.

**Fields**:
- `state`: `idle`, `loading`, `ready`, `playing`, `paused`, `seeking`, `ended`, `stopped`, `unavailable`, `degraded`, or `failed`.
- `isPlaying`: boolean.
- `isSeeking`: boolean.
- `readiness`: `idle`, `loading`, `ready`, `unavailable`, `failed`, or `unknown`.
- `requesterId`: last accepted requester.
- `priority`: accepted request priority.
- `reason`: bounded safe reason.
- `updatedAt`: timestamp.

**Validation rules**:
- Ended and stopped are distinct.
- Inactive-session pause/resume/stop/seek requests return explicit outcomes without ambiguous mutation.

## Media Snapshot

Redaction-safe summary of current media and clock state.

**Fields**:
- `targetId`: pseudonymous target id or null.
- `currentTime`: current playback time when known.
- `duration`: duration when known.
- `playbackRate`: current rate when known.
- `chartTime`: chart/highway time when known.
- `mediaTime`: media route time when known.
- `timeUncertainty`: `none`, `route-changing`, `seeking`, `stalled`, `unknown`.
- `readiness`: readiness summary.
- `route`: route summary.
- `loop`: loop summary.

**Validation rules**:
- Snapshot is prompt-free and must not expose private globals or raw media handles.
- Timing is stable during pause, seek, route change, and media stall states.

## Seek Request

Normalized record of a repositioning request.

**Fields**:
- `seekId`: safe opaque id.
- `sessionId`: target session.
- `requesterId`: requester attribution.
- `requestedTime`: requested seconds.
- `fromTime`: time before seek when known.
- `landedTime`: verified post-seek time when known.
- `status`: `completed`, `clamped`, `cancelled`, `rolled-back`, `stale`, or `failed`.
- `reason`: bounded safe reason, such as `seek-by`, `loop-set`, `loop-wrap`, `arrangement-restore`, or compatibility surface.
- `createdAt`, `completedAt`: timestamps.

**Validation rules**:
- Non-finite and negative targets are rejected or clamped explicitly.
- A seek whose session no longer matches current playback is `stale` and does not mutate current state.
- Landed time comes from the verified post-seek clock, not the requested value.

## Loop Region

Playback-domain timing constraint.

**Fields**:
- `loopId`: safe opaque id for the active runtime loop.
- `sessionId`: session target.
- `startTime`: loop start seconds.
- `endTime`: loop end seconds.
- `enabled`: boolean.
- `requesterId`: requester attribution.
- `state`: `inactive`, `active`, `restarting`, `cleared`, `rejected`, or `stale`.
- `lastRestartAt`: timestamp.
- `reason`: bounded safe reason when rejected/stale.

**Validation rules**:
- `endTime` must be greater than `startTime`.
- Boundaries must be finite and inside playable duration when duration is known.
- Failed or off-target loop-set seeks do not mutate the current loop.
- Target changes make previous loop state stale.

## Playback Route Summary

Redaction-safe summary of the current playback route.

**Fields**:
- `routeId`: stable pseudonymous route id for exported diagnostics.
- `routeKind`: `browser-media`, `desktop-native`, `fallback`, or `unknown`.
- `state`: `active`, `switching`, `degraded`, `unavailable`, or `failed`.
- `preservedTime`: boolean or null.
- `safeReason`: bounded reason.
- `lastChangedAt`: timestamp.

**Validation rules**:
- Route-private objects, platform identifiers, local paths, and native handles are excluded.
- Safe route changes preserve `sessionId` and current time; unsafe handoff pauses and reports degraded.

## Playback Outcome

Bounded diagnostic result of a playback operation.

**Fields**:
- `operation`: `start`, `pause`, `resume`, `stop`, `seek`, `inspect`, `set-loop`, `clear-loop`, `route-change`, or compatibility operation.
- `outcome`: `handled`, `denied`, `degraded`, `failed`, `no-owner`, `no-handler`, `no-target`, `unsupported-command`, `incompatible-version`, `unavailable`, `stale`, `cancelled`, or `stopped`.
- `status`: operation-specific status.
- `sessionId`, `targetId`, `requesterId`: safe references.
- `reason`: bounded safe reason.
- `createdAt`: timestamp.

**Validation rules**:
- Outcomes are normalized before diagnostics or inspector rendering.
- Reasons are redacted and bounded.

## Playback Diagnostic History

Bounded recent per-session context for support.

**Fields**:
- `sessionId`: session reference.
- `recentOutcomes`: newest-first or oldest-first bounded list.
- `lifecycleEvents`: bounded lifecycle summary list.
- `droppedCounts`: counts of trimmed outcomes/events.
- `updatedAt`: timestamp.

**Validation rules**:
- History is bounded per session and globally trimmed to fit capability diagnostics budget.
- Full unbounded app-session history is not retained.

## Compatibility Bridge Hit

Record that a legacy playback integration surface ran during migration.

**Fields**:
- `bridgeId`: stable id.
- `legacySurface`: e.g. `window.playSong`, `song:event`, `window.slopsmith.seek`, `window.slopsmith.setLoop`, `audio-element-shim`, `media-snapshot`.
- `source`: requester/observer/plugin/core surface id when known.
- `hitCount`: bounded count.
- `lastHitAt`: timestamp.
- `status`: `active`, `superseded`, `overshadowed`, or `removed`.
- `reason`: bounded safe reason.

**Validation rules**:
- Bridge hits show observed legacy behavior, not just declared compatibility.
- Native playback-domain participation must not duplicate the same user-visible transport action.
