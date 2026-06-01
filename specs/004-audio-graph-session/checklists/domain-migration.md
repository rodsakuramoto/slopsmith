# Per-Domain Migration Checklist: Audio Graph/Session

**Feature**: [spec.md](../spec.md)
**Reference Standard**: [specs/003-migrate-capability-domains/spec.md](../../003-migrate-capability-domains/spec.md)
**Status**: Implemented through US5 and polish validation; final validation evidence recorded in quickstart.md

## Domain Contract

- [x] Domain name or domain family is named.
- [x] Owner is identified.
- [x] Participant roles are listed.
- [x] Public commands are listed.
- [x] Provider operations are listed when applicable.
- [x] Emitted and observed events are listed when applicable.
- [x] Safety class is stated.
- [x] Included scope is stated.
- [x] Excluded scope is stated.

## Host Boundary And Architecture Improvement

- [x] Real host workflow or provider workflow is described.
- [x] Domain host boundary is identified.
- [x] Slice explains how new behavior avoids legacy-only globals, wrapper chains, direct DOM mutation, private state access, or plugin-specific handshakes.
- [x] At least one architecture improvement is documented.
- [x] Residual legacy behavior is documented with owner, risk, and follow-up gate.

## Compatibility Bridge

- [x] Covered legacy surfaces are listed.
- [x] Compatibility bridge behavior is described.
- [x] Legacy path preserves equivalent user-visible behavior during transition.
- [x] Bridge failure is distinguishable from native capability failure.
- [x] Unused legacy surfaces, if any, have documented proof.

## Diagnostics And Inspector

- [x] Applicable outcomes are listed.
- [x] Diagnostics identify domain, owner or participant, bridge if any, and outcome.
- [x] Capability Inspector or equivalent support-surface behavior is described.
- [x] Sensitive or privileged data has redaction/consent/confirmation expectations.

## Deprecation

- [x] Each legacy surface has a deprecation state.
- [x] New bundled code is blocked from deprecated legacy patterns once replacement exists.
- [x] Removal is blocked until bundled migration, external review, migration notes, and warning/diagnostics window are complete.

## Per-Slice Legacy Inventory

- [x] Inventory records added legacy surfaces.
- [x] Inventory records removed legacy surfaces.
- [x] Inventory records migrated legacy surfaces.
- [x] Inventory records contained legacy surfaces.
- [x] Inventory records remaining legacy surfaces.
- [x] Inventory proves no net increase in legacy-only integration points.

## Testing And Review Evidence

- [x] New capability path has validation coverage.
- [x] Compatibility path has validation coverage.
- [x] Equivalent user-visible behavior is validated during transition.
- [x] Missing/disabled/incompatible participants are validated where applicable.

## Migration Notes

- [x] Plugin-author migration notes are included or linked.
- [x] Notes identify legacy surface and replacement path.
- [x] Notes explain compatibility period, warnings/diagnostics, and removal gate.

## Parallel Coordination

- [x] Shared runtime primitives touched by the slice are listed.
- [x] Overlap with active domain slices is documented.
- [x] Owner and sequencing are clear when overlap exists.

## Exceptions

| Item | Exception | Owner | Risk | Follow-up gate |
|------|-----------|-------|------|----------------|
| None | None | N/A | N/A | N/A |
