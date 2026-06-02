# Contract: Audio Input Diagnostics Schema

Audio-input diagnostics live inside `slopsmith.audio_session.diagnostics.v1` under `domains["audio-input"]` and `recentOutcomes`.

## Domain Snapshot

```json
{
  "sources": [],
  "selected": null,
  "openSessions": [],
  "bridges": [],
  "totalSources": 0,
  "totalOpenSessions": 0,
  "storageStatus": "available"
}
```

Fields:

- `sources`: redaction-safe `AudioInputSourceSummary` records, capped by the domain item limit.
- `selected`: `SelectedInputSummary` or null.
- `openSessions`: redaction-safe `OpenInputSessionSummary` records without handles, capped by the domain item limit.
- `bridges`: audio-input compatibility bridge hits.
- `totalSources`: full in-memory source count before snapshot capping.
- `totalOpenSessions`: full in-memory open-session count before snapshot capping.
- `storageStatus`: `available`, `unavailable`, or `failed` for selected-source preference storage.

## Recent Outcomes

Audio-input outcomes appear in the shared `recentOutcomes` ring buffer.

```json
{
  "domain": "audio-input",
  "operation": "open-source",
  "providerId": "note_detect",
  "sourceId": "source-01",
  "logicalSourceKey": "input-01",
  "requesterId": "note_detect",
  "openSessionId": "input-open-01",
  "outcome": "handled",
  "status": "open",
  "reason": "",
  "timestamp": "2026-05-30T12:00:00Z"
}
```

Outcome rules:

- `denied`, `unavailable`, `failed`, `disabled`, and `incompatible` remain distinct through `outcome` plus `status`.
- `no-owner`, `no-handler`, `unsupported-command`, and `incompatible-version` are recorded when dispatch cannot execute.
- Reasons are bounded and redaction-safe.
- Oldest outcomes are trimmed first when the shared cap is reached.

## Forbidden Data

Diagnostics must contain zero instances of:

- raw audio buffers
- sample data or waveform data
- `MediaStream`, `AudioNode`, native capture handle, or equivalent live object references
- raw device labels
- stable hardware identifiers
- raw browser/native device ids
- local file paths
- secrets, API keys, tokens, or password-like text

## Pseudonymization

- Source ids in diagnostics use per-snapshot or per-bundle pseudonyms such as `source-01`.
- Logical source keys must already be redaction-safe; diagnostics may still pseudonymize them when they could identify private hardware.
- Pseudonyms are not persisted across exports.
- Correlation inside one snapshot is allowed so support can connect source, selected state, open sessions, bridges, and outcomes.

## Compatibility Bridges

```json
{
  "bridgeId": "audio-input.legacy-source",
  "legacySurface": "plugin/browser input source handoff",
  "domain": "audio-input",
  "participantId": "legacy-runtime",
  "outcome": "overridden",
  "status": "overshadowed",
  "reason": "Native source owns logical source input-01",
  "hitCount": 1,
  "lastHitAt": "2026-05-30T12:00:00Z"
}
```

Bridge records identify legacy usage without raw source labels or handles. If a native source wins over a compatibility-backed duplicate, the bridge status should make that suppression visible.