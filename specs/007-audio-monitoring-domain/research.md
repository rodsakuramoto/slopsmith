# Research: Audio Monitoring Control Plane

## Decision 1: Extend `core.audio.session` for audio-monitoring

**Decision**: Implement the monitoring domain inside the existing `static/capabilities/audio-session.js` host that already owns `audio-mix` and `audio-input`.

**Rationale**: Monitoring depends on selected input sources, open-source readiness, route/degradation summaries, compatibility bridge accounting, and diagnostics that already live in the audio-session snapshot. Reusing the host keeps lifecycle state in one place and avoids a second sensitive-audio registry.

**Alternatives considered**:
- New `audio-monitoring.js` runtime: rejected because it would duplicate capability owner setup, diagnostics redaction, bridge hit accounting, and input-source lookup.
- Provider-only monitoring without a core coordinator: rejected because requesters could duplicate starts, stop each other unexpectedly, or expose inconsistent state in diagnostics.

## Decision 2: Model monitoring providers separately from sessions

**Decision**: Add explicit monitoring provider registration/state alongside monitoring sessions. Providers expose redaction-safe metadata, availability, source mode, supported operations, operation handlers, direct-monitor capabilities, and bounded status.

**Rationale**: The current runtime only records ad hoc monitoring session entries. The spec requires deterministic provider selection, no duplicate user-visible providers, provider disappearance handling, and diagnostics before a session exists. Those requirements need provider records independent of active sessions.

**Alternatives considered**:
- Infer providers from sessions only: rejected because `inspect` before start would be blind and multiple-provider selection could not be resolved safely.
- Treat monitoring providers as generic mix participants: rejected because monitoring is sensitive, has user-action authorization rules, and uses start/stop/status operations rather than fader semantics.

## Decision 3: Use selected/default provider policy for starts

**Decision**: Track a user-selected/default monitoring provider. If exactly one compatible provider is available, it may be used as the effective default. If multiple compatible providers are available and no provider is supplied or selected, return `provider-selection-required`.

**Rationale**: This makes provider choice deterministic without surprising the player when desktop/native, browser, and plugin-hosted monitoring providers coexist during migration.

**Alternatives considered**:
- First provider wins: rejected because load order would decide what the user hears.
- Provider decides: rejected because the coordinator must own the user-visible domain policy.

## Decision 4: Fresh starts require user authorization

**Decision**: Every fresh monitoring start that can open live input or produce sound must carry explicit user-action authorization. Background/plugin requesters may inspect state and may attach to an already active compatible session, but otherwise receive `user-action-required`.

**Rationale**: Monitoring can activate live input and audible output. The control plane should preserve the user's consent boundary even when plugins automate setup or restore state.

**Alternatives considered**:
- Allow any requester to call `start`: rejected because a background plugin could start live monitoring silently.
- Allow automatic restart after reload if a session was active before: rejected because live handles and user consent cannot be preserved safely across process lifetime.

## Decision 5: Treat audio-input open-session readiness as the monitoring input boundary

**Decision**: Monitoring starts reference the selected input source or an explicit redaction-safe source reference from `audio-input`; providers use audio-input readiness/open-session outcomes instead of silently enumerating or opening unknown sources.

**Rationale**: `audio-input` owns source identity, selection, permission prompts, and open-session sharing. Monitoring owns whether an audible monitoring path is active. Keeping those boundaries separate avoids duplicate prompts and keeps source diagnostics consistent.

**Alternatives considered**:
- Let monitoring enumerate devices directly: rejected because `inspect`/status paths must be prompt-free and redaction-safe.
- Copy source selection into monitoring storage: rejected because audio-input is the source-of-truth for selected input.

## Decision 6: Normalize provider operations and outcomes

**Decision**: Provider operations are `monitoring.start`, `monitoring.stop`, and `monitoring.status`. Core normalizes operation results into explicit outcomes: `handled`, `denied`, `degraded`, `failed`, `no-owner`, `no-handler`, `unsupported-command`, `incompatible`, `incompatible-version`, `unavailable`, `provider-selection-required`, `user-action-required`, and `stopped`.

**Rationale**: Existing capability dispatch and audio-input handling already use bounded outcomes. Monitoring needs the same shape so the inspector, diagnostics bundle, and tests can distinguish supportable failures from provider bugs.

**Alternatives considered**:
- Provider-specific result shapes: rejected because support tooling would need plugin-specific parsers.
- Throw exceptions for control-flow states: rejected because denied, unavailable, degraded, and stopped are expected states, not runtime failures.

## Decision 7: Share compatible monitoring sessions by provider/source/requester references

**Decision**: The coordinator maintains one active monitoring session per compatible provider/source/direct-monitor policy and tracks requester references. Stop is forwarded to the provider only when the final requester releases the session.

**Rationale**: Note detection, NAM-style processing, desktop monitoring, and future practice tools can need the same monitoring path. Reference tracking prevents duplicate provider starts and prevents one requester from stopping monitoring still needed by another.

**Alternatives considered**:
- One session per requester: rejected because providers could duplicate audio paths and direct-monitor state would diverge.
- Single global boolean state: rejected because it cannot represent provider/source attribution, requesters, direct-monitor requirements, or orphaned/degraded sessions.

## Decision 8: User/default direct-monitor state is authoritative

**Decision**: Store/report the direct-monitor mute preference as monitoring state. Requesters may declare a required direct-monitor state; if the selected user/default setting cannot satisfy it, the requester gets `degraded` or `unsupported` without changing the user's setting.

**Rationale**: Direct monitoring affects what the player hears immediately. Requester preferences are compatibility constraints, not authority to change the dry path behind the user's back.

**Alternatives considered**:
- Last requester wins: rejected because it makes the audible path unpredictable.
- Provider decides conflicts: rejected because the domain needs one consistent user-facing policy.

## Decision 9: Diagnostics expose summaries, not live handles or hardware identity

**Decision**: Monitoring diagnostics include provider summaries, selected source references, active sessions, requester refs, direct-monitor status, latency summaries, recent outcomes, and bridge hits. They must exclude raw audio buffers, sample/waveform data, recordings, live MediaStream/AudioNode/native handles, raw device labels, stable hardware identifiers, local paths, and secrets.

**Rationale**: Monitoring is sensitive but support needs enough safe metadata to answer why the user cannot hear input. This mirrors the audio-input redaction policy and satisfies diagnostics-bundle constraints.

**Alternatives considered**:
- Include raw provider status payloads: rejected because provider status may contain device labels or native handles.
- Omit monitoring diagnostics: rejected because troubleshooting live monitoring would remain plugin-specific and opaque.

## Decision 10: Keep compatibility bridges visible during migration

**Decision**: Continue recording `audio-monitoring.audio-barrier` bridge hits and add monitoring-specific bridge records for legacy browser, desktop/native, and plugin-specific starts/stops/direct-monitor toggles where feasible. Native provider state wins over compatibility-backed duplicates.

**Rationale**: The migration needs proof that legacy surfaces are no longer unexpectedly driving monitoring before they can be removed. Bridge hits give maintainers that proof without breaking existing plugins.

**Alternatives considered**:
- Remove legacy surfaces immediately: rejected because Audio Engine, NAM Tone, Note Detect, and browser/desktop paths still coexist.
- Ignore legacy paths in diagnostics: rejected because duplicate starts and hidden direct-monitor toggles would be hard to diagnose.
