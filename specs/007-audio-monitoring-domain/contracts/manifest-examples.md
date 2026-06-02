# Contract: Manifest Examples

## Monitoring Provider

A desktop/native audio engine that can start, stop, and report live monitoring declares provider intent.

```json
{
  "id": "audio_engine",
  "name": "Audio Engine",
  "standards": ["capability-pipelines.v1"],
  "capabilities": {
    "audio-monitoring": {
      "roles": ["provider", "observer"],
      "requests": ["inspect"],
      "operations": ["monitoring.start", "monitoring.stop", "monitoring.status"],
      "observes": [
        "monitoring-start-requested",
        "monitoring-started",
        "monitoring-degraded",
        "monitoring-stopped",
        "direct-monitor-changed"
      ],
      "mode": "active",
      "compatibility": "none",
      "ownership": "multi-provider",
      "safety": "sensitive",
      "version": 1
    }
  }
}
```

## Monitoring Requester

A plugin that needs monitoring to be active, but does not own the monitoring path, declares requester/observer intent.

```json
{
  "id": "note_detect",
  "name": "Note Detect",
  "standards": ["capability-pipelines.v1"],
  "capabilities": {
    "audio-input": {
      "roles": ["requester", "observer"],
      "requests": ["inspect", "list-sources", "open-source", "close-source"],
      "observes": ["source-selected", "source-opened", "source-closed", "permission-denied"],
      "mode": "active",
      "compatibility": "shim-allowed",
      "ownership": "requester-only",
      "safety": "sensitive",
      "version": 1
    },
    "audio-monitoring": {
      "roles": ["requester", "observer"],
      "requests": ["inspect", "start", "stop"],
      "observes": [
        "monitoring-started",
        "monitoring-degraded",
        "monitoring-unavailable",
        "monitoring-stopped",
        "permission-denied"
      ],
      "mode": "active",
      "compatibility": "shim-allowed",
      "ownership": "requester-only",
      "safety": "sensitive",
      "version": 1
    }
  }
}
```

## Provider Runtime Registration

```js
const audioSession = window.slopsmith && window.slopsmith.audioSession;
if (audioSession && typeof audioSession.registerMonitoringProvider === 'function') {
  audioSession.registerMonitoringProvider({
    providerId: 'audio_engine',
    ownerPluginId: 'audio_engine',
    label: 'Desktop monitoring',
    logicalMonitoringKey: 'desktop:main',
    sourceMode: 'native',
    availability: 'available',
    operations: ['monitoring.start', 'monitoring.stop', 'monitoring.status'],
    directMonitor: { control: 'supported', state: 'muted' },
    operationHandlers: {
      'monitoring.start': async request => {
        // Start provider-owned native monitoring. Do not return native handles.
        return { outcome: 'handled', status: 'active', summary: { directMonitor: { control: 'supported', state: 'muted' } } };
      },
      'monitoring.stop': async request => {
        return { outcome: 'handled', status: 'stopped' };
      },
      'monitoring.status': async request => {
        return { outcome: 'handled', status: 'active', summary: { directMonitor: { control: 'supported', state: 'muted' } } };
      },
    },
  });
}
```

## User-Authorized Start

```js
await window.slopsmith.capabilities.dispatch({
  capability: 'audio-monitoring',
  command: 'start',
  source: 'audio_engine',
  payload: {
    requesterId: 'user',
    purpose: 'player-monitor-button',
    authorization: 'user-action',
    requiredChannelShape: 'mono'
  }
});
```

## Background Requester Attach

```js
const status = await window.slopsmith.capabilities.dispatch({
  capability: 'audio-monitoring',
  command: 'start',
  source: 'note_detect',
  payload: {
    requesterId: 'note_detect',
    purpose: 'note-detection',
    authorization: 'background',
    requiredChannelShape: 'mono'
  }
});

if (status.outcome === 'user-action-required') {
  // Prompt the user through plugin UI instead of starting live monitoring silently.
}
```

## Direct-Monitor Requirement

```js
await window.slopsmith.capabilities.dispatch({
  capability: 'audio-monitoring',
  command: 'start',
  source: 'nam_tone',
  payload: {
    requesterId: 'nam_tone',
    purpose: 'amp-monitoring',
    authorization: 'user-action',
    directMonitorRequirement: 'muted'
  }
});
```

If the user's/default direct-monitor preference is `unmuted`, the requester receives `degraded` or `unsupported`; the preference is not changed automatically.
