# Capability Safety Matrix

Capability declarations include a safety class so reviewers can decide whether a domain can ship as a normal plugin contract or needs extra enforcement first.

Core domains also have a review scope. **Active contract** domains are wired to current Slopsmith behavior and should be tested as working integration points. Expected future domains are documented below, but are intentionally not registered in the runtime graph until Slopsmith ships the corresponding host UI or provider workflow.

| Domain | Owner Kind | Safety Class | Stable Commands | Provider Operations | Notes |
|--------|------------|--------------|-----------------|---------------------|-------|
| pipeline | diagnostic | diagnostic-only | resolve, inspect, validate, participant.set-enabled | none | Graph inspection, validation, and participant lifecycle diagnostics. |
| diagnostics | diagnostic | diagnostic-only | snapshot | none | Redaction-safe snapshot/export surface for support bundles and the Capability Inspector. |
| library | provider-coordinator | safe | list-providers, refresh-providers, select-provider, get-current, sync-song, inspect | query-page, query-artists, query-stats, tuning-names, get-art, sync-song | Library source selection and provider-owned song sync; provider ids are public UI labels, while provider internals stay backend-owned. |
| audio-mix | provider-coordinator | safe | inspect, list-faders, get-fader-value, set-fader-value, inspect-route, inspect-analyser, register-participant, unregister-participant | fader.get-value, fader.set-value, analyser.get-summary, route.get-current | Song route/fader/analyser summaries, committed fader values, native-over-legacy duplicate handling, and bridge accounting; no raw audio data is exposed. |
| audio-input | provider-coordinator | sensitive | inspect, list-sources, register-source, unregister-source, select-source, open-source, close-source | source.enumerate, source.describe, source.open, source.close | Source/device identity is redacted or pseudonymized per diagnostics snapshot. Inspect/list/select are prompt-free; `source.enumerate` runs only when explicitly requested; `open-source` is the permission boundary and records denied/unavailable/failed/incompatible/no-owner/no-handler outcomes without exposing live handles, buffers, samples, or raw device labels. |
| audio-monitoring | provider-coordinator | sensitive | inspect, list-providers, register-provider, unregister-provider, select-provider, start, stop, set-direct-monitor | monitoring.start, monitoring.stop, monitoring.status, monitoring.set-direct-monitor | Inspect/list/select/status are prompt-free. Fresh monitoring start requires explicit user action; background requesters may only attach to an active compatible session. Outcomes distinguish handled, stopped, denied, unavailable, degraded, failed, no-owner, no-handler, unsupported-command, incompatible, incompatible-version, provider-selection-required, and user-action-required. Diagnostics redact raw device labels, hardware ids, paths, secrets, live handles, buffers, samples, waveforms, and recordings. |
| stems | coordinator plus plugin provider | safe | inspect, mute, restore | stem.get-state, stem.apply-automation, stem.restore-automation | Core coordinates claims/overrides; the active Stems provider owns actual stem state/playback. |

Privileged commands are roadmap-only until they have: a visible user confirmation path, diagnostics redaction rules, failure recovery, and tests that prove disabled or incompatible participants cannot execute handlers.

## Expected Future Domains

These domains are expected future capability contracts, not current runtime graph entries. They should stay documentation-only until a PR adds the corresponding host workflow and tests.

| Domain | Expected Ownership Policy | Expected Safety Class | Candidate Commands | Review Gate |
|--------|---------------------------|-----------------------|--------------------|-------------|
| playback | exclusive-owner | safe | play, pause, stop, seek, snapshot, audio-element, loop-set, loop-clear, loop-get | Needs focused transport command/event tests and legacy shim accounting. |
| ui.navigation | exclusive-owner | safe | register-contribution, mount, unmount, set-visible, reorder-by-policy, navigate, inspect | Needs a UI host PR with contribution placement and route/screen semantics. |
| ui.plugin-screens | exclusive-owner | safe | register-contribution, mount, unmount, set-visible, reorder-by-policy, inspect | Needs a screen host PR with mount/unmount and visibility policy. |
| settings | exclusive-owner | sensitive | register-contribution, mount, unmount, set-visible, reorder-by-policy, inspect | Needs redaction rules and a migration story for settings metadata. |
| visualization | multi-provider | safe | register-provider, get-current, set-renderer | Needs provider ordering/selection rules and legacy highway shim attribution. |
| note-detection | multi-provider | sensitive | register, inspect | Needs performance-data redaction and provider lifecycle tests. |
| backend.routes | multi-provider | privileged | register, inspect | Needs a concrete backend route/provider workflow, privilege review, and route diagnostics. |
| ui.player-controls | exclusive-owner | safe | register-contribution, mount, unmount, set-visible, reorder-by-policy, inspect | Needs a first-party player-control host. |
| ui.player-panels | exclusive-owner | safe | register-contribution, mount, unmount, set-visible, reorder-by-policy, inspect | Needs a first-party panel host and layout policy. |
| ui.player-overlays | exclusive-owner | safe | register-contribution, mount, unmount, set-visible, reorder-by-policy, inspect | Needs overlay placement rules that coexist with legacy highway overlays. |
| plugins | exclusive-owner | privileged | enable, disable, install-missing, update, inspect | Needs explicit user confirmation for writes/install/update. |
| jobs | multi-provider | privileged | register, inspect, cancel | Needs scheduling limits, cancellation semantics, and user-visible failures. |
| midi-control | multi-provider | sensitive | register, inspect | Needs device consent and redacted diagnostics. |
| tempo-clock | multi-provider | safe | register, inspect | Needs a concrete provider and consumer workflow. |

Planned domains should also stay out of the runtime graph until Slopsmith ships the corresponding user-facing workflows.
