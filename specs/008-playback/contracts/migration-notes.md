# Contract: Playback Migration Notes

## Goal

Move plugins and bundled code from private playback globals and wrapper chains to the `playback` capability domain without breaking existing behavior during migration.

## Legacy Surfaces Kept During Migration

These surfaces remain usable while bridge accounting is active:

- `window.playSong(filename, arrangement)`
- `window.slopsmith.seek(seconds, reason)`
- `window.slopsmith.setLoop(a, b)`
- `window.slopsmith.clearLoop()`
- `window.slopsmith.getLoop()`
- `window.slopsmith` song lifecycle events such as `song:loading`, `song:play`, `song:pause`, `song:resume`, `song:seek`, `song:ended`, `song:position-changed`
- Direct `audio.currentTime`, `audio.play()`, and `audio.pause()` shims while JUCE/native route mode is active

Legacy use should record bridge hits when observable.

## New Requester Pattern

Plugins that want playback information should inspect or observe:

```js
const api = window.slopsmith && window.slopsmith.capabilities;
const state = await api.dispatch({
    capability: 'playback',
    command: 'inspect',
    source: 'my_plugin',
    args: {},
});
```

Plugins that want to control an already-active session should dispatch permitted commands:

```js
await api.dispatch({
    capability: 'playback',
    command: 'seek',
    source: 'my_plugin',
    args: { time: 42, reason: 'practice-jump' },
});
```

Fresh audible starts require explicit user action. A background plugin must not start playback from idle or stopped state.

## New Observer Pattern

Plugins should observe playback lifecycle through capability events or the documented event bridge instead of wrapping `window.playSong`:

```js
window.slopsmith.on('playback:started', (event) => {
    const detail = event.detail;
    // Redaction-safe target/session/timing summary.
});
```

During migration, existing `song:*` events remain available, but new code should prefer playback-domain events when they exist.

## Wrapper Migration Guidance

Existing wrapper:

```js
const originalPlaySong = window.playSong;
window.playSong = async function(filename, arrangement) {
    await originalPlaySong.call(this, filename, arrangement);
    afterSongStarted(filename, arrangement);
};
```

Target behavior:

- Register as a playback observer.
- Use `playback:started`, `playback:ready`, `playback:paused`, `playback:seeked`, and `playback:ended` events.
- Use `playback.inspect` to recover current state when the observer hydrates late.
- Avoid starting playback from background plugin code.

## User Action Boundary

Allowed without user action:
- Inspect state.
- Subscribe to lifecycle events.
- Register requester/observer metadata.
- Control an already-active session when the command is permitted and not overridden by user priority.

Requires user action:
- Fresh audible playback start from idle, stopped, or no-session state.
- Selecting a new target that begins playback.

## Conflict Policy

- Explicit user actions win over plugin/automation requests.
- Same-priority requests use latest non-stale request wins.
- Losing requests are reported as `denied`, `stale`, `cancelled`, or `overridden`.

## Route Change Policy

- Browser/native route changes preserve the playback session and current time when safe.
- Unsafe handoff pauses playback and reports degraded.
- Route changes do not transfer ownership to audio-mix, audio-input, audio-monitoring, stems, or audio-effects.

## Bridge Removal Gates

Do not remove legacy playback bridges until all gates pass:

1. Bundled plugins use playback-domain observer/requester paths for normal playback workflows.
2. External migration docs and recipes exist for replacing `window.playSong` wrappers.
3. Normal player smoke tests show no unexpected `playback.window-play-song` bridge hits from bundled code.
4. Repeated plugin hydration creates no duplicate playback observers, requesters, wrappers, or bridge entries.
5. Native playback-domain commands and legacy wrappers never create duplicate user-visible transport actions.
6. Diagnostics distinguish no-target, unavailable, failed, denied, stale, degraded, stopped, and ended scenarios.
7. Exported diagnostics contain pseudonymous target ids only and no raw song metadata, paths, handles, route-private objects, or audio data.
8. Browser/native route-change scenarios either preserve session/time or pause degraded with a safe reason.
