# Research: Playback Control Plane

## Decision 1: Add a dedicated `playback` capability owner

**Decision**: Implement playback as a first-class `playback` domain owned by a new frontend capability host, while keeping the actual media transport behavior in the existing player code.

**Rationale**: Playback is not an audio-input, monitoring, mix, stems, visualization, or note-detection concern. It owns transport lifecycle, timing summaries, seek/loop state, route handoff, requester attribution, and bridge diagnostics. A dedicated domain gives plugins one migration target without moving unrelated domains into the player transport.

**Alternatives considered**:
- Extend `audio-session`: rejected because audio-session owns audio graph coordination, not song transport or loop semantics.
- Keep only `window.playSong` and song events: rejected because wrappers remain order-dependent and diagnostics cannot attribute conflicts deterministically.
- Put all logic in plugins: rejected because playback is core user workflow and needs one authoritative coordinator.

## Decision 2: Keep `static/app.js` as the transport adapter

**Decision**: Treat `static/app.js` as the adapter for `playSong`, pause/resume, stop, `_audioSeek`, `setLoop`, `clearLoop`, HTML5/JUCE route switching, and existing DOM controls. The playback capability owner stores normalized state and calls into an adapter surface rather than taking raw media handles.

**Rationale**: `static/app.js` already owns the player controls, `HTMLAudioElement`, optional JUCE/native bridge, seek serialization, route handoff, loop helpers, and highway synchronization. Moving that in one slice would create unnecessary risk. A redaction-safe adapter lets the domain observe/control behavior without exposing `audio`, `jucePlayer`, or route-private objects.

**Alternatives considered**:
- Move transport into `static/capabilities/playback.js`: rejected because it would duplicate or destabilize working player logic.
- Let the capability owner read private globals directly: rejected because the spec forbids raw media handles and private route objects in support surfaces.

## Decision 3: Fresh audible starts require explicit user action

**Decision**: `playback.start` from idle, stopped, or no-session state must carry user-action authorization. Plugins may inspect/observe playback and may request permitted controls for an already-active session.

**Rationale**: Starting a song produces audible output and changes the primary player screen. The same consent boundary used for sensitive audio domains should apply: background plugin hydration must not unexpectedly start sound.

**Alternatives considered**:
- Allow plugin starts whenever a target is valid: rejected because background code could start playback silently.
- Prompt on every plugin start: rejected for this slice because it adds a new confirmation UX surface; the clarified requirement chose explicit user action instead.

## Decision 4: User actions win conflicts; latest non-stale wins within priority

**Decision**: Resolve conflicting playback requests by prioritizing explicit user actions over plugin or automation requests. Within the same priority level, the latest request that still targets the active session wins.

**Rationale**: A player pressing Pause should not be immediately undone by plugin automation. For equal-priority automation or equal-priority user gestures, generation tokens and request sequence keep ordering deterministic.

**Alternatives considered**:
- Strict last-arrival wins: rejected because automation could fight the user.
- First in-flight wins: rejected because slow operations would make the UI feel stuck.
- Reject all conflicts while in flight: rejected because ordinary seek/loop/control workflows need responsive replacement.

## Decision 5: Reuse generation-token and serialized-seek patterns

**Decision**: Preserve the existing `_audioSeek` serialization and generation-token style for stale seek/song-switch handling, and surface the normalized outcome through playback state.

**Rationale**: The current implementation already protects queued seeks and route IPC from stale song switches. The playback domain should expose those outcomes instead of replacing a working concurrency pattern.

**Alternatives considered**:
- Parallel independent seek handling in the capability owner: rejected because two queues could disagree about final clock state.
- Let seek callers read `audio.currentTime` directly: rejected because JUCE routing, clamping, rollback, and chart synchronization need the existing funnel.

## Decision 6: Route changes preserve session/time when safe

**Decision**: During browser/native route changes, preserve the active playback session and current time when the handoff is safe. If safe handoff is not possible, pause playback and report a degraded route outcome with a bounded reason.

**Rationale**: The existing HTML5/JUCE reroute code already tries to preserve position and suppress duplicate song events. The domain should make that behavior explicit and diagnosable, especially when codecs, IPC, or stale song switches cause fallback.

**Alternatives considered**:
- Always stop on route changes: rejected because it degrades current desktop/native behavior.
- Reject route changes while active: rejected because the route watcher may need to respond while a song is playing.
- Restart from beginning: rejected because it surprises users and loses practice context.

## Decision 7: Loop state belongs to playback; saved-loop persistence stays unchanged

**Decision**: Expose loop inspect/set/clear/restart/rejected/stale lifecycle through playback while leaving saved-loop API/storage unchanged.

**Rationale**: Runtime loop state is playback timing state. The existing `/api/loops` persistence and `setLoop` validation already work; the feature needs capability visibility and diagnostics, not a new storage model.

**Alternatives considered**:
- Move loops into a practice domain: rejected because loops affect immediate transport timing and seek behavior.
- Redesign saved-loop persistence: rejected as out of scope and unnecessary for the playback migration.

## Decision 8: Export pseudonymous target ids and local visible metadata only

**Decision**: Exported diagnostics use stable pseudonymous playback target ids. The local Capability Inspector may show user-visible title, artist, and arrangement already visible in the app.

**Rationale**: Support bundles can be shared outside the user's machine, so song identity and filenames need stronger privacy. Local support UI still needs enough context for the user to understand which song they are inspecting.

**Alternatives considered**:
- Export title/artist/arrangement: rejected by clarification because it can leak library contents.
- Fully redact all target identity everywhere: rejected because local troubleshooting would become harder than necessary.
- Add export-time choice: deferred because it adds settings/export UX outside this slice.

## Decision 9: Keep bounded recent history per playback session

**Decision**: Diagnostics retain bounded recent per-session outcomes and lifecycle summaries, trimming older history before current state. Use caps compatible with the existing capability snapshot budget.

**Rationale**: Stale actions, route handoffs, and wrapper bridge hits often require recent context. Full history would grow unbounded and risk leaking more than needed.

**Alternatives considered**:
- Only current state and most recent outcome: rejected because it is too little context for route/switch debugging.
- Full app-session history: rejected because it violates bounded diagnostics and grows without user value.
- User-configurable retention: deferred because settings UX is out of scope.

## Decision 10: Track compatibility bridges until removal gates pass

**Decision**: Record bridge hits for legacy `window.playSong` wrappers, legacy song events, plugin-facing `window.slopsmith` transport helpers, loop helpers, media snapshots, and direct audio-element/JUCE shims where observable.

**Rationale**: Existing bundled and external plugins rely on wrappers and event listeners. Bridge accounting proves what legacy paths still run and prevents duplicate starts from hiding during migration.

**Alternatives considered**:
- Remove wrappers immediately: rejected because external plugins would break.
- Ignore legacy usage in diagnostics: rejected because maintainers could not tell whether old paths still drive playback.
