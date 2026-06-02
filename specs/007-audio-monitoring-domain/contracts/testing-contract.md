# Contract: Testing And Validation

## JS Runtime Tests

Primary command:

```bash
npm run test:js
```

Focused tests should extend or add cases around:

- [tests/js/audio_session_monitoring.test.js](../../../tests/js/audio_session_monitoring.test.js)
- [tests/js/audio_session_input.test.js](../../../tests/js/audio_session_input.test.js)
- [tests/js/audio_session_compat.test.js](../../../tests/js/audio_session_compat.test.js)
- [tests/js/audio_session_host.test.js](../../../tests/js/audio_session_host.test.js)
- [tests/js/capability_inspector_render.test.js](../../../tests/js/capability_inspector_render.test.js)

## Required Scenario Coverage

1. Provider registration is idempotent and diagnostics show one visible provider per logical monitoring path.
2. Native providers suppress compatibility-backed duplicates with the same logical monitoring key.
3. `inspect` is prompt-free and does not call provider `monitoring.start` or audio-input `source.open`.
4. Single provider start with selected source creates an active session and emits monitoring started state.
5. Multiple providers with no selected/default provider return `provider-selection-required`.
6. Fresh background/plugin starts from stopped state return `user-action-required`.
7. Background/plugin requester attaches to an already active compatible session.
8. Two compatible requesters share one provider session and stop only after the final requester releases.
9. Stop failure marks the session failed/ambiguous and records a safe outcome.
10. Missing selected input, denied input, unavailable input, incompatible channel shape, incompatible contract version, and no usable output return distinct blocking outcomes.
11. High latency, unsupported direct-monitor control, and partial non-critical routing create active degraded sessions when input/output remain usable.
12. Direct-monitor requester conflicts produce degraded/unsupported status without changing the user/default setting.
13. Active monitoring survives song switch and playback stop events where the audio-session host can observe them.
14. Reload restoration restores provider/source preference but leaves live monitoring stopped.
15. Provider disappearance or disablement marks active sessions unavailable/orphaned/degraded with safe reasons.
16. Diagnostics contain no raw audio buffers, waveforms, recordings, MediaStream/AudioNode/native handles, raw device labels, stable hardware identifiers, local paths, or secrets.
17. Compatibility bridge hits for `audio-monitoring.audio-barrier` and legacy starts/stops/direct-monitor toggles are recorded and bounded.
18. Capability Inspector renders monitoring providers, selected provider, sessions, requesters, direct-monitor state, bridges, and recent outcomes without duplicate cards.

## Syntax Checks

```bash
node --check static/capabilities/audio-session.js
node --check plugins/capability_inspector/screen.js
```

## Browser Smoke Tests

Run browser tests when visible inspector/player UI changes land:

```bash
npm test -- tests/browser/check-errors.spec.ts
```

Manual smoke should confirm:

- Capability Inspector shows Audio Monitoring with providers and sessions.
- User monitoring toggle can start/stop via the domain.
- Plugin background start does not silently activate live audio from stopped state.
- Direct-monitor mute status changes are visible within 1 second for providers that support it.

## Python Tests

No backend/schema change is planned. Run focused pytest only if diagnostics export/import or backend plugin metadata changes:

```bash
uv run pytest tests/test_diagnostics_bundle.py tests/test_plugins.py -v
```

Run the full suite if implementation touches shared backend diagnostics or plugin loading:

```bash
uv run pytest
```

## Acceptance Gate

The feature is task-ready when all generated tasks can map to at least one scenario above and when `research.md`, `data-model.md`, and this contract contain no unresolved clarification markers.
