# Contract: Monitoring Migration Notes

## Migration Goal

Move live monitoring lifecycle, direct-monitor status, and monitoring diagnostics into `core.audio.session` while providers keep all live audio handles and implementation-specific state.

## In Scope

- Register monitoring providers with redaction-safe metadata.
- Select/default a monitoring provider when multiple compatible providers exist.
- Start/stop/status monitoring through normalized commands and provider operations.
- Share active monitoring sessions across compatible requesters.
- Preserve active monitoring across song switches and playback stops.
- Restore provider/source preference after reload without auto-resuming live audio.
- Report direct-monitor mute/control state as monitoring status.
- Record compatibility bridge hits for legacy audio barrier/start/stop/direct-monitor behavior.
- Surface providers, sessions, requesters, direct-monitor state, bridge hits, and outcomes in Capability Inspector and diagnostics.

## Out of Scope

- Effect-chain editing, VST/NAM/IR loading, bypass, presets, and plugin editor windows.
- Note scoring or pitch detection algorithms.
- Recording capture, take storage, upload/import/export, or waveform display.
- Stem playback/state ownership.
- Playback transport lifecycle.
- Raw device selection or source identity ownership, which remains in `audio-input`.

## Provider Migration Steps

1. Declare `audio-monitoring` provider/observer capability intent in `plugin.json`.
2. Register a monitoring provider through the audio-session runtime when the plugin hydrates.
3. Include `logicalMonitoringKey`, source mode, supported operations, availability, and direct-monitor capability summary.
4. Implement `monitoring.start`, `monitoring.stop`, and `monitoring.status` handlers, plus the optional `monitoring.set-direct-monitor` (alias `direct-monitor.set`) handler where direct-monitor control is supported (see the control-plane contract's Provider Operations).
5. Return only normalized summaries; keep native handles, streams, nodes, and device ids private.
6. Report unavailable/degraded/failed states with bounded safe reasons.
7. Unregister or update provider availability on teardown/disablement where supported.
8. Record bridge hits when legacy monitoring paths still run.

## Requester Migration Steps

1. Declare `audio-monitoring` requester/observer capability intent in `plugin.json`.
2. Use `inspect` to read prompt-free status.
3. Use `audio-input` to inspect/select/open sources when a live input path is required.
4. For user UI actions, dispatch `start` with `authorization: 'user-action'`.
5. For background work, dispatch `start` only to attach to an active compatible session; handle `user-action-required` by surfacing UI.
6. Dispatch `stop` with the requester id when the feature no longer needs monitoring.
7. Treat degraded/unsupported direct-monitor requirements as visible compatibility status rather than mutating the user preference.

## Compatibility Bridge Policy

- `audio-monitoring.audio-barrier` remains an expected bridge while legacy readiness barriers exist.
- Legacy browser, desktop, or plugin monitoring starts/stops should be attributed as monitoring bridge hits when they cannot yet be routed through provider operations.
- Native providers win visible ownership when native and compatibility-backed providers share a logical monitoring key.
- Compatibility-backed duplicates remain diagnostics-only until removal gates pass.

## Removal Gates

Legacy monitoring code paths can be removed only after focused validation proves:

- Native/provider-backed monitoring start/stop/status covers the user-visible path.
- No duplicate user-visible providers appear after repeated plugin hydration.
- The Capability Inspector and diagnostics show provider/source/requester/direct-monitor state for representative issues.
- Unexpected compatibility bridge hits are absent in normal playback/monitoring flows.
- Direct-monitor preference/status remains user-authoritative and visible in diagnostics.
- NAM Tone, Audio Engine, Note Detect, and browser fallback requesters can either start via user action, attach to active sessions, or receive `user-action-required` cleanly.

## Documentation Updates Required During Implementation

- [docs/capability-roadmap.md](../../../docs/capability-roadmap.md): mark the focused monitoring slice and removal gates.
- [docs/capability-domains.md](../../../docs/capability-domains.md): add provider/requester lifecycle guidance.
- [docs/capability-recipes.md](../../../docs/capability-recipes.md): add monitoring provider/requester examples.
- [docs/capability-safety-matrix.md](../../../docs/capability-safety-matrix.md): update monitoring outcomes and provider operation notes.
