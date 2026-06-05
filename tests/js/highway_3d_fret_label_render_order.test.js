// Pins the renderOrder of per-note fret connector labels and drop/connector
// lines in plugins/highway_3d/screen.js.
//
// Problem: chord frame edges use a Z-proportional renderOrder
//   chordBaseRO = Math.max(48, Math.round(700 + z / K) - 2)   →  range [48, 698]
// Before this fix the fret connector labels used fixed values (15/16/22/23)
// that are always below 48, so chord frame borders always overdrawn the gold
// fret numbers below chord gems.
//
// Fix: all four elements now use _noteRO-based values (also Z-proportional):
//   _noteRO       = Math.max(50, Math.round(700 + noteZ / K))  →  range [50, 700]
//   chordBaseRO   = _noteRO - 2   (guaranteed by the formulas)
//
// New ordering (same note's Z):
//   chordBaseRO       frame edge   (e.g. 698 at z=0)
//   _noteRO - 1       connector line / drop line  (above frame, below gem)
//   _noteRO           non-arp fret label / gem outline  (above frame)
//   _noteRO + 1       arp fret label / gem core
//   _noteRO + 2       TECH_RO — technique markers (PM cross, bend arrow, …)
//
// Source-level regex checks — no Three.js or DOM required.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SCREEN_JS = path.join(__dirname, '..', '..', 'plugins', 'highway_3d', 'screen.js');

let _src;
function src() {
    if (!_src) _src = fs.readFileSync(SCREEN_JS, 'utf8');
    return _src;
}

// ---------------------------------------------------------------------------
// pConnectorLine — standalone notes only
// ---------------------------------------------------------------------------

test('connector line uses _noteRO-based renderOrder (non-arp: _noteRO-1, arp: _noteRO)', () => {
    // Standalone-note connector: a thin vertical line from the label below the
    // board up to the gem. Must be above chord frame border (chordBaseRO =
    // _noteRO - 2) so it is not clipped by the frame edge of any chord that
    // shares the same Z. Arpeggio gets +1 for intra-Z disambiguation.
    assert.match(
        src(),
        /line\.renderOrder\s*=\s*_isArpNote\s*\?\s*_noteRO\s*:\s*_noteRO\s*-\s*1\s*;/,
        'pConnectorLine renderOrder must be _isArpNote ? _noteRO : _noteRO - 1',
    );
});

// ---------------------------------------------------------------------------
// pNoteFretLabel — primary fret number label below board
// ---------------------------------------------------------------------------

test('fret label (primary) uses _noteRO-based renderOrder (non-arp: _noteRO, arp: _noteRO+1)', () => {
    // The gold fret number appearing below chord gems. Must be above the chord
    // frame border of the same note (chordBaseRO = _noteRO - 2) so it is never
    // overdrawn by the frame edge. Arpeggio gets +1 to stay above non-arp lines.
    assert.match(
        src(),
        /fretLabel\.renderOrder\s*=\s*_isArpNote\s*\?\s*_noteRO\s*\+\s*1\s*:\s*_noteRO\s*;/,
        'pNoteFretLabel renderOrder must be _isArpNote ? _noteRO + 1 : _noteRO',
    );
});

// ---------------------------------------------------------------------------
// fl2 — synthetic chord-note fret label (skipBody path)
// ---------------------------------------------------------------------------

test('synthetic chord fret label (fl2) uses same _noteRO-based formula as primary', () => {
    // fl2 renders the fret number for chord notes that went through the
    // skipBody=true path. Same contract as the primary fretLabel block.
    assert.match(
        src(),
        /fl2\.renderOrder\s*=\s*_isArp2\s*\?\s*_noteRO\s*\+\s*1\s*:\s*_noteRO\s*;/,
        'fl2 renderOrder must be _isArp2 ? _noteRO + 1 : _noteRO',
    );
});

// ---------------------------------------------------------------------------
// pDropLine — drop line for chord notes
// ---------------------------------------------------------------------------

test('drop line uses renderOrder _noteRO - 1, above frame (chordBaseRO) and below gem', () => {
    // Chord notes draw a drop line from the gem down to the fretboard.
    // _noteRO - 1 places it above the chord frame border (_noteRO - 2) but
    // below the gem outline (_noteRO) so the gem stays visually dominant.
    assert.match(
        src(),
        /dl\.renderOrder\s*=\s*_noteRO\s*-\s*1\s*;/,
        'pDropLine renderOrder must be _noteRO - 1',
    );
});

// ---------------------------------------------------------------------------
// Relative-ordering invariants (structural)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// lbl — chord-loop fret number labels ("Chord fret numbers at the base of the highway")
// ---------------------------------------------------------------------------

test('chord-loop fret label (lbl) uses chordBaseRO + 1, above the frame edge', () => {
    // The gold fret numbers rendered in the chord loop (one per unique fret in
    // the chord shape) were using a hardcoded renderOrder = 21, which is always
    // below chordBaseRO (min 48) — the frame edge overdrew the numbers.
    // Fix: use chordBaseRO + 1 so the label is always 1 above the frame edge
    // of its own chord, matching the relative ordering used by note labels.
    assert.match(
        src(),
        /lbl\.renderOrder\s*=\s*chordBaseRO\s*\+\s*1\s*;/,
        'chord-loop fret label (lbl) renderOrder must be chordBaseRO + 1',
    );
});

test('no fixed low renderOrder assignments remain for fret labels or connector/drop lines', () => {
    // Guard against regression: the old fixed values (15, 16, 21, 22, 23) must not
    // appear as renderOrder assignments for any of the affected elements.
    const s = src();

    // fretLabel / fl2 at old fixed values
    assert.doesNotMatch(
        s,
        /fretLabel\.renderOrder\s*=\s*(?:16|23)\s*;/,
        'fretLabel must not use the old fixed renderOrder 16 or 23',
    );
    assert.doesNotMatch(
        s,
        /fl2\.renderOrder\s*=\s*(?:16|23)\s*;/,
        'fl2 must not use the old fixed renderOrder 16 or 23',
    );

    // chord-loop label at old fixed value
    assert.doesNotMatch(
        s,
        /lbl\.renderOrder\s*=\s*21\s*;/,
        'chord-loop fret label (lbl) must not use the old fixed renderOrder 21',
    );

    // connector line at old fixed values
    assert.doesNotMatch(
        s,
        /line\.renderOrder\s*=\s*_isArpNote\s*\?\s*22\s*:\s*15\s*;/,
        'pConnectorLine must not use the old fixed renderOrder 22/15',
    );

    // drop line at old fixed value
    assert.doesNotMatch(
        s,
        /dl\.renderOrder\s*=\s*22\s*;/,
        'pDropLine must not use the old fixed renderOrder 22',
    );
});

test('fret label RO (_noteRO) is above chord frame RO (chordBaseRO = _noteRO - 2)', () => {
    // Numerical invariant: for any note at depth Z,
    //   chordBaseRO = max(48, round(700 + z/K) - 2)
    //   _noteRO     = max(50, round(700 + z/K))
    //   _noteRO - chordBaseRO >= 2   always
    // So fretLabel at _noteRO is always 2 above the chord frame edge.
    // Verify the formulas carry the right constants.
    const s = src();
    assert.match(
        s,
        /const\s+chordBaseRO\s*=\s*Math\.max\(\s*48\s*,\s*Math\.round\(\s*700\s*\+\s*z\s*\/\s*K\s*\)\s*-\s*2\s*\)/,
        'chordBaseRO formula must have floor 48 and -2 offset',
    );
    assert.match(
        s,
        /const\s+_noteRO\s*=\s*Math\.max\(\s*50\s*,\s*Math\.round\(\s*700\s*\+\s*noteZ\s*\/\s*K\s*\)\s*\)/,
        '_noteRO formula must have floor 50 (= chordBaseRO floor 48 + 2)',
    );
    // Structural: floor(_noteRO) - floor(chordBaseRO) = 50 - 48 = 2
    assert.strictEqual(50 - 48, 2, 'fret label floor (50) must be exactly 2 above frame floor (48)');
});
