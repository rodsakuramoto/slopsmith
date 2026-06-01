# Contract: Audio Graph/Session Migration Notes

Every implementation PR for this slice must include plugin-author migration notes covering the legacy surfaces below. Existing legacy paths remain supported through compatibility bridges until their removal gates are satisfied.

## Legacy Surface: Mixer Fader Registry

**Current path**: `window.slopsmith.audio.registerFader(spec)`, `unregisterFader(id)`, `getFaders()`  
**Current replacement path**: `audio-mix` participant registration, bridge attribution, and diagnostics
**Future replacement path**: executable `audio-mix` fader commands backed by provider operations
**Compatibility period**: Supported compatibility during initial migration  
**Warning/diagnostic signal**: Bridge hit under `audio-mix.fader-registry` with participant id and outcome  
**Removal gate**: The audio-mix control-plane slice implements executable fader commands, provider operation handlers, committed-value/failure events, and mixer UI consumption; bundled consumers migrate; external usage review is documented; migration notes are published; and at least one release or notice period emits compatibility diagnostics

## Legacy Surface: Song Volume And Route Application

**Current path**: HTML5 `audio.volume`, `window.slopsmith.audio.applySongVolume()`, optional `window.slopsmithDesktop.audio.setGain('backing', value)`  
**Replacement path**: `audio-mix` route/fader participant state owned by the core audio session host  
**Compatibility period**: Supported compatibility; no removal planned until PSARC, sloppak, and desktop routes validate equivalent behavior  
**Warning/diagnostic signal**: Bridge hit under `audio-mix.song-volume` with route kind and degraded/fallback reason when applicable  
**Removal gate**: Equivalent behavior validated across representative HTML5, sloppak, and optional desktop/JUCE scenarios

## Legacy Surface: Stems Master Volume And Private Stem State

**Current path**: `window.slopsmith.stems.setMasterVolume()`, plugin-private stem mute/restore state, plugin-specific Stems/NAM handshakes  
**Replacement path**: `stems` owner commands and `audio-mix` mix participant operations, using capability claims for temporary automation  
**Compatibility period**: Supported compatibility for existing plugins; private state mutation is deprecated for new bundled code once native commands exist  
**Warning/diagnostic signal**: Bridge hit under `stems.master-volume` or `stems.private-state` with requester, owner, and override outcome  
**Removal gate**: Bundled requesters migrated, external Stems/NAM usage reviewed, migration notes published, and warning/diagnostics window completed

## Legacy Surface: Analyser Access

**Current path**: Direct `createMediaElementSource(audio)` taps or `window.slopsmith.stems.getAnalyser()`  
**Replacement path**: Read-only `audio-mix` analyser participant/operation surfaced through the audio session host  
**Compatibility period**: Supported compatibility until bundled analyser consumers migrate  
**Warning/diagnostic signal**: Bridge hit under `audio-mix.analyser` with source kind `core`, `stems`, `unavailable`, or `conflict`  
**Removal gate**: Bundled analyser consumers migrate and support data proves no active external reliance during the notice window

## Legacy Surface: Monitoring Barrier And Plugin Handshakes

**Current path**: `window.slopsmithAudioBarrier` and plugin-specific monitoring start/stop handshakes  
**Replacement path**: `audio-monitoring` `start`, `stop`, and `inspect` commands plus provider operations  
**Compatibility period**: Supported compatibility with redacted diagnostics  
**Warning/diagnostic signal**: Bridge hit under `audio-monitoring.audio-barrier`; denied/unavailable/timeout states are distinct from native failures  
**Removal gate**: Bundled monitoring workflows migrate, external usage review is complete, and warnings or compatibility diagnostics ship for at least one release/notice period

## Legacy Surface: Input Source And Channel State

**Current path**: Plugin-local `getUserMedia` state, raw device/channel labels, and local input selection behavior  
**Replacement path**: `audio-input` source registration, selection, inspect, and redacted diagnostics  
**Compatibility period**: Supported compatibility with per-bundle pseudonyms in diagnostics  
**Warning/diagnostic signal**: Bridge hit under `audio-input.legacy-source`; permission-denied outcomes and unavailable source statuses are distinct  
**Removal gate**: Downstream note-detection and monitoring workflows consume source identity through `audio-input`, migration notes are published, and external usage review is complete

## New Bundled Code Rule

After a replacement path exists for a legacy surface, new bundled code must use the native audio graph/session domain path. New legacy-only globals, wrapper chains, private state reads, direct analyser ownership, or plugin-specific handshakes require an explicit temporary exception in the per-slice legacy inventory with owner, risk, and sunset gate.
