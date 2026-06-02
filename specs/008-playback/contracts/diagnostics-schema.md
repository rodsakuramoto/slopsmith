# Contract: Playback Diagnostics Schema

## Schema

Playback diagnostics are contributed under a versioned schema:

```json
{
  "schema": "slopsmith.playback.diagnostics.v1",
  "domain": "playback",
  "generatedAt": "2026-05-31T00:00:00.000Z",
  "exportMode": "exported",
  "state": {},
  "participants": [],
  "bridges": [],
  "history": {}
}
```

`exportMode` may be:
- `exported`: diagnostics bundle payload. Must use pseudonymous target identity only.
- `local-inspector`: local support view. May include user-visible title, artist, and arrangement already shown in the app.

## Top-Level Fields

- `schema`: `slopsmith.playback.diagnostics.v1`.
- `domain`: `playback`.
- `generatedAt`: ISO timestamp.
- `exportMode`: `exported` or `local-inspector`.
- `state`: current playback session and media snapshot.
- `participants`: bounded requester/observer summaries.
- `bridges`: bounded compatibility bridge summaries.
- `history`: bounded recent per-session diagnostic history.
- `redaction`: summary of redaction and trim status.

## State Payload

```json
{
  "sessionId": "playback-1",
  "state": "playing",
  "target": {
    "targetId": "target-a1b2",
    "sourceKind": "sloppak",
    "arrangementRef": "arrangement-1"
  },
  "transport": {
    "state": "playing",
    "readiness": "ready",
    "isPlaying": true,
    "isSeeking": false
  },
  "media": {
    "currentTime": 42.3,
    "duration": 184.1,
    "playbackRate": 1,
    "chartTime": 42.3,
    "mediaTime": 42.3,
    "timeUncertainty": "none"
  },
  "route": {
    "routeId": "route-browser-1",
    "routeKind": "browser-media",
    "state": "active",
    "preservedTime": true
  },
  "loop": {
    "state": "active",
    "startTime": 32,
    "endTime": 48,
    "enabled": true
  }
}
```

## Export Redaction Rules

Exported diagnostics MUST NOT contain:
- Song title, artist, album, arrangement display text, or other raw library identity.
- DLC paths, local paths, raw filenames, or raw source URLs.
- Secret-bearing URLs or query parameters.
- `HTMLAudioElement`, `AudioNode`, `MediaStream`, native handles, route-private objects, or platform route identifiers.
- Audio buffers, samples, waveforms, recordings, FFT arrays, or raw media payloads.
- Plugin-private objects or provider-private route payloads.

Exported diagnostics MUST contain:
- Stable pseudonymous playback target ids.
- Safe route kind/status summaries.
- Safe operation outcomes and bounded reasons.
- Trim counts when histories are truncated.

Local inspector MAY contain:
- User-visible title, artist, and arrangement already visible in the app.
- Local-only display labels for current player context.

Local inspector still MUST NOT contain raw paths, secret URLs, handles, audio buffers, samples, waveforms, recordings, or route-private objects.

## History Bounds

Recommended caps:
- Current session: up to 50 recent outcomes and 50 lifecycle summaries.
- Recent stopped sessions: up to 5 session summaries, each with up to 20 recent outcomes/events.
- Global playback diagnostics must fit inside the existing capability diagnostics snapshot budget; trim oldest history first.

When trimming, preserve:
- Current session state.
- Current media snapshot.
- Active loop state.
- Current route status.
- Current participants.
- Current bridge hit counts.
- Counts of dropped outcomes/events.

## Bridge Summary

```json
{
  "bridgeId": "playback.window-play-song",
  "legacySurface": "window.playSong",
  "source": "plugin.example",
  "hitCount": 3,
  "lastHitAt": "2026-05-31T00:00:00.000Z",
  "status": "active",
  "reason": "legacy wrapper observed"
}
```

Rules:
- `source` is a safe requester/observer/plugin id when known.
- `hitCount` is bounded.
- `reason` is bounded and redacted.
- Bridge entries record observed use, not merely declared compatibility.

## Outcome Summary

```json
{
  "operation": "seek",
  "outcome": "handled",
  "status": "completed",
  "sessionId": "playback-1",
  "targetId": "target-a1b2",
  "requesterId": "core.player.controls",
  "requestedTime": 42,
  "landedTime": 42.01,
  "reason": "seek-by",
  "createdAt": "2026-05-31T00:00:00.000Z"
}
```

Rules:
- Reasons are <= 240 characters after redaction.
- Unknown requesters use a safe fallback such as `unknown`.
- Stale/cancelled requests retain enough safe context to explain why state did not change.
