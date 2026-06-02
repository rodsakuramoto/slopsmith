# Contract: Playback Control Plane

## Domain

- Capability: `playback`
- Owner: `core.playback`
- Kind: `command`
- Safety: `safe`
- Standard: `capability-pipelines.v1`

The playback domain is the authoritative control plane for song transport lifecycle, timing inspection, seek/loop coordination, route handoff summaries, request attribution, lifecycle events, compatibility bridge hits, and diagnostics.

## Ownership Boundaries

Playback owns:
- Start/pause/resume/stop/seek command outcomes.
- Playback lifecycle event normalization.
- Active playback session identity and stale-action protection.
- Redaction-safe media snapshots.
- Runtime loop state and loop lifecycle events.
- Browser/native route summaries for the active playback target.
- Compatibility bridge accounting for legacy playback surfaces.

Playback does not own:
- Audio-input source selection or permissions.
- Audio-monitoring live monitoring.
- Audio-mix faders, routes, or analyser ownership.
- Stem playback state.
- Visualization rendering.
- Note scoring or pitch detection.
- Recording capture.
- Plugin scanning or UI contribution placement.

## Public Commands

All commands return a normalized result:

```json
{
  "capability": "playback",
  "command": "inspect",
  "outcome": "handled",
  "status": "ready",
  "payload": {},
  "reason": null
}
```

Requester attribution for control commands is bound to the capability dispatch caller (`requester` / `source`). Payload-supplied `requesterId` is ignored for control attribution so a requester cannot spoof another actor. The `register-requester` and `register-observer` commands are the explicit payload-driven registration surfaces.

### `inspect`

Prompt-free read of current playback state.

**Args**:
- `includeLocalDisplay` optional boolean; local-only inspector use. Exported diagnostics ignore this flag.

**Outcomes**:
- `handled`: snapshot returned.

**Payload**: `Media Snapshot`, active session summary, loop summary, route summary, participants, bridge summaries, and bounded history summaries.

### `start`

Start a selected playback target.

**Args**:
- `target`: redaction-safe target reference; required for a fresh start.
- `arrangement`: optional arrangement reference.
- `authorization`: must be `user-action` for fresh audible starts.
- `startTime`: optional non-negative finite seconds.

**Outcomes**:
- `handled`: start accepted and session loading/playing.
- `no-target`: no valid target supplied.
- `user-action-required`: requester attempted a fresh audible start without user action.
- `unavailable`: target has no playable route.
- `failed`: transport load/play failed.
- `stale`: request was superseded before completion.
- `degraded`: start succeeded with route/media degradation.

**Rules**:
- Fresh starts from `idle`, `stopped`, or no session require explicit user action.
- Plugin requesters may not use `start` to create audible playback from idle.
- A newer start supersedes older pending starts.

### `pause`

Pause active playback.

**Args**:
- `priority`: `user` or `normal`.

**Outcomes**:
- `handled`: playback paused.
- `stopped`: session already stopped.
- `no-target`: no active session.
- `stale`: command targeted an old session.
- `failed`: route pause failed.

### `resume`

Resume an active paused session.

**Args**:
- `priority`: `user` or `normal`.
- `authorization`: `active-session` or `user-action`.

**Outcomes**:
- `handled`: playback resumed.
- `denied`: request lost to a user-priority pause/stop.
- `no-target`: no active session.
- `unavailable`: media route cannot resume.
- `failed`: route play failed.
- `stale`: command targeted an old session.

### `stop`

Stop active playback and end the current session.

**Args**:
- `priority`: `user` or `normal`.
- `reason`: bounded safe reason.

**Outcomes**:
- `stopped`: playback stopped or already stopped.
- `no-target`: no active session.
- `stale`: command targeted an old session.
- `failed`: route stop failed but session was marked degraded/stopped safely.

### `seek`

Seek within the active playback session.

**Args**:
- `time`: requested seconds.
- `priority`: `user` or `normal`.
- `reason`: bounded short reason.

**Outcomes**:
- `handled`: seek completed.
- `cancelled`: seek cancelled by teardown or superseding session.
- `stale`: seek targeted an old session.
- `failed`: route seek failed.
- `no-target`: no active session.
- `unsupported-command`: route does not support seek.

**Payload status**:
- `completed`, `clamped`, `rolled-back`, `cancelled`, `stale`, or `failed`.
- Includes requested time, from time when known, and landed time when known.

### `set-loop`

Set the active runtime loop.

**Args**:
- `startTime`: finite seconds.
- `endTime`: finite seconds greater than start.
- `priority`: `user` or `normal`.

**Outcomes**:
- `handled`: loop set.
- `failed`: validation or seek failed.
- `cancelled`: loop-set seek cancelled.
- `stale`: target changed before commit.
- `no-target`: no loaded session.

**Rules**:
- The loop is committed only after seek-to-start succeeds and lands within tolerance.
- Invalid loop boundaries do not mutate existing loop state.

### `clear-loop`

Clear the active runtime loop.

**Args**:
- `priority`: `user` or `normal`.

**Outcomes**:
- `handled`: loop cleared or already inactive.
- `stale`: target changed before command completed.

## Request Priority

Priority order:
1. Explicit user actions.
2. Core controls acting on behalf of the user.
3. Plugin/automation/compatibility requesters.

Rules:
- User actions override plugin or automation requests for the same session.
- Within the same priority, latest non-stale request wins.
- Losing requests receive `denied`, `stale`, `cancelled`, or `overridden` status as appropriate.

## Route Changes

Route changes are represented as playback lifecycle updates, not separate ownership transfers.

Rules:
- Preserve session identity and current time when handoff is safe.
- Suppress duplicate legacy `song:play` or `song:pause` events during transparent handoff.
- If safe handoff fails, pause playback and report `degraded` with a bounded reason.
- Never expose route-private objects, local paths, or native handles.

## Lifecycle Events

The owner emits capability events and may bridge legacy `window.slopsmith` events during migration.

Playback events:
- `playback:requested`
- `playback:loading`
- `playback:ready`
- `playback:started`
- `playback:paused`
- `playback:resumed`
- `playback:seeking`
- `playback:seeked`
- `playback:ended`
- `playback:stopped`
- `playback:unavailable`
- `playback:degraded`
- `playback:failed`
- `playback:superseded`
- `playback:route-changing`
- `playback:route-changed`
- `playback:bridge-hit`

Loop events:
- `playback:loop-set`
- `playback:loop-cleared`
- `playback:loop-restarted`
- `playback:loop-rejected`
- `playback:loop-stale`

Legacy event compatibility:
- Existing `song:loading`, `song:play`, `song:pause`, `song:resume`, `song:seek`, `song:ended`, `song:arrangement-changed`, `arrangement:changed`, `loop:restart`, and `song:position-changed` remain during migration.
- Legacy events should be recorded as bridge hits when they drive or observe playback behavior through old surfaces.

## Compatibility Bridge IDs

Recommended bridge ids:
- `playback.window-play-song`
- `playback.song-events`
- `playback.window-slopsmith-transport`
- `playback.loop-api`
- `playback.media-snapshot`
- `playback.audio-element-shim`
- `playback.native-route-shim`

Bridge hits must be bounded and redaction-safe.
