# Research: Audio Graph/Session Capability Slice

## Decision: Core-owned audio session host per active player/song

**Rationale**: The current failure modes span PSARC/HTML5 audio, optional desktop/JUCE routing, sloppak/stem playback, mixer faders, analyser access, and monitoring barriers. A single core-owned host boundary gives support one place to inspect route state, participant state, bridge usage, and diagnostics outcomes while still leaving feature-specific audio processing in plugins.

**Alternatives considered**:

- **Separate host per domain**: Rejected because `audio-mix`, `audio-input`, `audio-monitoring`, and `stems` currently interact through shared route, fader, analyser, and monitoring state. Separate hosts would preserve the current coordination problem.
- **Plugin-owned session host**: Rejected because no single plugin can safely coordinate PSARC vs sloppak route behavior, core song volume, desktop audio gain, and external plugin participants.
- **Device-owned session host**: Rejected because the user-visible workflow is song/player scoped; device ownership would not model stem automation or analyser consumers cleanly.

## Decision: Promote the four audio domains as one coordinated slice

**Rationale**: Issue evidence and code inspection show the bugs are cross-domain: `static/audio-mixer.js` calls `window.slopsmith.stems.setMasterVolume`, `static/highway.js` chooses between HTML5 and JUCE routes, and `plugins/highway_3d/screen.js` works around analyser ownership by preferring `window.slopsmith.stems.getAnalyser()`. Promoting only one domain would leave private handshakes in place.

**Alternatives considered**:

- **Start with only `audio-mix`**: Rejected because mixer behavior already depends on stem and route ownership.
- **Start with only `stems`**: Rejected because NAM/Stems-style automation needs route, fader, and analyser diagnostics to be explainable.
- **Wait for note detection**: Rejected because note detection should consume stable input/source identity rather than define the audio session boundary itself.

## Decision: Preserve legacy APIs through attributed compatibility bridges

**Rationale**: Existing bundled and external plugins rely on the fader registry, Stems globals, analyser access, monitoring barriers, and route behavior. The migration standard requires equivalent user-visible behavior during transition and no net legacy growth, so bridges should attribute usage, emit diagnostics, and block new bundled legacy-only coupling once native replacements exist.

**Alternatives considered**:

- **Immediate removal of legacy globals**: Rejected because it would break existing plugins and user workflows.
- **Permanent dual APIs with no deprecation state**: Rejected because it would violate the 003 standard and grow long-term maintenance burden.
- **Silent bridge with no diagnostics**: Rejected because support would still be unable to distinguish native failures from legacy bridge failures.

## Decision: Use per-bundle pseudonyms for sensitive device/source identity

**Rationale**: Audio-input and monitoring diagnostics need to correlate events within one support bundle, but raw device labels and stable cross-export identifiers can reveal hardware identity. Per-bundle pseudonyms preserve troubleshooting value without making diagnostics a tracking surface.

**Alternatives considered**:

- **Coarse redaction only**: Rejected because support could not correlate permission, availability, and monitoring events for the same source within one bundle.
- **Stable local hashed IDs**: Rejected because they enable cross-export correlation.
- **Raw labels with export confirmation**: Rejected as a stronger privacy risk than needed for this domain.

## Decision: Keep playback transport and note detection out of scope

**Rationale**: The audio session host supplies route/source facts needed by playback and note detection, but transport commands and scoring lifecycle are separate capability domains with their own owner models and tests. Keeping them separate reduces blast radius and preserves parallel domain planning.

**Alternatives considered**:

- **Fold playback into audio graph/session**: Rejected because transport owns play/pause/seek/loop/speed behavior and already has a roadmap entry.
- **Fold note detection into audio-input**: Rejected because note detection includes scoring, note-state providers, per-panel behavior, and performance diagnostics beyond source identity.

## Decision: No backend persistence or new deployment dependency for this slice

**Rationale**: The planned slice is a browser-runtime coordination and diagnostics migration. Existing `localStorage` volume behavior and diagnostics contribution flow are sufficient; adding backend state, a new database table, or a mandatory audio service would conflict with the self-hosted single-user constitution unless a later feature proves it is necessary.

**Alternatives considered**:

- **Persist audio sessions server-side**: Rejected because sessions are live browser/player state and should not survive as durable app data.
- **Add a new native audio service requirement**: Rejected because optional desktop/JUCE integration already exists and Docker-first core must keep working without it.
