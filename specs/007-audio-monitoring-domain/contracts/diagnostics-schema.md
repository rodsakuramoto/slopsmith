# Contract: Monitoring Diagnostics Schema

Diagnostics are contributed through the existing `slopsmith.audio_session.diagnostics.v1` snapshot under `domains['audio-monitoring']`.

## Domain Shape

```json
{
  "providers": [
    {
      "providerId": "desktop_audio",
      "ownerPluginId": "audio_engine",
      "label": "Desktop monitoring",
      "sourceMode": "native",
      "logicalMonitoringKey": "desktop:main",
      "availability": "available",
      "operations": ["monitoring.start", "monitoring.stop", "monitoring.status"],
      "directMonitor": {
        "state": "muted",
        "control": "supported",
        "preference": "muted",
        "applied": true,
        "reason": ""
      },
      "latencySummary": { "bucket": "low" },
      "reason": "",
      "registeredAt": "2026-05-30T00:00:00.000Z",
      "lastSeenAt": "2026-05-30T00:00:00.000Z",
      "lastChangedAt": "2026-05-30T00:00:00.000Z",
      "supersededBy": ""
    }
  ],
  "selectedProvider": {
    "providerId": "desktop_audio",
    "logicalMonitoringKey": "desktop:main",
    "availability": "available",
    "restored": false,
    "restoreStatus": "available"
  },
  "sessions": [
    {
      "monitoringId": "monitoring-1",
      "providerId": "desktop_audio",
      "logicalMonitoringKey": "desktop:main",
      "sourceRef": {
        "logicalSourceKey": "desktop:instrument:primary",
        "sourceId": "source-1",
        "providerId": "desktop_audio"
      },
      "openInputSessionId": "input-open-1",
      "state": "active",
      "requesters": [
        { "requesterId": "note_detect", "purpose": "note-detection" }
      ],
      "directMonitor": { "state": "muted", "control": "supported" },
      "latencySummary": { "bucket": "low" },
      "reason": "",
      "startedAt": "2026-05-30T00:00:00.000Z",
      "lastUsedAt": "2026-05-30T00:00:00.000Z",
      "stoppedAt": ""
    }
  ],
  "totalProviders": 1,
  "totalSessions": 1,
  "directMonitor": { "state": "muted", "control": "supported" },
  "bridges": []
}
```

## Redaction Requirements

Monitoring diagnostics MUST NOT include:
- Raw audio buffers, samples, waveform data, recordings, or sample arrays.
- `MediaStream`, `AudioNode`, WebAudio graph objects, JUCE/native handles, or plugin editor handles.
- Raw device labels, stable hardware identifiers, platform ids, serial numbers, or local filesystem paths.
- Secrets, tokens, API keys, passwords, or bearer values.
- Provider-private payloads that have not been normalized through the monitoring summary sanitizer.

## Required Diagnostic Distinctions

Focused tests must be able to distinguish:
- `handled`
- `denied`
- `degraded`
- `failed`
- `unavailable`
- `no-owner`
- `no-handler`
- `unsupported-command`
- `incompatible`
- `incompatible-version`
- `provider-selection-required`
- `user-action-required`
- `stopped`

## Outcome Record Shape

Recent outcomes use the existing `recentOutcomes` array.

```json
{
  "domain": "audio-monitoring",
  "operation": "start",
  "participantId": "note_detect",
  "providerId": "desktop_audio",
  "monitoringId": "monitoring-1",
  "requesterId": "note_detect",
  "logicalSourceKey": "desktop:instrument:primary",
  "sourceId": "source-1",
  "openSessionId": "input-open-1",
  "bridgeId": "",
  "outcome": "handled",
  "status": "active",
  "reason": "",
  "timestamp": "2026-05-30T00:00:00.000Z"
}
```

Outcome reasons are length-bounded and redacted with the same safety rules as audio-input.

## Bridge Record Shape

```json
{
  "domain": "audio-monitoring",
  "bridgeId": "audio-monitoring.audio-barrier",
  "legacySurface": "window.slopsmithAudioBarrier",
  "participantId": "note_detect",
  "providerId": "",
  "operation": "readiness",
  "outcome": "degraded",
  "status": "timeout",
  "reason": "timeout",
  "timestamp": "2026-05-30T00:00:00.000Z"
}
```

## Size and Bounds

- Provider and session lists use the existing per-domain item cap.
- Recent outcomes use the existing `MAX_OUTCOMES` cap.
- Bounded reason strings are capped to the existing reason limit.
- Diagnostics snapshot should remain within the established audio-session budget used by JS tests.
