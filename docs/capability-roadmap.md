# Capability Roadmap

This roadmap keeps the first capability PR reviewable while making the future domain plan explicit. PR1 ships the substrate and only the domains whose current behavior is implemented, diagnosed, and tested. Future domains stay planned or reserved until the PR that implements their host workflow also adds runtime registration, compatibility shims when needed, diagnostics, and tests.

[plugin-capability-inventory.md](plugin-capability-inventory.md) is the current plugin evidence pass for this roadmap. It inventories 41 included plugins, confirms that no included manifest currently declares `capabilities`, and maps legacy behavior to recommended future domains. Roadmap entries below should be read together with that inventory: domains listed here are planned names and migration targets, while the inventory explains which real plugins are likely to use or declare them.

## PR1 Domain Set

PR1 should include these delivered domains:

| Domain | Scope | Owner Kind | Safety | Why It Is In PR1 |
|--------|-------|------------|--------|------------------|
| `pipeline` | Core diagnostic surface | diagnostic | diagnostic-only | Exposes capability graph inspection, validation, and participant enablement diagnostics. |
| `diagnostics` | Core diagnostic surface | diagnostic | diagnostic-only | Lets support bundles explain capability state safely. |
| `library` | Core app workflow | provider-coordinator | safe | Models current local and plugin-provided library sources, source selection, and song sync. |

The core/runtime domains in PR1 are intentionally small: diagnostics snapshots, pipeline graph operations, and one concrete app workflow (`library`). Runtime claim and override mechanics are covered by focused behavior tests, but no plugin-owned proving domain is promoted into the runtime graph in PR1.

`diagnostics` and `pipeline` are support domains, not feature workflow domains. `diagnostics` is the read-only snapshot/export facade consumed by support bundles and the Capability Inspector. `pipeline` is the graph operations facade: resolve, inspect, validate, and enable or disable participants.

## PR1 Compatibility Shims

PR1 does not expose expected compatibility shims for `library`. Library is implemented as a native provider-coordinator domain; provider attribution comes from backend `owner_plugin_id` metadata and browser runtime provider participants.

Future domains should not add expected shim entries until their own implementation PR. A domain PR owns its compatibility story.

## Audio Graph/Session Slice

The audio graph/session slice promotes these domains after PR1:

| Domain | Scope | Owner Kind | Safety | Compatibility Bridges |
|--------|-------|------------|--------|-----------------------|
| `audio-mix` | Song volume, fader participants, route summary, analyser bridge accounting | provider-coordinator | safe | `audio-mix.fader-registry`, `audio-mix.song-volume`, `audio-mix.analyser` |
| `audio-input` | Redaction-safe input source registration, selection, and availability | provider-coordinator | sensitive | `audio-input.legacy-source` |
| `audio-monitoring` | Monitoring lifecycle and audio startup barrier readiness | provider-coordinator | sensitive | `audio-monitoring.audio-barrier` |
| `stems` | Stem automation claims and active provider status | coordinator plus plugin provider | safe | `stems.master-volume`, `stems.private-state` |

`core.audio.session` is the runtime coordinator for all four domains. It owns `audio-mix`, `audio-input`, and `audio-monitoring`; for `stems`, it coordinates the active Stems provider without replacing the Stems plugin as the owner of actual stem playback/state.

This slice intentionally does not replace every legacy audio API. In particular, `window.slopsmith.audio.registerFader(...)` remains the executable mixer UI/control surface until a focused audio-mix control-plane slice adds command handlers, provider operations, committed-value events, and compatibility removal gates.

## Recommended Next Slices

The plugin inventory suggests this migration order after the audio graph/session slice:

1. `audio-mix` control plane: make faders executable through capability commands and provider operations so `registerFader(...)` can become a compatibility wrapper only.
2. `playback`: replace `window.playSong`/transport wrapper chains with transport commands, media snapshot access, and lifecycle events.
3. `jobs`: coordinate conversion, import, update, preview, and studio work with progress, cancellation, retry, and terminal failure semantics.
4. `note-detection`: formalize note-state providers, calibration diagnostics, audio-input coupling, and hit/miss event flow.
5. UI contribution host: migrate navigation, plugin screens, player controls, player panels, overlays, shortcuts, and guided tours under placement/lifecycle policy.
6. Backend and privileged capability cleanup: migrate routes, plugin lifecycle, media import/export, recording, external services, and subprocess-backed workflows with explicit user confirmation and diagnostics redaction.

## UI/UX Migration Path

This is the recommended order for UI/UX capability work only. It excludes audio semantics, backend route execution, media jobs, and plugin install/update behavior except where those systems need a visible contribution point.

| Order | Slice | Domains | Legacy Surfaces To Bridge | Migration Target | Removal Gate |
|-------|-------|---------|---------------------------|------------------|--------------|
| 1 | UI contribution substrate | `ui.navigation`, `ui.plugin-screens`, `settings`, `ui.player-controls`, `ui.player-overlays`, `ui.player-panels` | Manifest `nav`, `screen`, `settings`, direct DOM insertion, screen-specific globals | Shared contribution registry with regions, ordering, mount/unmount, visibility, focus, teardown, diagnostics, and compatibility shim accounting | Every legacy UI field is represented as a contribution in diagnostics, with no duplicate mounts after script rehydration. |
| 2 | App navigation and plugin screens | `ui.navigation`, `ui.plugin-screens` | `window.showScreen` wrappers, plugin nav entries, ad hoc screen initialization | Central screen host that owns navigation events, plugin screen lifecycle, current-screen state, and back/restore behavior | Plugins can register screens without wrapping `showScreen`; legacy wrappers are observed only as compatibility hits. |
| 3 | Settings contribution host | `settings` | Manifest `settings.html`, plugin settings panels, settings backup hints | Settings registry with panel metadata, redaction class, backup/import allowlist summary, visibility policy, and diagnostics | Settings UI can render from registered contributions; settings values remain plugin-owned and redacted. |
| 4 | Keyboard and command UX | `keyboard-shortcuts` plus UI host regions | `window.registerShortcut`, panel-scoped shortcut helpers, help panel entries | Shortcut contribution registry with scope, priority, conflict reporting, enable/disable state, and help metadata | Shortcut conflicts are diagnosable and panel-scoped shortcuts do not require private registries. |
| 5 | Player controls | `ui.player-controls` | Direct player control DOM edits, control popovers, button/slider globals | Ordered player-control regions with stable command buttons, popovers, sliders, disabled states, and contribution teardown | Player controls can be added/removed/reordered without plugins mutating the control bar directly. |
| 6 | Player overlays | `ui.player-overlays`, `tours` | Overlay canvases, tour overlays, highway visibility listeners, direct z-index management | Overlay host with anchors, z-order, hit-testing, renderer compatibility flags, visibility events, and cleanup | Fretboard, section map, tours, transpose, step mode, and similar overlays can coexist without private layering rules. |
| 7 | Player panels | `ui.player-panels` | Splitscreen panel DOM, panel-local highway instances, panel-local shortcuts | Panel host with layout slots, active-panel focus, per-panel renderer selection, per-panel shortcuts, visibility, and teardown | Splitscreen-style panels can be composed through host APIs instead of wrapping playback/screen globals. |
| 8 | Visualization UX | `visualization` | `type: "visualization"`, `window.slopsmithViz_*`, viz picker state, auto-match hooks | Renderer provider registry with picker integration, auto-match ordering, context-type metadata, fallback/revert events, and per-panel selection | Renderer selection and failure recovery are fully attributed in diagnostics; picker options no longer depend on global scans. |
| 9 | Library and guided UX extensions | `ui.library-card-injection`, `tours` | Library card buttons, tour registration globals, target selectors | Contribution APIs for library card actions and guided-tour steps with applicability, target resolution, and action-result events | Library actions and tours can be inspected, disabled, and tested independently of plugin-private DOM injection. |
| 10 | Theme and polish surfaces | `settings` or candidate `ui.theme` | Global theme settings, direct stylesheet/class mutation | Theme contribution metadata for tokens, selected theme, preview/apply/restore lifecycle, and diagnostics without user secrets | Themes are reversible and attributable, and visual changes do not depend on hidden global state. |

The UI contribution substrate should land first because every later UI/UX slice needs the same basic primitives: contribution identity, stable regions, deterministic ordering, mount/unmount, visibility, focus, teardown, diagnostics, and compatibility shim hit accounting. Specialized UI domains should stay small and should only add behavior that the shared substrate cannot express cleanly.

UI/UX migration should preserve current plugin fields during the transition. Core can translate manifest `nav`, `screen`, and `settings` into contribution records before plugin scripts hydrate, then let runtime plugins re-register richer metadata when their scripts load. The removal gate for each legacy UI API is not just a new command name; it is proof that repeated script hydration, screen switching, player navigation, and plugin disable/enable cycles do not duplicate DOM nodes, wrappers, listeners, shortcuts, canvases, or tours.

## Deferred Domains

These domains are planned but should stay out of the runtime graph until a host workflow exists:

| Domain | Expected Ownership | Expected Safety | Candidate Scope | Implementation Trigger |
|--------|--------------------|-----------------|-----------------|------------------------|
| `stems` | coordinated plugin provider | safe | Stem mute/restore, ownership claims, manual override events, and requester/observer coordination. | Promoted by the audio graph/session slice as a coordinated provider domain. |
| `playback` | exclusive-owner | safe | Transport, seek, loop, media snapshot, and song lifecycle events. | A focused playback facade PR with command/event tests and legacy transport shim accounting. |
| `ui.navigation` | exclusive-owner | safe | Navigation contributions and screen-change events. | A UI host PR that owns contribution placement and route/screen semantics. |
| `ui.plugin-screens` | exclusive-owner | safe | Plugin screen registration and lifecycle. | A screen host PR with mount/unmount and visibility policy. |
| `settings` | exclusive-owner | sensitive | Plugin settings contribution metadata without settings values. | A settings contribution PR with redaction rules and migration story. |
| `visualization` | multi-provider | safe | Renderer providers, overlay participation, and renderer selection. | A visualization PR that defines provider ordering/selection and legacy highway shim attribution. |
| `audio-mix` | multi-provider | safe | Mixer fader registration and current fader inspection. | Promoted by the audio graph/session slice. |
| `audio-monitoring` | multi-provider | sensitive | Native/audio-input barrier participation and monitoring lifecycle. | Promoted by the audio graph/session slice. |
| `note-detection` | multi-provider | sensitive | Note-state providers and note event integration. | A note-detection PR with performance-data redaction and provider lifecycle tests. |
| `backend.routes` | multi-provider | privileged | Server route/provider participation and route inspection. | A backend domain PR with concrete core/provider workflow, privilege review, and route diagnostics. |
| `ui.player-controls` | exclusive-owner | safe | Player-control contributions and ordering. | A first-party player-control host and layout policy. |
| `ui.player-panels` | exclusive-owner | safe | Player panel contributions, mount/unmount, visibility, ordering. | A panel host with layout and focus rules. |
| `ui.player-overlays` | exclusive-owner | safe | Overlay contributions layered over player or highway surfaces. | Overlay placement and z-order rules that coexist with legacy overlays. |
| `plugins` | exclusive-owner | privileged | Plugin enable/disable/install/update workflows. | Visible user confirmation, rollback, and disabled-handler enforcement. |
| `jobs` | multi-provider | privileged | Long-running jobs, cancellation, status, failures. | Scheduling limits, cancellation semantics, and user-visible failures. |
| `midi-control` | multi-provider | sensitive | MIDI device providers and control mappings. | Device consent and redacted diagnostics. |
| `audio-input` | multi-provider | sensitive | Audio input device providers and lifecycle. | Promoted by the audio graph/session slice. |
| `tempo-clock` | multi-provider | safe | Tempo/clock provider registration and consumers. | A concrete tempo source and consumer workflow. |

Deferred domains may remain documented or reserved, but they should not produce expected shims, inspector links, or runtime handlers before their implementation slice.

## Candidate Domains From Plugin Inventory

These candidate domains were surfaced by the included plugin inventory but are not yet part of the core deferred-domain table. They should be promoted only if a focused spec proves that the boundary is clearer than folding the behavior into an existing domain.

| Candidate Domain | Expected Ownership | Expected Safety | Candidate Scope | Initial Evidence |
|------------------|--------------------|-----------------|-----------------|------------------|
| `ui.library-card-injection` | exclusive-owner | safe | Library card actions, placement, applicability, enabled/disabled state, and action-result events. | Find More and Sloppak Converter add library-card actions that are separate from browsable library providers. |
| `tours` | exclusive-owner | safe | Guided tour registration, eligibility, target resolution, step lifecycle, and screen/navigation dependencies. | Library/settings tours, tutorials, and guided plugin walkthroughs use tour-specific lifecycle behavior. |
| `keyboard-shortcuts` | exclusive-owner | safe | Shortcut contribution registration, scope, conflict resolution, enable/disable state, and help-panel metadata. | Splitscreen, Step Mode, and practice-style plugins use or imply scoped shortcuts beyond normal UI placement. |
| `media-import-export` | multi-provider | privileged | Upload/import/export/conversion requests, accepted file types, generated artifacts, cleanup, and failure semantics. | Editor, Tab Import, Profile Import, Sloppak Converter, Studio, and Rig Builder all move user files through backend workflows. |
| `recording` | multi-provider | sensitive | Arm/start/stop capture, take upload/import, capture-source binding, latency metadata, and storage cleanup. | Studio and karaoke workflows need capture/session semantics distinct from raw audio input. |
| `audio-effects` | multi-provider | sensitive | Effect-chain registration, model/IR inventory, preset load/save, parameter get/set, bypass, and native bridge availability. | NAM Tone, Tones, Rig Builder, MIDI Amp, and Audio Engine all manipulate effect or tone-processing state. |
| `practice-session` | multi-provider | safe | Practice session lifecycle, goals, score/progress events, chart segment focus, and journal persistence boundaries. | Practice Journal, Minigames, Guitar Theory, Flappy Bend, and Note Detect imply practice/progression state. |
| `collaboration` | multi-provider | sensitive | Room/session lifecycle, participant identity redaction, shared playback sync, conflict policy, and disconnect recovery. | Multiplayer is a distinct real-time coordination surface. |
| `external-services` | diagnostic or privileged metadata | privileged | Network/download/subprocess integration inventory, endpoint attribution, confirmation policy, and failure diagnostics. | Update Manager, Find More, Sloppak Converter, and media jobs reach outside local Slopsmith state. |

Candidate domains can also remain as safety metadata on existing domains. For example, `external-services` may be more useful as a cross-cutting review tag than as a dispatchable runtime capability.

## Domain Versioning

PR1 does not add per-domain versioning. The `capability-pipelines.v1` standard versions the overall manifest/runtime/diagnostics contract. Domain evolution follows compatibility rules:

- Adding optional commands, events, diagnostics fields, or participant metadata is non-breaking.
- Removing or renaming commands/events is breaking.
- Changing ownership semantics is breaking.
- Changing command payloads, return payloads, or dispatch outcomes incompatibly is breaking.
- A breaking change requires either a future `capability-pipelines` version or a clearly new domain name if parallel support is needed.

Per-domain versions should wait until Slopsmith has a concrete need for multiple incompatible versions of the same domain to coexist.

## Future Domain PR Checklist

A PR that promotes a deferred domain into the runtime graph should include:

1. User value and included/excluded command scope.
2. Host workflow or provider implementation.
3. Runtime domain review metadata.
4. Manifest and runtime registration path.
5. Compatibility shims only for legacy behavior the PR actually bridges.
6. Diagnostics fields and redaction rules.
7. Inspector behavior and meaningful labels/tooltips.
8. Tests for valid metadata, invalid metadata, unsupported versions, disabled participants, command outcomes, and shim hit accounting.
9. Documentation updates in the safety matrix and capability docs.
