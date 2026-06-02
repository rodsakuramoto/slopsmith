# Research: Audio Input Control Plane

## Decision: Extend the existing audio-session host as the audio-input control plane

**Rationale**: `static/capabilities/audio-session.js` already registers `audio-input` as an active sensitive provider-coordinator, contributes diagnostics under `slopsmith.audio_session.diagnostics.v1`, records bridge hits, and has initial source registration/selection commands. Extending it keeps 006 layered on the completed 004/005 audio-session work and avoids a second input runtime.

**Alternatives considered**: A standalone input module would duplicate session, bridge, pseudonymization, and diagnostics state. Leaving input behavior inside plugin-private globals would fail the migration goal because requesters could not inspect selected source state safely.

## Decision: Require provider-supplied logical source keys

**Rationale**: The clarified spec needs stable restore and duplicate suppression without raw device labels or platform hardware ids. A provider-scoped logical source key gives core a safe matching key for native/legacy representations, repeated hydration, and selected-source restoration while keeping diagnostics pseudonymized.

**Alternatives considered**: Raw source ids or browser `deviceId` values are too privacy-sensitive and may be unstable. No cross-reload restore would make the user reselect devices unnecessarily. First-registration-wins would be nondeterministic when native and compatibility paths hydrate in different orders.

## Decision: Keep inspect, listing, and selection prompt-free

**Rationale**: Permission prompts are user-visible and platform-sensitive. The input domain must let support tooling and requesters inspect source state without surprising the user or asking for microphone access. Prompts are allowed only when the user explicitly opens or starts live input.

**Alternatives considered**: Prompting during enumeration would provide richer labels earlier but violates the privacy boundary. Prompting on selection would make a passive preference change behave like capture. Provider-decided prompt timing would be hard to test and inconsistent across browser/desktop/native paths.

## Decision: Coordinate open/close state without brokering live handles

**Rationale**: `audio-input` should be an audit and lifecycle coordinator, not a raw audio transport. Provider/downstream code owns `MediaStream`, `AudioNode`, native capture handles, and any equivalent live objects. Audio-input records open/close intent, requester attribution, state, outcomes, and safe reasons only.

**Alternatives considered**: Passing live handles through capability payloads would make diagnostics unsafe and mix control-plane data with audio data. Letting every requester open providers independently would make support state incomplete and create competing permission/device behavior.

## Decision: Add shared open input sessions keyed by source and compatible channel shape

**Rationale**: Multiple requesters such as note detection and monitoring may need the same selected source at the same time. Coordinating one open session per selected source plus compatible channel shape prevents duplicate provider opens and makes release behavior deterministic: the provider-owned session closes only after the last requester releases it.

**Alternatives considered**: Opening separately for every requester can cause device contention and duplicate permission/device prompts. Exclusive input would block useful combined workflows. Provider-decided sharing would make behavior inconsistent and harder to validate.

## Decision: Keep channel choice requester-declared, not user-selected

**Rationale**: Users should choose the source, while consumers declare mono/stereo/multichannel needs at open/start time. This keeps the UI source list compact and lets incompatible channel requirements return a distinct outcome without changing the selected source.

**Alternatives considered**: Storing channel profiles as part of selection would complicate restore and duplicate suppression. Separate user-visible sources per channel would multiply device rows and make native/legacy matching harder. Treating channel shape as informational only would hide real incompatibilities from requesters.

## Decision: Keep diagnostics bounded and redaction-safe

**Rationale**: Input is a sensitive domain because source identity, permission state, channel shape, and failure reasons can reveal hardware or environment details. The diagnostics model should keep enough state for support to distinguish denied, unavailable, failed, incompatible, no-owner, and no-handler outcomes without raw labels, stable ids, paths, secrets, audio buffers, sample data, waveforms, or live handles.

**Alternatives considered**: Rich raw provider snapshots would help local debugging but violate the diagnostics redaction principle. Hiding outcomes entirely would make support reports regress to vague input failures.