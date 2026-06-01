# Legacy Inventory: Audio Graph/Session

**Feature**: [spec.md](spec.md)
**Domain host boundary**: Core-owned Audio Session Host Boundary per active player/song

## Summary

| Category | Count | Notes |
|----------|-------|-------|
| Added | 0 | The spec does not add new legacy-only surfaces. |
| Removed | 0 | Removal is not in scope for the specification step. |
| Migrated | 6 | Native host/compatibility bridge paths implemented for covered audio surfaces. |
| Contained | 6 | Existing audio surfaces are covered by compatibility bridges or the host boundary. |
| Remaining | 3 | Adjacent domain work and executable fader control are intentionally deferred with follow-up gates. |

## Added Legacy Surfaces

| Surface | Type | Why added | Sunset gate | Owner |
|---------|------|-----------|-------------|-------|
| None | N/A | No new legacy-only integration points are permitted by this spec. | N/A | N/A |

## Removed Legacy Surfaces

| Surface | Type | Adoption gate evidence | Removal notes |
|---------|------|------------------------|---------------|
| None | N/A | Removal requires bundled migration, external usage review, migration notes, and warning/diagnostics window. | N/A |

## Migrated Legacy Surfaces

| Surface | Type | Replacement path | Bundled consumers migrated | Evidence |
|---------|------|------------------|----------------------------|----------|
| Existing plugin fader registration | global registry / plugin registration | `audio-mix` participant summaries plus `audio-mix.fader-registry` bridge hits. | Existing mixer API preserved through `window.slopsmith.audio`; executable fader callbacks remain a follow-up control-plane task. | `tests/js/audio_session_compat.test.js`; `tests/js/audio_session_routes.test.js` |
| Song volume and route application | direct HTML5/JUCE/stem routing | `audio-mix` route/fader state plus `audio-mix.song-volume` bridge hits. | Core song fader and route reporting migrated. | `tests/js/audio_session_routes.test.js` |
| Stems master volume/private state handoff | global Stems API / private coupling risk | `stems` active provider, claims, overrides, and `stems.master-volume` bridge hits. | Stems provider remains owner; core coordinates diagnostics. | `tests/js/audio_session_stems.test.js`; `tests/js/audio_session_stems_bridge.test.js` |
| Shared analyser access | singleton/global read path | `audio-mix.analyser` bridge hit with source/failure status. | 3D Highway fallback records bridge diagnostics. | `tests/js/audio_session_compat.test.js` |
| Input source/channel selection behavior | browser/plugin-local source state | `audio-input` source registration, selection, pseudonymized diagnostics, and `audio-input.legacy-source`. | Source identity snapshots are redaction-safe. | `tests/js/audio_session_input.test.js`; `tests/test_diagnostics_bundle.py` |
| Monitoring lifecycle handshake | plugin barrier / lifecycle coupling | `audio-monitoring` start/stop diagnostics and `audio-monitoring.audio-barrier` bridge hits. | JUCE route barrier reports handled/degraded/failed. | `tests/js/audio_session_monitoring.test.js`; `tests/js/audio_session_compat.test.js` |

## Contained Legacy Surfaces

| Surface | Type | Compatibility bridge | Diagnostics emitted | Deprecation state |
|---------|------|----------------------|---------------------|-------------------|
| Existing plugin fader registration | global registry / plugin registration | Bridge into `audio-mix` participant inspection and fader ownership. | Domain, participant, bridge usage, and outcome. | Supported compatibility; blocked for new bundled-only patterns until the executable audio-mix control plane exists. |
| Existing stem mute/restore state | plugin-owned state / private coupling risk | Bridge into `stems` owner requests and automation claims. | Owner, requester, manual override, no-owner/no-handler, and outcome. | Supported compatibility during migration; deprecated for private state mutation. |
| NAM/Stems ducking coordination | plugin-specific handshake / private state access risk | Bridge requesters to stem owner commands without direct private mutation. | Requester, owner, bridge usage, overridden/failed outcomes. | Deprecated for new bundled code once domain path exists. |
| Shared analyser or audio-session read access | singleton/global read path | Bridge into read-only `audio-mix` or audio-session inspection. | Participant, source identity, bridge usage, unavailable/conflict state, and failed outcome. | Supported compatibility until native consumers migrate. |
| Input source/channel selection behavior | global/browser state / plugin-local state | Bridge into `audio-input` source identity and availability state. | Source identity summary, permission/availability, bridge usage, outcome. | Supported compatibility with redaction. |
| Monitoring lifecycle handshake | plugin-specific lifecycle / direct start-stop coupling | Bridge into `audio-monitoring` start/stop/inspect outcomes. | Participant, permission/availability, bridge usage, denied/failed outcomes. | Supported compatibility with redaction and user-visible consent. |

## Remaining Legacy Surfaces

| Surface | Type | Reason remaining | Owner | Risk | Follow-up gate |
|---------|------|------------------|-------|------|----------------|
| Executable mixer fader callbacks | live callback registry / UI source of truth | This slice attributes fader participants and bridge hits, but `window.slopsmith.audio.registerFader()` still owns live `getValue`/`setValue` callbacks and mixer UI rendering. | Future audio-mix control-plane slice | Treating participant summaries as executable faders would lose async error handling, committed-value feedback, and plugin-owned persistence semantics. | Audio-mix control-plane slice must define executable fader commands, provider operation handlers, fader-changed events, async failure behavior, and mixer UI consumption before `registerFader` becomes a compatibility wrapper. |
| Playback transport globals and wrapper behavior | global functions / wrapper chains | Out of scope; playback owns play, pause, seek, loop, speed, and media lifecycle commands. | Future playback/transport slice | Audio work could accidentally absorb transport behavior. | Playback slice must inventory transport surfaces before promotion. |
| Note detection scoring and per-panel detector binding | plugin state / scorer lifecycle | Out of scope; this slice only defines source identity and monitoring facts needed later. | Future note-detection slice | Detector work could inherit single-global audio assumptions. | Note-detection slice must consume audio-input identity rather than redefining it. |

## No-Net-Increase Decision

- Added legacy-only surfaces: 0
- Removed or migrated surfaces: 6
- Contained surfaces with bridge diagnostics: 6
- Remaining surfaces with follow-up gate: 3

Decision: PASS

Rationale: The implementation adds no legacy-only surfaces, migrates the six covered audio surfaces into native host or compatibility bridge accounting, keeps remaining legacy paths contained with diagnostics, and defers executable fader control plus adjacent playback/note-detection surfaces with explicit owners and gates.
