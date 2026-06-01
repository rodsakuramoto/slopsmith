# Capability Authoring Recipes

Use these examples as small manifest fragments when migrating plugin-facing integrations to capability pipelines. The capability model is system-wide; these recipes focus on plugin manifests because core-owned domains are registered by Slopsmith itself. Each example is intentionally complete enough to pass the loader contract in [plugin-manifest.schema.json](plugin-manifest.schema.json).

> **Self-hosted CSS?** If your plugin uses Tailwind classes core doesn't ship (notably arbitrary values like `text-[11px]`), declare a `styles` key and bundle your own preflight-off stylesheet — see [plugin-styles.md](plugin-styles.md). That is separate from the capability-pipeline recipes below.

## Owner And Provider

A plugin that owns a domain and handles commands declares `owner` and `provider`. Use this for a single canonical implementation in a plugin-owned domain, such as a future stem-control capability.

```json
{
  "id": "stems",
  "name": "Stems",
  "standards": ["capability-pipelines.v1", "plugin-runtime-idempotent.v1"],
  "capabilities": {
    "stems": {
      "roles": ["owner", "provider"],
      "commands": ["mute", "restore", "inspect"],
      "events": ["claim:created", "claim:released", "stems.ready"],
      "mode": "active",
      "compatibility": "none",
      "ownership": "exclusive-owner",
      "safety": "safe",
      "version": 1
    }
  }
}
```

## Requester And Observer

A plugin that requests work from another domain and listens for lifecycle events declares `requester` and `observer`.

```json
{
  "id": "example_requester",
  "name": "Example Requester",
  "standards": ["capability-pipelines.v1", "plugin-runtime-idempotent.v1"],
  "capabilities": {
    "example.plugin-domain": {
      "roles": ["requester", "observer"],
      "commands": ["apply", "restore", "inspect"],
      "events": ["claim:created", "claim:released", "example.manual-override"],
      "mode": "active",
      "compatibility": "none",
      "ownership": "requester-only",
      "safety": "safe",
      "version": 1
    }
  }
}
```

## Observer Only

A plugin that only reads public events should declare `observer` and no command handlers. In PR1, this is most useful for participants that observe the delivered `library` workflow; future plugin-owned domains can use the same pattern once promoted.

```json
{
  "id": "practice_hud",
  "name": "Practice HUD",
  "standards": ["capability-pipelines.v1"],
  "capabilities": {
    "example.plugin-domain": {
      "roles": ["observer"],
      "commands": [],
      "events": ["claim:created", "claim:released", "example.manual-override"],
      "mode": "active",
      "compatibility": "degrade-noop",
      "ownership": "observer-only",
      "safety": "safe",
      "version": 1
    }
  }
}
```

## Library Provider

A plugin that registers a remote client or generated library source declares itself as a `library` provider. The backend registration call is still made from `routes.py` with `context["register_library_provider"](...)`; the native browser library capability turns the provider registry into runtime provider participants. A thin server wrapper that only exposes the local library over HTTP should not declare `library` as a provider unless it also registers a provider in the library registry.

```json
{
  "id": "remote_library_client",
  "name": "Remote Library Client",
  "standards": ["capability-pipelines.v1"],
  "capabilities": {
    "library": {
      "roles": ["provider"],
      "operations": ["query-page", "query-artists", "query-stats", "tuning-names", "get-art", "sync-song"],
      "mode": "active",
      "compatibility": "none",
      "safety": "safe",
      "version": 1
    }
  }
}
```

## Library Requester And Observer

A route-only wrapper that uses the library capability without registering a browsable provider should declare requester/observer intent instead of provider ownership. This is a generic manifest shape for external plugins to adopt in their own repositories; it does not make the wrapper part of this PR's delivered domain set.

```json
{
  "id": "library_route_wrapper",
  "name": "Library Route Wrapper",
  "standards": ["capability-pipelines.v1"],
  "capabilities": {
    "library": {
      "roles": ["requester", "observer"],
      "requests": ["list-providers", "get-current", "inspect"],
      "observes": ["providers-refreshed", "source-changed"],
      "description": "Uses the library source list through its own route surface without registering a provider.",
      "mode": "active",
      "compatibility": "none",
      "safety": "safe",
      "version": 1
    }
  }
}
```

## Audio Mix Fader Provider

Existing plugins can keep using `window.slopsmith.audio.registerFader(spec)` while migrating. The compatibility bridge records the fader as an `audio-mix` participant. New bundled code should prefer a native participant declaration plus the audio-session helper once available in its integration point.

```json
{
  "id": "delay_fx",
  "name": "Delay FX",
  "standards": ["capability-pipelines.v1"],
  "capabilities": {
    "audio-mix": {
      "roles": ["provider"],
      "operations": ["fader.get-value", "fader.set-value"],
      "events": ["fader-changed"],
      "mode": "active",
      "compatibility": "shim-allowed",
      "ownership": "multi-provider",
      "safety": "safe",
      "version": 1
    }
  }
}
```

## Audio Input And Monitoring Requester

Plugins that need live instrument input should declare requester/observer intent and let the host expose redaction-safe source identity. Diagnostics must not contain raw device labels, stable hardware ids, or audio buffers.

```json
{
  "id": "note_detect",
  "name": "Note Detect",
  "standards": ["capability-pipelines.v1"],
  "capabilities": {
    "audio-input": {
      "roles": ["requester", "observer"],
      "requests": ["inspect", "select-source"],
      "observes": ["source-registered", "source-selected"],
      "mode": "active",
      "compatibility": "shim-allowed",
      "ownership": "requester-only",
      "safety": "sensitive",
      "version": 1
    },
    "audio-monitoring": {
      "roles": ["requester", "observer"],
      "requests": ["start", "stop", "inspect"],
      "observes": ["monitoring-started", "monitoring-unavailable", "monitoring-stopped"],
      "mode": "active",
      "compatibility": "shim-allowed",
      "ownership": "requester-only",
      "safety": "sensitive",
      "version": 1
    }
  }
}
```

## Stems Provider Behind Audio Session Coordination

The Stems plugin remains the provider/owner of actual stem playback state. `core.audio.session` coordinates dispatch, claims, overrides, orphan detection, and diagnostics, but it does not replace the provider.

```json
{
  "id": "stems",
  "name": "Stems",
  "standards": ["capability-pipelines.v1", "plugin-runtime-idempotent.v1"],
  "capabilities": {
    "stems": {
      "roles": ["owner", "provider"],
      "commands": ["mute", "restore", "inspect"],
      "operations": ["stem.get-state", "stem.apply-automation", "stem.restore-automation"],
      "events": ["owner-available", "automation-applied", "automation-restored", "automation-overridden", "claim-orphaned"],
      "mode": "active",
      "compatibility": "shim-allowed",
      "ownership": "exclusive-owner",
      "safety": "safe",
      "version": 1
    }
  }
}
```

## Future Expansion Domains

Some domain names are reserved for expected future contracts, but they are not registered in the runtime graph yet. For example, `ui.player-panels` is documented as a likely panel-host surface, but Slopsmith does not currently expose a capability command for panel contributions. See [capability-roadmap.md](capability-roadmap.md) for the PR1 domain set and deferred-domain checklist.

Plugins should not declare future expansion domains until the corresponding host workflow ships. For PR1 integrations, prefer active domains such as `library`; after the audio graph/session slice, audio participants may also declare `audio-mix`, `audio-input`, `audio-monitoring`, or `stems` intent matching the recipes above.

Invalid capability metadata is excluded from the capability graph, but legacy manifest fields still load through their existing app paths. The `library` workflow is native in PR1 and does not use compatibility shim metadata. Unsupported `capability-pipelines` versions are reported as incompatible and their runtime handlers must not execute.
