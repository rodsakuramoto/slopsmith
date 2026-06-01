# Contract: Audio Graph/Session Capability Domains

This contract defines the public capability-domain shape for the first audio graph/session slice. It follows `capability-pipelines.v1` and the migration standard in [specs/003-migrate-capability-domains/spec.md](../../003-migrate-capability-domains/spec.md).

## Shared Rules

- The core audio session host coordinates all domains for the active player/song.
- `audio-mix`, `audio-input`, and `audio-monitoring` are multi-provider domains coordinated by the core host.
- `stems` is coordinated through the session host, but the active Stems plugin/provider remains the semantic owner of actual stem playback and state.
- All commands return an explicit capability outcome. Use existing runtime names where possible: `handled`, `denied`, `overridden`, `unsupported-command`, `no-owner`, `no-handler`, `incompatible-version`, `degraded`, and `failed`.
- The domain may use `unavailable` as a domain reason or payload status when a device/source/owner is absent; runtime diagnostics should map it to a redaction-safe decision.
- Sensitive source/device fields must be redacted or summarized. Correlation across events inside one diagnostics bundle uses per-bundle pseudonyms only.
- Bridge usage must identify `bridgeId`, `legacySurface`, target domain, participant, and outcome.

## Domain: `audio-mix`

**Owner**: `core.audio.session`  
**Kind**: `provider-coordinator`  
**Safety**: `safe`  
**Participants**: song audio, stem mix, monitoring output, plugin faders, read-only analyser participants

### Commands

| Command | Request | Success Payload | Failure Outcomes |
|---------|---------|-----------------|------------------|
| `inspect` | `{ sessionId? }` | `AudioSession` mix summary, route summary, participants, bridge usage | `degraded`, `failed` |
| `register-participant` | `{ participantId, label, kind, fader?, operations?, compatibilitySource? }` | Registered `MixParticipant` summary | `denied`, `incompatible-version`, `failed` |
| `unregister-participant` | `{ participantId }` | `{ participantId, removed: true }` | `no-handler`, `failed` |

### Provider Operations

| Operation | Purpose |
|-----------|---------|
| `fader.get-value` | Read current participant fader value for the mixer UI and diagnostics. |
| `fader.set-value` | Apply a user-requested fader value and report the actual committed value. |
| `analyser.get-summary` | Report read-only analyser availability/source metadata without exposing raw audio data. |
| `route.get-current` | Report current output route summary for PSARC, sloppak, stem, or desktop/JUCE paths. |

### Events

- `participant-registered`
- `participant-removed`
- `fader-changed`
- `route-changed`
- `route-degraded`
- `bridge-hit`

## Domain: `audio-input`

**Owner**: `core.audio.session`  
**Kind**: `provider-coordinator`  
**Safety**: `sensitive`  
**Participants**: browser media-device source providers, plugin input-source providers, monitoring/note-detection requesters

### Commands

| Command | Request | Success Payload | Failure Outcomes |
|---------|---------|-----------------|------------------|
| `inspect` | `{ sessionId?, sourceId? }` | Redacted source list and selected source summary | `denied`, `degraded`, `failed` |
| `register-source` | `{ sourceId, providerId, kind, channelCount?, availability }` | Registered `AudioInputSource` summary | `denied`, `incompatible-version`, `failed` |
| `unregister-source` | `{ sourceId }` | `{ sourceId, removed: true }` | `no-handler`, `failed` |
| `select-source` | `{ sourceId, requester? }` | Selected source summary, including `availability` when selection cannot proceed | `denied`, `no-handler`, `degraded`, `failed` |

### Provider Operations

| Operation | Purpose |
|-----------|---------|
| `source.enumerate` | Enumerate available source summaries after the user/browser permits enumeration. |
| `source.describe` | Return redaction-safe availability/channel metadata for a source. |
| `source.open` | Request access to a source for a monitoring or downstream scoring workflow. |
| `source.close` | Release source access when the requester stops. |

### Events

- `source-registered`
- `source-removed`
- `source-selected`
- `source-availability-changed`
- `permission-denied`
- `bridge-hit`

## Domain: `audio-monitoring`

**Owner**: `core.audio.session`  
**Kind**: `provider-coordinator`  
**Safety**: `sensitive`  
**Participants**: monitoring providers, input-source providers, requesters that need live mic/instrument monitoring

### Commands

| Command | Request | Success Payload | Failure Outcomes |
|---------|---------|-----------------|------------------|
| `start` | `{ sourceId?, requester?, reason? }` | `MonitoringSession` summary with state `active`, permission-pending, or unavailable status | `denied`, `no-handler`, `degraded`, `failed` |
| `stop` | `{ monitoringId?, requester? }` | Stopped `MonitoringSession` summary | `no-handler`, `failed` |
| `inspect` | `{ monitoringId? }` | Monitoring session and provider availability summary | `degraded`, `failed` |

### Provider Operations

| Operation | Purpose |
|-----------|---------|
| `monitoring.start` | Start provider-owned monitoring for an approved source. |
| `monitoring.stop` | Stop provider-owned monitoring and release resources. |
| `monitoring.status` | Report lifecycle state and redacted failure reason. |

### Events

- `monitoring-start-requested`
- `monitoring-started`
- `monitoring-stopped`
- `monitoring-failed`
- `monitoring-unavailable`
- `permission-denied`
- `bridge-hit`

## Domain: `stems`

**Owner**: active stem owner participant, coordinated by `core.audio.session`  
**Kind**: `coordinator plus plugin provider`  
**Safety**: `safe`  
**Participants**: stem owner/provider, requesters such as monitoring or amp plugins, observers such as UI/debug plugins

### Commands

| Command | Request | Success Payload | Failure Outcomes |
|---------|---------|-----------------|------------------|
| `inspect` | `{ sessionId?, stemId? }` | Redaction-safe stem availability and automation summary | `no-owner`, `no-handler`, `failed` |
| `mute` | `{ stemIds, claimId?, requester?, reason? }` | Applied automation summary and owner-controlled restore token/claim state | `denied`, `overridden`, `no-owner`, `no-handler`, `failed` |
| `restore` | `{ claimId?, stemIds?, requester? }` | Restored or overridden automation summary | `overridden`, `no-owner`, `no-handler`, `failed` |

### Provider Operations

| Operation | Purpose |
|-----------|---------|
| `stem.get-state` | Read owner-controlled stem state for inspect/diagnostics without exposing private structures. |
| `stem.apply-automation` | Apply temporary mute/duck behavior for an active claim. |
| `stem.restore-automation` | Restore owner-held state for a released claim when not overridden. |

### Events

- `owner-available`
- `owner-unavailable`
- `automation-applied`
- `automation-restored`
- `automation-overridden`
- `claim-orphaned`
- `bridge-hit`

## Compatibility Bridge Contract

| Bridge | Legacy Surface | Target Domain | Required Behavior |
|--------|----------------|---------------|-------------------|
| `audio-mix.fader-registry` | `window.slopsmith.audio.registerFader`, `unregisterFader`, `getFaders` | `audio-mix` | Preserve current mixer UI behavior and attribute legacy faders as mix participants. |
| `audio-mix.song-volume` | `applySongVolume`, `readSongVolume`, HTML5 volume, desktop `setGain('backing')` | `audio-mix` | Preserve song volume across HTML5, sloppak, and optional JUCE paths; report degraded route/fader outcomes. |
| `stems.master-volume` | `window.slopsmith.stems.setMasterVolume` | `stems`, `audio-mix` | Preserve sloppak stem master behavior while routing future requests through owner operations. |
| `audio-mix.analyser` | direct `createMediaElementSource`, `window.slopsmith.stems.getAnalyser()` | `audio-mix` | Preserve existing read-only reactivity and report analyser conflicts/unavailability. |
| `audio-monitoring.audio-barrier` | `window.slopsmithAudioBarrier` and plugin-specific monitoring handshakes | `audio-monitoring` | Preserve route reconfiguration waits and expose timeout/degraded outcomes. |
| `audio-input.legacy-source` | plugin-local input/channel/device state | `audio-input` | Preserve source selection behavior while exporting only redacted summaries and per-bundle pseudonyms. |

## Diagnostics Payload Expectations

A diagnostics snapshot for this slice should include:

```json
{
  "schema": "slopsmith.audio_session.diagnostics.v1",
  "session": {
    "sessionId": "main:<redacted-song>",
    "songFormat": "psarc",
    "route": { "routeKind": "html5", "availability": "available" }
  },
  "domains": {
    "audio-mix": { "participants": [], "bridges": [] },
    "audio-input": { "sources": [], "bridges": [] },
    "audio-monitoring": { "sessions": [], "bridges": [] },
    "stems": { "owner": null, "claims": [], "bridges": [] }
  },
  "recentOutcomes": []
}
```

Rules:

- Keep payloads bounded and redaction-safe.
- Use per-bundle pseudonyms for source/device correlation and do not persist those pseudonyms across exports.
- Do not include raw audio buffers, raw FFT data, local DLC paths, raw device labels, or stable hardware identifiers.
