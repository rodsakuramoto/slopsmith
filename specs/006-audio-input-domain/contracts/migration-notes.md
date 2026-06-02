# Migration Notes: Audio Input Control Plane

## For Source Providers

Move provider-owned source identity into `audio-input` registration:

1. Declare `audio-input` provider intent in `plugin.json`.
2. Register each source with `sourceId`, `providerId`, safe `logicalSourceKey`, `kind`, `availability`, and `channelSummary`.
3. Keep actual capture handles private to the provider or downstream domain.
4. Implement provider-owned `source.describe`, `source.open`, and `source.close` where applicable.
5. Return explicit denied, unavailable, failed, or incompatible state instead of throwing raw platform errors.
6. Re-register on hydration with the same logical source key; core updates last-seen metadata and suppresses duplicates.

## For Requesters

Replace plugin-private input reads with control-plane commands:

1. Use `inspect` or `list-sources` to read selected source, availability, and channel summary without prompting.
2. Use `select-source` only for user preference changes; do not use it to start capture.
3. Use `open-source` when live input starts and include `requesterId`, `purpose`, and `requiredChannelShape` when needed.
4. Use `close-source` when live input stops.
5. Treat `denied`, `unavailable`, `failed`, and `incompatible` distinctly in UI/support messages.

## For Legacy Bridges

Existing browser, desktop/native, and plugin-specific input handoffs remain usable during migration.

Bridge requirements:

- Record `audio-input.legacy-source` hits when a legacy path participates.
- Map legacy state into compatibility-backed sources only when safe metadata exists.
- Prefer native source state when native and compatibility records share a logical source key.
- Keep compatibility-backed records in diagnostics with `compatibility-backed` or `overshadowed` status.

## Removal Gates

Legacy-only input paths can be removed after all gates pass:

- Bundled input providers register native audio-input sources.
- Bundled requesters inspect/open/close through audio-input or downstream domains that consume audio-input state.
- Diagnostics in normal representative scenarios show no unexpected `audio-input.legacy-source` hits.
- Repeated plugin hydration does not duplicate sources.
- App reload restores or reports the same logical source without silently selecting another source.
- Browser/manual permission scenarios confirm inspect/list/select stay prompt-free.

## Out Of Scope

This migration does not implement note scoring, monitoring DSP, recording capture, audio effects, playback transport, plugin installation, or a new backend source service. Those domains may consume audio-input state later, but they own their own live processing behavior.