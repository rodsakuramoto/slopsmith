# Contract: Audio Input Control Plane

This contract extends the `audio-input` domain from the audio graph/session slice. It follows `capability-pipelines.v1` and keeps `core.audio.session` as the provider-coordinator owner.

## Domain Metadata

- **Domain**: `audio-input`
- **Owner**: `core.audio.session`
- **Kind**: `provider-coordinator`
- **Safety**: `sensitive`
- **Compatibility bridges**: `audio-input.legacy-source`
- **Prompt rule**: `inspect`, source listing, and `select-source` must not trigger input permission prompts; only explicit open/start live-input flows may do so.
- **Handle rule**: command payloads, snapshots, and diagnostics must not expose `MediaStream`, `AudioNode`, native capture handles, raw buffers, sample data, or waveform data.

## Commands

Commands are invoked through the capability runtime, for example `window.slopsmith.capabilities.dispatch({ capability: 'audio-input', command, payload })`.

| Command | Request | Success Payload | Failure Outcomes |
|---------|---------|-----------------|------------------|
| `inspect` | `{ sourceId?, logicalSourceKey? }` | Redaction-safe `AudioInputSnapshot` | `denied`, `degraded`, `failed` |
| `list-sources` | `{ includeUnavailable?: boolean }` | `{ sources: AudioInputSourceSummary[], selected?: SelectedInputSummary }` | `degraded`, `failed` |
| `register-source` | `AudioInputSourceRegistration` | Registered `AudioInputSourceSummary` | `denied`, `incompatible-version`, `failed` |
| `unregister-source` | `{ sourceId?, logicalSourceKey?, providerId? }` | `{ sourceId?, logicalSourceKey?, removed: true }` | `no-handler`, `failed` |
| `select-source` | `{ sourceId?, logicalSourceKey }` (requester identity from the dispatch caller) | `SelectedInputSummary` | `denied`, `no-handler`, `degraded`, `failed` |
| `open-source` | `{ logicalSourceKey?, sourceId?, requiredChannelShape?, purpose? }` (requester identity from the dispatch caller) | `OpenInputSessionSummary` | `denied`, `degraded`, `failed`, `no-owner`, `no-handler`, `unsupported-command`, `incompatible-version` |
| `close-source` | `{ openSessionId?, logicalSourceKey?, requiredChannelShape? }` (requester identity from the dispatch caller) | `OpenInputSessionSummary` | `no-handler`, `failed` |

Rules:

- `inspect`, `list-sources`, and `select-source` are prompt-free.
- Requester identity for `select-source`/`open-source`/`close-source` is bound to the authenticated dispatch caller; a payload-supplied `requester`/`requesterId` is ignored so a caller cannot spoof another requester's identity or release a shared open session it does not own.
- `open-source` uses the selected source by default. A requester may include a matching `logicalSourceKey` or `sourceId` for disambiguation, but the command must not silently switch to a different source — a hint that resolves to anything other than the selected source is rejected as `degraded`.
- `open-source` returns `degraded` or `no-owner` when no selected source/provider exists.
- `open-source` returns `incompatible-version` for unsupported provider contracts.
- `open-source` returns `denied` for permission denied and `degraded`/`failed` for unavailable/provider-failed states, preserving distinct status fields.
- `close-source` releases the requester reference and calls provider close only after the last compatible requester has released.
- Unsupported command names return `unsupported-command` through the capability runtime.

## Provider Operations

Provider operations are participant-owned callbacks or runtime handlers registered with the audio-input host.

| Operation | Request | Success Payload | Notes |
|-----------|---------|-----------------|-------|
| `source.enumerate` | `{ providerId }` | `{ sources: AudioInputSourceRegistration[] }` | Must return safe metadata only. May require explicit user action before it is invoked. |
| `source.describe` | `{ sourceId?, logicalSourceKey }` | `AudioInputSourceSummary` | No permission prompt; safe availability/channel metadata only. |
| `source.open` | `{ sourceId, logicalSourceKey, requesterId, requiredChannelShape?, purpose? }` | `OpenInputSessionSummary` without handles | May trigger permission prompt only as part of explicit open/start. |
| `source.close` | `{ sourceId, logicalSourceKey, openSessionId, requesterIds? }` | `OpenInputSessionSummary` without handles | Called when the last requester releases the shared session. |

Provider operations must never return raw stream handles, node handles, native handles, raw labels, stable hardware ids, local paths, secrets, raw buffers, sample data, or waveform data in audio-input payloads.

## AudioInputSourceRegistration

```json
{
  "sourceId": "provider-runtime-source-id",
  "logicalSourceKey": "note_detect:instrument:primary",
  "providerId": "note_detect",
  "ownerPluginId": "note_detect",
  "kind": "instrument",
  "label": "Input 1",
  "availability": "available",
  "channelSummary": {
    "channelCount": 2,
    "channelShape": "stereo",
    "supports": ["mono", "stereo"]
  },
  "sourceMode": "native",
  "operations": ["source.describe", "source.open", "source.close"],
  "version": 1
}
```

Rules:

- `sourceId`, `logicalSourceKey`, and `providerId` are required.
- `logicalSourceKey` must be redaction-safe and stable for the provider's logical source.
- `label` must already be safe for display/support; raw device labels are rejected, replaced, or pseudonymized before diagnostics.
- `availability` defaults to `available` only when the provider explicitly supplies enough safe metadata.
- Re-registering the same logical source updates availability and last-seen metadata instead of creating duplicates.

## AudioInputSourceSummary

```json
{
  "sourceId": "source-01",
  "logicalSourceKey": "input-01",
  "providerId": "note_detect",
  "kind": "instrument",
  "label": "Input 1",
  "availability": "available",
  "selected": true,
  "channelSummary": {
    "channelCount": 2,
    "channelShape": "stereo",
    "supports": ["mono", "stereo"]
  },
  "sourceMode": "native"
}
```

Rules:

- Summaries use pseudonyms or safe logical keys, not raw source ids.
- User-visible lists suppress compatibility-backed duplicates when a native source shares the same logical source key.
- Unavailable or disabled selected sources remain visible with safe reasons.

## SelectedInputSummary

```json
{
  "logicalSourceKey": "input-01",
  "sourceId": "source-01",
  "providerId": "note_detect",
  "availability": "available",
  "restoreStatus": "restored",
  "selectedAt": "2026-05-30T12:00:00Z"
}
```

Rules:

- Restore is based on the same logical source key.
- If the persisted source is unavailable, the summary reports unavailable and does not silently pick another source.
- If storage is unavailable, the current session selection remains usable and the snapshot reports `storageStatus: unavailable` (or `failed` when a write throws).

## OpenInputSessionSummary

```json
{
  "openSessionId": "input-open-01",
  "logicalSourceKey": "input-01",
  "sourceId": "source-01",
  "providerId": "note_detect",
  "channelShape": "mono",
  "state": "open",
  "requesters": [
    { "requesterId": "note_detect", "purpose": "note-detection" },
    { "requesterId": "audio_monitor", "purpose": "monitoring" }
  ],
  "reason": ""
}
```

Rules:

- Compatible requesters share the same open session.
- Incompatible channel requirements produce an `incompatible` status/outcome and do not change the selected source.
- The summary contains no live audio handles.
- Provider close is invoked only after the last requester releases the shared open session.

## Events

| Event | Payload | Trigger |
|-------|---------|---------|
| `source-registered` | `AudioInputSourceSummary` | Source registration accepted. |
| `source-removed` | `{ sourceId?, logicalSourceKey?, providerId? }` | Source unregistered or removed from active list. |
| `source-selected` | `SelectedInputSummary` | User/requester selects a source. |
| `source-availability-changed` | `AudioInputSourceSummary` | Availability changes, including denied/unavailable/failed/incompatible. |
| `permission-denied` | `InputOutcome` | Provider reports denied during explicit open/start. |
| `source-opened` | `OpenInputSessionSummary` | First compatible requester opens the selected source. |
| `source-open-degraded` | `OpenInputSessionSummary` plus reason | Open fails, degrades, or is unavailable. |
| `source-closed` | `OpenInputSessionSummary` | Last requester releases and provider close settles. |
| `bridge-hit` | `CompatibilityBridgeHit` | Legacy input surface is used. |

## Legacy Compatibility API

Legacy browser, desktop, or plugin-specific input handoffs remain during the compatibility period.

Compatibility behavior:

- Legacy source handoffs are mapped into compatibility-backed source records when safe metadata is available.
- Legacy bridge hits are recorded under `audio-input.legacy-source`.
- Native sources win over compatibility-backed records with the same logical source key.
- Legacy paths may remain usable, but new bundled input consumers should use `audio-input` state and commands.

Removal gates for compatibility:

- Bundled input providers/requesters use native source registration and open/close coordination.
- Diagnostics show no unexpected legacy source hits in representative playback/input scenarios.
- Repeated plugin hydration and app reload do not duplicate native or compatibility-backed sources.