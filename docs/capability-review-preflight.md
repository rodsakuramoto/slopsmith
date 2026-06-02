# Capability Slice Review Preflight

Use this preflight before opening the next capability-slice PR. It captures the review patterns found while landing the audio/input/monitoring/playback slices, so a future slice should only need to analyze this document plus the immediately previous PR for newly discovered review themes.

## How To Use This

1. Read this checklist before creating the PR.
2. Scan the new slice for each pattern below.
3. Add focused regression tests for every pattern that applies to the new domain.
4. Then inspect only the last merged capability PR for new reviewer feedback that is not already covered here.

## Identity And Authority

- Command attribution must come from the capability dispatch caller (`requester` / `source`), not from payload fields such as `requesterId`.
- Payload identity is allowed only on explicit registration commands, such as `register-requester`, `register-observer`, or provider/source registration surfaces.
- Docs and examples must not tell callers to pass ignored identity fields in command payloads.
- Shared-session release paths must verify the releasing requester owns that attachment. A spoofed payload must not release another requester.
- User-action boundaries must be explicit. Fresh audible or live-input starts from background code should return `user-action-required`; background requesters may attach only to already-active compatible sessions when the contract allows it.

## Redaction And Diagnostics

- Treat all local storage, provider replies, adapter replies, bridge payloads, event details, command payloads, and dispatch caller strings as untrusted.
- Exported diagnostics must not contain raw filenames, titles, artists, paths, URLs, secrets, API keys, tokens, device labels, hardware ids, media/native handles, buffers, samples, waveforms, recordings, route-private objects, or provider-private objects.
- Redact before normalizing ids. Charset-only sanitizers can preserve path or token fragments such as `Users-me-plugin-token-abc`.
- Filter raw keys after normalizing camelCase to snake_case, so names like `accessToken`, `apiKey`, `nativeHandleRef`, `rawDeviceId`, and `mediaStream` are caught.
- Allow safe display fields only through an explicit allowlist. Do not let a general `label` exemption reintroduce raw device labels.
- Stored ids or persisted selections must be accepted only if they are already redaction-safe; otherwise ignore and clear them when possible.
- Bridge entries are exported verbatim enough to deserve the same redaction/bounding as command outcomes.

## Outcomes And Provider Results

- Propagate explicit provider/adapter outcomes when they are part of the domain contract. Do not collapse `no-handler`, `no-owner`, `unsupported-command`, `incompatible-version`, `overridden`, or similar actionable statuses into generic `degraded` or empty success.
- A provider list/enumerate command with providers but no matching handler should return `no-handler`, not `handled` with an empty list.
- Malformed provider or adapter results should be `failed` or another explicit contract outcome. Void/missing fields must not be treated as successful active/handled state.
- Command return values, recent outcomes, lifecycle events, and inspector display should agree on the same outcome/status names.
- If a command records an outcome on an early return, diagnostics must be refreshed immediately. In current hosts this usually means routing through the central outcome helper that calls the diagnostic touch/contribution path.

## Identifier Semantics

- Document whether each id is a public round-trip handle, an internal generated id, or a per-snapshot pseudonym.
- Do not compare raw caller ids against pseudonyms from diagnostics snapshots.
- If duplicate providers can share a logical key, disambiguate with all fields that define the selected winner, such as provider id, source mode, route kind, or channel shape.
- Generated internal ids that need intra-snapshot correlation may remain stable within that snapshot. Untrusted caller-supplied ids should be bounded, redacted, hashed, or pseudonymized before export.
- Use one pseudonymizer for a batch when returning multiple related records, so distinct raw ids do not all become the same `source-01`/`route-01` style value.

## Lifecycle And Teardown

- Session replacement must close or finalize provider-owned live resources before discarding the old session state.
- Stop paths and route/session switches should emit the same redaction-safe summary shape as normal close/ended paths.
- Prompt-free commands such as inspect, list, and status must not trigger provider enumeration, permission prompts, device opening, or route activation.
- Optional fields need precise fallback semantics. If an optional disambiguator is omitted, fallback only when the match is unambiguous; if the caller supplied an explicit but wrong disambiguator, fail instead of touching a different session.

## Schema And Docs

- Every emitted event name should have one payload shape. Avoid ad-hoc degraded/denied payloads that omit fields present in the success shape.
- Contract request shapes must match fields read by the runtime. Remove fields the runtime ignores, and document separate fields such as `storageStatus` instead of inventing extra enum values.
- Data-model docs must match actual implementation semantics, especially global-vs-provider-scoped ids, `supersededBy` meanings, restore statuses, and outcome enums.
- Recipes should use realistic dispatch caller values: `source: 'user'` for user preference changes, plugin ids for plugin work, and no payload identity when attribution comes from dispatch.

## Tests To Add Per Slice

- Anti-spoofing: payload `requesterId` must not override the dispatch caller for control commands.
- Redaction: unsafe caller ids, persisted values, bridge payloads, provider results, adapter results, nested payloads, and camelCase raw keys must not appear in exported diagnostics or events.
- Outcome preservation: provider/adapter `denied`, `failed`, `degraded`, `no-owner`, `no-handler`, `unsupported-command`, `incompatible-version`, and domain-specific outcomes should round-trip exactly when supported.
- Diagnostics freshness: early denied/no-owner/no-handler/failed returns must update the exported diagnostics contribution immediately.
- Schema consistency: denied/degraded/unavailable events should have the same summary shape as handled events for the same command family.
- Duplicate identity: native-vs-compatibility or multi-provider duplicates should resolve to the selected/canonical winner and reject non-selected hints.
- Teardown: stop/session-switch paths should close live provider resources and preserve diagnosable final state.
- Documentation grep: scan for stale `requesterId` payload examples, removed enum values, unsupported request fields, and bridge ids that do not exist at runtime.

## Validation Baseline

For each slice, run the focused suite for the domain plus the cross-domain regression suite it touches. Also run:

```bash
git diff --check origin/main..HEAD
node --check static/capabilities.js
python3 -m py_compile tests/test_plugin_runtime_idempotence.py
```

Add domain-specific `node --check` and `node --test` commands to the slice quickstart, including the core capability host and any inspector or adapter files changed by the slice.