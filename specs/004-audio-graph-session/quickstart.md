# Quickstart: Audio Graph/Session Capability Slice

Use this guide to validate the planned implementation before moving to `/speckit-tasks` and again before PR review.

## 1. Read The Governing Artifacts

- [spec.md](spec.md)
- [plan.md](plan.md)
- [research.md](research.md)
- [data-model.md](data-model.md)
- [legacy-inventory.md](legacy-inventory.md)
- [checklists/domain-migration.md](checklists/domain-migration.md)
- [contracts/audio-domain-contract.md](contracts/audio-domain-contract.md)
- [contracts/migration-notes.md](contracts/migration-notes.md)
- [specs/003-migrate-capability-domains/spec.md](../003-migrate-capability-domains/spec.md)

## 2. Implementation Order

1. Add the core audio session host for each active player/song.
2. Register native runtime owners/coordinators for `audio-mix`, `audio-input`, and `audio-monitoring`; coordinate `stems` without replacing the Stems plugin as the semantic owner of stem playback/state.
3. Bridge the existing fader registry and song-volume behavior into `audio-mix` diagnostics.
4. Bridge current stem master/analyser behavior and automation requests into `stems` and `audio-mix` diagnostics.
5. Bridge monitoring/input handshakes with redacted source identity and per-bundle pseudonyms.
6. Update Capability Inspector and docs so active audio domains show owners, participants, bridge hits, and outcomes.
7. Add tests for native paths, compatibility paths, missing/disabled/incompatible participants, redaction, and no-net-legacy-growth evidence.

## 3. Representative Validation Scenarios

### Route And Mix Consistency

- Play a PSARC song and set the Song fader.
- Play a sloppak/stem-backed song and confirm the same visible fader intent applies.
- If optional desktop/JUCE audio is active, confirm fallback/degraded outcomes are diagnosable.

Expected result: PSARC and stem-backed paths respect the same visible choice or report a clear degraded route/fader outcome.

### Stem Automation And Manual Override

- Start a requester that asks to mute or duck a stem.
- Manually unmute or adjust the stem while automation is active.
- Release or restore the requester claim.

Expected result: manual user action wins, automation is marked `overridden`, and no requester reads or writes private stem state through the native path.

### Analyser Compatibility

- Enable a bundled analyser consumer such as 3D Highway audio reactivity.
- Switch between PSARC and sloppak/stem-backed songs.
- Inspect diagnostics after a route switch.

Expected result: analyser source is attributed as native or bridged, and singleton/Web Audio conflicts are reported as unavailable/conflict states or redaction-safe reasons.

### Input And Monitoring Privacy

- Attempt monitoring with an available source.
- Attempt monitoring with permission denied or source unavailable.
- Export diagnostics.

Expected result: permission-denied outcomes, unavailable source statuses, active monitoring, and failed monitoring are distinct; source/device identity is redacted or represented only by per-bundle pseudonyms.

### Compatibility Bridge Accounting

- Exercise legacy `registerFader`, Stems master volume, analyser access, and monitoring barrier behavior.
- Open Capability Inspector or inspect diagnostics.

Expected result: each legacy hit is attributed to a bridge and domain; bridge failures are distinguishable from native capability failures.

## 4. Suggested Automated Checks

From the repository root:

```bash
node --check static/capabilities.js
node --check static/capabilities/library.js
node --check static/capabilities/audio-session.js
node --check static/audio-mixer.js
node --check static/highway.js
node --check plugins/capability_inspector/screen.js
node --test tests/js/*.test.js
uv run pytest tests/test_diagnostics_bundle.py tests/test_plugin_runtime_idempotence.py tests/test_plugins.py -q
```

If `pytest` is available directly in your environment, the `uv run` prefix is optional.

## 5. Implementation Evidence

- Focused JS validation through US4: `node --test tests/js/audio_session_*.test.js tests/js/legacy_shim_hits.test.js tests/js/capabilities_diagnostics.test.js tests/js/capabilities_ownership.test.js tests/js/capabilities_claims.test.js tests/js/capability_inspector_render.test.js` passed with 42 tests.
- Final audio-session JS validation: `node --test tests/js/audio_session_*.test.js tests/js/legacy_shim_hits.test.js` passed with 24 tests.
- Focused Python validation: `uv run pytest tests/test_diagnostics_bundle.py tests/test_plugin_runtime_idempotence.py tests/test_plugins.py -q` passed with 169 tests and 2 skipped tests.
- Browser smoke validation: `npx playwright test tests/browser/audio-session.spec.ts tests/browser/audio-session-compat.spec.ts` passed with 2 tests. Docker was unavailable in the local environment, so the server was started directly with `PYTHONPATH=.:lib uv run uvicorn server:app --host 127.0.0.1 --port 8000` for this check.
- Compatibility bridges covered: `audio-mix.fader-registry`, `audio-mix.song-volume`, `audio-mix.analyser`, `audio-input.legacy-source`, `audio-monitoring.audio-barrier`, `stems.master-volume`, and `stems.private-state`.
- Stems ownership note: `core.audio.session` is a `coordinator`; active stem playback/state remains owned by the registered Stems provider.
- Omitted optional checks: none for this slice. Full-repo Playwright and full Python test runs remain broader release checks outside this feature's task list.
- Support walkthrough timing: Capability Inspector can filter to `audio-mix`, `audio-input`, `audio-monitoring`, or `stems`, review route/participant/bridge outcomes, and confirm redaction-safe audio-session diagnostics in under five minutes using the focused browser smoke path above.

## 6. Review Gates

Before `/speckit-tasks` output is considered implementation-ready, confirm:

- The per-domain migration checklist is still complete.
- The legacy inventory still shows no net increase in legacy-only integration points.
- Each compatibility bridge has diagnostics and a migration note.
- Sensitive audio-input and monitoring diagnostics use per-bundle pseudonyms only.
- Playback/transport and note-detection responsibilities remain out of this slice except as consumers of audio-session facts.
