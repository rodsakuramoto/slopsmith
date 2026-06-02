# Contract: Audio Monitoring Control Plane

## Domain Owner

- Capability: `audio-monitoring`
- Owner: `core.audio.session`
- Safety: `sensitive`
- Owner kind: `provider-coordinator`
- Runtime file: `static/capabilities/audio-session.js`

The owner coordinates monitoring lifecycle and diagnostics. Providers own actual live input, output, native handles, streams, AudioNodes, effect chains, and platform APIs.

## Stable Commands

### `inspect`

Prompt-free state inspection. Must not enumerate devices, open input, start monitoring, trigger permission prompts, or call provider start handlers.

**Request payload**:

```json
{
  "providerId": "desktop_audio",
  "logicalMonitoringKey": "desktop:main",
  "includeProviders": true,
  "includeSessions": true
}
```

All fields are optional.

**Handled response payload**:

```json
{
  "providers": [],
  "selectedProvider": null,
  "sessions": [],
  "totalProviders": 0,
  "totalSessions": 0,
  "directMonitor": { "state": "unknown", "control": "unknown" },
  "bridges": []
}
```

### `start`

Requests live monitoring. A fresh start requires explicit user action. A background/plugin requester may attach to an already active compatible session.

**Request payload**:

```json
{
  "providerId": "desktop_audio",
  "logicalMonitoringKey": "desktop:main",
  "requesterId": "note_detect",
  "purpose": "note-detection",
  "sourceRef": {
    "logicalSourceKey": "desktop:instrument:primary",
    "sourceId": "input-source-1"
  },
  "requiredChannelShape": "mono",
  "directMonitorRequirement": "muted",
  "authorization": "user-action"
}
```

**Rules**:
- `authorization: "user-action"` is required for fresh starts.
- Omitted provider resolves through the selected/default provider policy.
- Omitted source resolves through the selected input source from `audio-input`.
- Missing input readiness or no usable output path returns a blocking outcome.
- High latency, unsupported direct-monitor control, or partial non-critical routing may return active `degraded`.
- Provider `monitoring.start` handlers receive only safe source/session summaries, not live handles from other providers.

**Successful handled payload**:

```json
{
  "monitoringId": "monitoring-1",
  "providerId": "desktop_audio",
  "state": "active",
  "sourceRef": {
    "logicalSourceKey": "desktop:instrument:primary",
    "sourceId": "input-source-1"
  },
  "requesters": [
    { "requesterId": "note_detect", "purpose": "note-detection" }
  ],
  "directMonitor": { "state": "muted", "control": "supported" },
  "latencySummary": { "bucket": "low" }
}
```

### `stop`

Releases a requester from a monitoring session. Provider stop is called only when the final requester releases the session, or when an explicit user stop targets the session/all sessions.

**Request payload**:

```json
{
  "monitoringId": "monitoring-1",
  "stopAll": false,
  "authorization": "user-action"
}
```

**Rules**:
- Unknown sessions return `no-handler` or `stopped` with a safe reason.
- A targeted stop only releases/tears down a session the dispatch caller owns; a non-owner receives `no-handler`.
- `stopAll` is a user-authoritative global stop and requires `authorization: "user-action"`; a background requester receives `user-action-required` (so it cannot tear down everyone's monitoring).
- Non-final requester release keeps provider monitoring active.
- Final requester release forwards `monitoring.stop` to the provider when supported.
- A missing provider returns `no-owner` (the session is orphaned) and a provider without `monitoring.stop` returns `unsupported-command`, rather than pretending it stopped.

### `select-provider`

Records the user/default provider preference. This is a stable command for capability dispatch. The runtime may also expose a public helper that forwards to the same behavior for local UI code.

**Request payload**:

```json
{
  "providerId": "desktop_audio",
  "logicalMonitoringKey": "desktop:main",
  "requesterId": "user"
}
```

### `set-direct-monitor`

Records the user/default direct-monitor preference and asks the active provider to apply it when supported. This is a stable command for capability dispatch. The runtime may also expose a public helper that forwards to the same behavior for local UI code.

**Request payload**:

```json
{
  "state": "muted",
  "requesterId": "user"
}
```

**Rules**:
- Valid states are `muted` and `unmuted` for user preference.
- Requester direct-monitor requirements do not call this command implicitly.
- Unsupported provider control returns `unsupported-command` or `degraded` without failing unrelated monitoring.

## Provider Operations

### `monitoring.start`

Called only after provider selection, start authorization, and input readiness checks pass.

**Provider request**:

```json
{
  "monitoringId": "monitoring-1",
  "providerId": "desktop_audio",
  "requesterId": "user",
  "sourceRef": {
    "logicalSourceKey": "desktop:instrument:primary",
    "sourceId": "input-source-1",
    "openSessionId": "input-open-1"
  },
  "requiredChannelShape": "mono",
  "directMonitorPreference": "muted",
  "directMonitorRequirement": "muted"
}
```

**Provider response**:

```json
{
  "outcome": "handled",
  "status": "active",
  "summary": {
    "directMonitor": { "state": "muted", "control": "supported" },
    "latencySummary": { "bucket": "low" }
  }
}
```

Provider responses are normalized. Unknown outcome values become `handled` only when safe; malformed responses become `failed`.

### `monitoring.stop`

Called when the final requester releases the session or the user explicitly stops it.

**Provider request**:

```json
{
  "monitoringId": "monitoring-1",
  "providerId": "desktop_audio",
  "requesterIds": ["note_detect"],
  "reason": "final-requester-released"
}
```

### `monitoring.status`

Prompt-free provider status. Must not open live input or trigger permission prompts.

**Provider request**:

```json
{
  "providerId": "desktop_audio",
  "sourceRef": { "logicalSourceKey": "desktop:instrument:primary" }
}
```

**Provider response**:

```json
{
  "outcome": "handled",
  "status": "active",
  "summary": {
    "availability": "available",
    "directMonitor": { "state": "muted", "control": "supported" },
    "latencySummary": { "bucket": "low" }
  }
}
```

### `monitoring.set-direct-monitor` (optional)

Optional. Invoked by the `set-direct-monitor` command for each active session when the provider advertises `monitoring.set-direct-monitor` (alias `direct-monitor.set`). Providers without this operation report `unsupported` direct-monitor control; the preference is still recorded and the unrelated monitoring session keeps running.

**Provider request**:

```json
{
  "monitoringId": "monitoring-1",
  "providerId": "desktop_audio",
  "state": "muted",
  "requesterId": "user"
}
```

**Provider response**:

```json
{
  "outcome": "handled",
  "summary": {
    "directMonitor": { "state": "muted", "control": "supported", "applied": true }
  }
}
```

## Events

- `provider-registered`
- `provider-removed`
- `provider-availability-changed`
- `provider-selection-required`
- `monitoring-start-requested`
- `monitoring-started`
- `monitoring-degraded`
- `monitoring-unavailable`
- `monitoring-failed`
- `monitoring-denied`
- `monitoring-stopped`
- `monitoring-orphaned`
- `direct-monitor-changed`
- `permission-denied`
- `bridge-hit`

Event payloads use the same redaction-safe summary objects as diagnostics.

## Normalized Outcomes

| Outcome | Meaning |
|---------|---------|
| `handled` | Operation completed normally. |
| `denied` | Permission or user policy denied the operation. |
| `degraded` | Operation completed with non-blocking degradation. |
| `failed` | Provider/runtime failed and monitoring did not safely start/stop. |
| `no-owner` | No monitoring owner/provider exists for the request. |
| `no-handler` | Provider exists but required operation handler is missing. |
| `unsupported-command` | Command/operation is outside supported contract. |
| `incompatible` | Source, channel shape, direct-monitor policy, or attach requirements are incompatible with the requested monitoring session. |
| `incompatible-version` | Provider or requester declares unsupported contract version. |
| `unavailable` | Provider/source/output is currently unavailable. |
| `provider-selection-required` | Multiple compatible providers exist and no selected/default/supplied provider exists. |
| `user-action-required` | Fresh start was requested without explicit user action. |
| `stopped` | Monitoring is stopped or release completed without an active provider start. |

## Compatibility Rules

- Attach is compatible only when provider, selected source, channel shape, and direct-monitor policy are compatible.
- Native providers suppress compatibility-backed visible duplicates with the same logical monitoring key.
- Compatibility bridge hits remain diagnostics-only when a native provider owns the logical path.
- Active monitoring survives song switches and playback stops.
- App reload restores provider/source preferences but never active live monitoring.
