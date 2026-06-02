# Contract: Audio Input Manifest Examples

These examples show plugin intent declarations for `audio-input`. Runtime handlers still register through the browser capability/audio-session APIs when plugin scripts hydrate.

## Native Source Provider

```json
{
  "id": "note_detect",
  "name": "Note Detect",
  "standards": ["capability-pipelines.v1", "plugin-runtime-idempotent.v1"],
  "capabilities": {
    "audio-input": {
      "roles": ["provider"],
      "operations": ["source.enumerate", "source.describe", "source.open", "source.close"],
      "events": ["source-registered", "source-availability-changed", "source-opened", "source-closed", "permission-denied"],
      "description": "Provides redaction-safe live instrument input source metadata.",
      "mode": "active",
      "compatibility": "none",
      "ownership": "multi-provider",
      "safety": "sensitive",
      "version": 1
    }
  }
}
```

Provider rules:

- Register safe `logicalSourceKey` values for each source.
- Keep actual stream/node/native handles provider-owned.
- Return open/close state and outcomes only.
- Do not include raw labels, hardware ids, local paths, secrets, or raw audio data in capability payloads.

## Input Requester And Observer

```json
{
  "id": "practice_hud",
  "name": "Practice HUD",
  "standards": ["capability-pipelines.v1"],
  "capabilities": {
    "audio-input": {
      "roles": ["requester", "observer"],
      "requests": ["inspect", "select-source", "open-source", "close-source"],
      "observes": ["source-registered", "source-selected", "source-availability-changed", "source-opened", "source-closed"],
      "description": "Uses selected input state for live practice feedback.",
      "mode": "active",
      "compatibility": "none",
      "ownership": "requester-only",
      "safety": "sensitive",
      "version": 1
    }
  }
}
```

Requester rules:

- Use `inspect` for prompt-free source state.
- Declare `requiredChannelShape` during `open-source` or downstream start flows when needed.
- Release with `close-source` when the requester stops using live input.
- Never expect audio-input command payloads to contain live stream or audio node handles.

## Compatibility-Backed Provider During Migration

```json
{
  "id": "legacy_input_plugin",
  "name": "Legacy Input Plugin",
  "standards": ["capability-pipelines.v1"],
  "capabilities": {
    "audio-input": {
      "roles": ["provider", "requester"],
      "operations": ["source.describe"],
      "requests": ["inspect"],
      "observes": ["bridge-hit"],
      "description": "Legacy input surface reported through the compatibility bridge while migrating.",
      "mode": "legacy-shim",
      "compatibility": "shim-allowed",
      "ownership": "multi-provider",
      "safety": "sensitive",
      "version": 1
    }
  }
}
```

Migration rules:

- Compatibility-backed sources must provide safe logical source keys when possible.
- Native sources with the same logical source key own the user-visible state.
- Bridge hits remain in diagnostics until removal gates are met.