// Pins the renderOrder (RO) hierarchy in plugins/highway_3d/screen.js.
//
// Three.js renders transparent objects by renderOrder first, then back-to-front
// Z sort within the same RO. All 3D-highway materials use depthTest:false, so
// renderOrder is the *only* draw-order control — getting it wrong silently
// causes one layer to bleed through another (gems clipping through chord frames,
// strings buried under notes, etc.).
//
// Full hierarchy bottom → top:
//
//   -1   background stage traversal
//    1   lane quads
//    2   fret dividers
//    4   sus-rail bloom (pSusRailBloom seed)           ← highway_3d_sustain_bloom.test.js
//    5   sus-rail core (pSusRail seed)                 ← highway_3d_sustain_rail.test.js
//    7   string-line glows (in-lane glow lines)
//   14   board-projection frame
//   [max(49, round(700+z/K)-1)]  fret-column markers (pFretColMarker) — between chord frame and gem
//   [chordBaseRO-4]  chord fill interior (Z-proportional)
//   [chordBaseRO-3.5] PM/FH X fill (Z-proportional)
//   [chordBaseRO-3]  PM/FH X lines (Z-proportional)
//   [chordBaseRO]    chord frame edges = max(48, round(700+z/K)-2)  → [48,698]
//   [chordBaseRO+ε]  chord frame sub-layers (intra-chord 0.0003 step)
//   [≤697.999]       sus-trail strip segments (Z-proportional, always < frame)
//   [_noteRO]        note gem outline = max(50, round(700+noteZ/K)) → [50,700]
//   [_noteRO+1]      note gem core
//   [TECH_RO]        technique markers = _noteRO+2                  → [52,702]
//   703              string mesh (drawn over gems but under fret wires)
//   704              static fret wires (buildBoard T.Line — above strings, as on a real guitar)
//   1000             technique labels, ghost-fret overlay
//
// Tests are source-level regex checks — no need to load Three.js or a DOM.
//
// Any PR that changes a renderOrder value must update the relevant test(s) here
// and provide a visual justification in the PR description.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SCREEN_JS = path.join(__dirname, '..', '..', 'plugins', 'highway_3d', 'screen.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _src;
function src() {
    if (!_src) _src = fs.readFileSync(SCREEN_JS, 'utf8');
    return _src;
}

// ---------------------------------------------------------------------------
// Static / fixed renderOrder values
// ---------------------------------------------------------------------------

test('lane quads use renderOrder 1', () => {
    assert.match(
        src(),
        /lane\.renderOrder\s*=\s*1\s*;/,
        'lane quads must use renderOrder = 1 (bottom-most visible layer)',
    );
});

test('fret dividers use renderOrder 2', () => {
    assert.match(
        src(),
        /div\.renderOrder\s*=\s*2\s*;/,
        'fret dividers must use renderOrder = 2, above lane (1)',
    );
});

test('string-line glows use renderOrder 7, above sus-rails (4/5)', () => {
    // The in-lane string glow lines sit at 7 — above sus-rail bloom (4) and
    // core (5) so the glow is visible, but below chord fill (chordBaseRO-4,
    // min=44) so chord interiors don't disappear behind glow overdraw.
    assert.match(
        src(),
        /line\.renderOrder\s*=\s*7\s*;/,
        'string glow lines must use renderOrder = 7',
    );
});

test('board-projection frame mesh uses renderOrder 14', () => {
    // The fretboard projection plane sits above string glows (7) but below
    // chord fill (min 44). Value 14 keeps it sandwiched cleanly.
    // Anchor to the board-projection pool (projMeshArr = activePalette.map(...))
    // so the assertion only passes when THAT block seeds renderOrder = 14 —
    // not any unrelated renderOrder = 14 elsewhere in the source.
    const boardProjRO = /projMeshArr\s*=\s*activePalette\.map\b[\s\S]{0,1200}?m\.renderOrder\s*=\s*14\s*;/;
    assert.match(
        src(),
        boardProjRO,
        'board-projection pool (projMeshArr) must seed meshes with renderOrder = 14',
    );
    const boardMatch = src().match(boardProjRO);
    assert.ok(boardMatch, 'board projection mesh must be assigned renderOrder = 14');
});

test('string mesh in buildBoard uses renderOrder 703, above gem range [50,700]', () => {
    // The physical string cylinders/planes rendered on the fretboard sit at
    // 703 — above the note-gem ceiling (700) but below fret wires (704).
    // This ensures strings are never occluded by flying gems.
    assert.match(
        src(),
        /mesh\.renderOrder\s*=\s*703\s*;/,
        'buildBoard string mesh must use renderOrder = 703',
    );
});

test('static fret wires use BoxGeometry matching STR_THICK, renderOrder 704, depthTest: false, default gray 0x666688', () => {
    // Fret wires are BoxGeometry bars with the same STR_THICK × STR_THICK
    // cross-section as the string meshes — WebGL ignores linewidth > 1px so
    // T.Line always renders as a hairline regardless of the value set.
    // depthTest: false is required: the string BoxGeometry (MeshStandardMaterial,
    // depthWrite:true default) writes depth at Z = +STR_THICK/2, so fret wires
    // at Z=0 would fail the depth test at string pixels despite the higher RO.
    const s = src();
    assert.match(
        s,
        /new\s+T\.BoxGeometry\(\s*STR_THICK\s*,\s*wireH\s*,\s*STR_THICK\s*\)/,
        'buildBoard fret wires must use BoxGeometry(STR_THICK, wireH, STR_THICK) to match string thickness',
    );
    assert.match(
        s,
        /new\s+T\.Mesh\(\s*g\s*,\s*mat\s*\)/,
        'buildBoard fret wires must use T.Mesh (not T.Line)',
    );
    assert.match(
        s,
        /fw\.renderOrder\s*=\s*704\s*;/,
        'buildBoard fret wire mesh must use renderOrder = 704',
    );
    assert.match(
        s,
        /color\s*:\s*0x666688[\s\S]{0,200}?depthTest\s*:\s*false|depthTest\s*:\s*false[\s\S]{0,200}?color\s*:\s*0x666688/,
        'fret wire MeshBasicMaterial must have default color 0x666688 and depthTest: false',
    );
    assert.match(
        s,
        /fretWireMats\s*\[\s*f\s*\]\s*=\s*mat\s*;/,
        'buildBoard must store each wire material in fretWireMats[f]',
    );
});

test('update() sets fret wire gold (0xD8A636) for in-anchor frets, gray (0x666688) otherwise', () => {
    // Uses anchorLaneBoundsAt() — the same helper the dynamic lane uses —
    // so fret wire highlight aligns exactly with the lane edges:
    //   dMin = fret - 1,  dMax = fret + width - 1
    // Example: { fret: 3, width: 4 } → dMin=2, dMax=6 → wires 2..6 gold.
    const s = src();
    assert.match(
        s,
        /fretWireMats\.length/,
        'update() must guard the per-frame fret wire loop on fretWireMats.length',
    );
    assert.match(
        s,
        /anchorLaneBoundsAt\(\s*anchors\s*,\s*now\s*\)/,
        'update() must use anchorLaneBoundsAt(anchors, now) to get fret wire range',
    );
    assert.match(
        s,
        /_m\.color\.setHex\(\s*0xD8A636\s*\)/,
        'update() must set gold 0xD8A636 for in-anchor fret wires',
    );
    assert.match(
        s,
        /_m\.color\.setHex\(\s*0x666688\s*\)/,
        'update() must set gray 0x666688 for out-of-anchor fret wires',
    );
    assert.match(
        s,
        /_fwBounds\.dMin/,
        'update() must use dMin from anchorLaneBoundsAt (= fret - 1)',
    );
    assert.match(
        s,
        /_fwBounds\.dMax/,
        'update() must use dMax from anchorLaneBoundsAt (= fret + width - 1)',
    );
});

test('fret-column markers use Z-proportional renderOrder between chord frame and gem', () => {
    // pFretColMarker labels use max(49, round(700+z/K)-1) — one step above the
    // chord frame border (chordBaseRO = max(48, round(700+z/K)-2)) and one step
    // below the note gem (_noteRO = max(50, round(700+z/K))) at the same depth.
    // This ensures chord frame borders never overdraw the label and the label
    // never overdraws gems, at every Z position across the lookahead window.
    assert.match(
        src(),
        /sp\.renderOrder\s*=\s*Math\.max\(\s*49\s*,\s*Math\.round\(\s*700\s*\+\s*z\s*\/\s*K\s*\)\s*-\s*1\s*\)\s*;/,
        'pFretColMarker renderOrder must be Math.max(49, Math.round(700 + z / K) - 1)',
    );
});

test('technique labels and ghost-fret overlay use renderOrder 1000', () => {
    // 1000 is well above the entire Z-proportional range [48-702] and the
    // string/cadence layer (703/704) — labels must always be readable.
    const matches = src().match(/m\.renderOrder\s*=\s*1000\s*;/g) || [];
    assert.ok(
        matches.length >= 2,
        'at least two renderOrder = 1000 assignments must exist (technique labels + ghost fret)',
    );
});

// ---------------------------------------------------------------------------
// Z-proportional formulas — chord frame / note gem / technique marker
// ---------------------------------------------------------------------------

test('chordBaseRO formula: max(48, round(700 + z/K) - 2)', () => {
    // Per-chord frame renderOrder mirrors the note-gem scale but offset by -2
    // so frame edges always render just below their own chord's gems while
    // still drawing above gems from further-away chords.
    // Floor 48 ensures frames always beat lane (1) and dividers (2).
    // Ceiling: at z=0 → round(700)-2 = 698, which is 2 below gem ceiling (700).
    assert.match(
        src(),
        /const\s+chordBaseRO\s*=\s*Math\.max\(\s*48\s*,\s*Math\.round\(\s*700\s*\+\s*z\s*\/\s*K\s*\)\s*-\s*2\s*\)/,
        'chordBaseRO must be Math.max(48, Math.round(700 + z / K) - 2)',
    );
});

test('_noteRO formula: max(50, round(700 + noteZ/K))', () => {
    // Per-note gem renderOrder. noteZ is negative (ahead of hit line → negative
    // Z in world space). At noteZ=0 (on the hit line) → 700; far notes → 50.
    // Floor 50 keeps gems above chord frame floor (48) everywhere.
    assert.match(
        src(),
        /const\s+_noteRO\s*=\s*Math\.max\(\s*50\s*,\s*Math\.round\(\s*700\s*\+\s*noteZ\s*\/\s*K\s*\)\s*\)/,
        '_noteRO must be Math.max(50, Math.round(700 + noteZ / K))',
    );
});

test('TECH_RO is _noteRO + 2, placing technique markers above gem core (_noteRO+1)', () => {
    // Technique markers (PM cross, bend arrow, H/P chevron, etc.) must overlay
    // the gem itself.  _noteRO+1 is the gem core; TECH_RO = _noteRO+2 clears it.
    assert.match(
        src(),
        /const\s+TECH_RO\s*=\s*_noteRO\s*\+\s*2/,
        'TECH_RO must equal _noteRO + 2',
    );
});

// ---------------------------------------------------------------------------
// Intra-chord layering (chord fill < PM/FH fill < PM/FH lines < frame edge)
// ---------------------------------------------------------------------------

test('chord fill interior uses chordBaseRO - 4', () => {
    // The translucent chord-box fill sits 4 below the frame edge so the edge
    // always wins when both cover the same pixel.
    assert.match(
        src(),
        /fill\.renderOrder\s*=\s*chordBaseRO\s*-\s*4\s*;/,
        'chord fill must use renderOrder = chordBaseRO - 4',
    );
});

test('PM/FH X fill (pPMXFill / pFHXFill) uses chordBaseRO - 3.5', () => {
    // The black background fill of the muted-note X symbol is above chord fill
    // (-4) but below the X lines (-3) — same chord, so same chordBaseRO base.
    const matches = src().match(/xf\.renderOrder\s*=\s*chordBaseRO\s*-\s*3\.5\s*;/g) || [];
    assert.ok(
        matches.length >= 2,
        'both PM and FH X-fill meshes must set renderOrder = chordBaseRO - 3.5 (found ' + matches.length + ')',
    );
});

test('PM/FH X lines (pMuteXLines / pFHXLines) use chordBaseRO - 3', () => {
    // The coloured X stroke lines are above the black fill (-3.5) but below
    // the chord frame border edge (chordBaseRO), so they don't escape the box.
    const matches = src().match(/xl\.renderOrder\s*=\s*chordBaseRO\s*-\s*3\s*;/g) || [];
    assert.ok(
        matches.length >= 2,
        'both PM and FH X-line meshes must set renderOrder = chordBaseRO - 3 (found ' + matches.length + ')',
    );
});

test('chord frame edge sub-layers use chordBaseRO + 0.0003', () => {
    // Individual box edges (top/bottom/left/right) get a tiny epsilon above
    // chordBaseRO so intra-chord edge overdraw is deterministic.
    assert.match(
        src(),
        /b\.renderOrder\s*=\s*chordBaseRO\s*\+\s*0\.0003\s*;/,
        'chord frame edge slabs must use renderOrder = chordBaseRO + 0.0003',
    );
});

// ---------------------------------------------------------------------------
// Sustain-trail strip & ribbon — always below chord frame of same depth
// ---------------------------------------------------------------------------

test('sus-trail strip RO formula keeps trails strictly below chord frames at same Z', () => {
    // The -0.001 ensures trails (≤ 697.999) never reach a chord frame at the
    // same Z (chordBaseRO uses integer Math.round → 698 at z=0).
    // Math.min(0, zCenter) clamps past-hit segments so they stay ≤ 697.999.
    assert.match(
        src(),
        /const\s+_ro\s*=\s*Math\.max\(\s*47\.999\s*,\s*Math\.round\(\s*700\s*\+\s*Math\.min\(\s*0\s*,\s*zCenter\s*\)\s*\/\s*K\s*\)\s*-\s*2\s*\)\s*-\s*0\.001\s*;/,
        'sus-trail strip _ro must be Math.max(47.999, Math.round(700 + Math.min(0, zCenter) / K) - 2) - 0.001',
    );
});

test('sus-trail ribbon RO formula mirrors strip formula using time-based depth', () => {
    // Ribbons use _ribDt (time from now to ribbon midpoint) converted to the
    // same Z scale (×200 = TS/K) — matching how noteZ is computed — minus 2
    // and -0.001 so ribbons stay below chord frames at the same depth.
    assert.match(
        src(),
        /const\s+_ribRO\s*=\s*Math\.max\(\s*47\.999\s*,\s*Math\.round\(\s*700\s*-\s*_ribDt\s*\*\s*200\s*\)\s*-\s*2\s*\)\s*-\s*0\.001\s*;/,
        'sus-trail ribbon _ribRO must be Math.max(47.999, Math.round(700 - _ribDt * 200) - 2) - 0.001',
    );
});

// ---------------------------------------------------------------------------
// Note gem ordering (outline < core, both driven by _noteRO)
// ---------------------------------------------------------------------------

test('note gem outline uses renderOrder = _noteRO', () => {
    assert.match(
        src(),
        /outline\.renderOrder\s*=\s*_noteRO\s*;/,
        'note gem outline must use renderOrder = _noteRO',
    );
});

test('note gem core uses renderOrder = _noteRO + 1, above outline', () => {
    assert.match(
        src(),
        /core\.renderOrder\s*=\s*_noteRO\s*\+\s*1\s*;/,
        'note gem core must use renderOrder = _noteRO + 1',
    );
});

// ---------------------------------------------------------------------------
// Key relative-ordering invariants (derived constants)
// ---------------------------------------------------------------------------

test('chordBaseRO floor (48) is below _noteRO floor (50)', () => {
    // Chord frames must always render below note gems, even at maximum depth
    // (far end of the lookahead). Floor 48 < floor 50 guarantees this.
    //
    // Verified structurally: Math.max(48, ...) vs Math.max(50, ...) — the
    // regex below just confirms both floors are present and in the right order
    // by checking chordBaseRO (48) precedes _noteRO (50) in the source.
    const s = src();
    const cbIdx = s.search(/const\s+chordBaseRO\s*=\s*Math\.max\(\s*48/);
    const nrIdx = s.search(/const\s+_noteRO\s*=\s*Math\.max\(\s*50/);
    assert.ok(cbIdx !== -1, 'chordBaseRO formula with floor 48 must exist');
    assert.ok(nrIdx !== -1, '_noteRO formula with floor 50 must exist');
    // chordBaseRO is declared inside the chord loop (update()); _noteRO inside
    // drawNote() — chord loop always comes first in the file.
    assert.ok(cbIdx < nrIdx, 'chordBaseRO (floor 48) must be declared before _noteRO (floor 50) in source');
});

test('string mesh RO (703) is above gem ceiling (700) and below TECH_RO / labels (1000)', () => {
    // 703 > 700: strings are never occluded by the tallest possible gem.
    // 703 < 1000: technique labels and ghost-fret overlays still appear above strings.
    const s = src();
    assert.match(s, /mesh\.renderOrder\s*=\s*703\s*;/, 'string mesh must be 703');
    // Confirm 1000 also exists (labels above strings)
    assert.match(s, /m\.renderOrder\s*=\s*1000\s*;/, 'technique label RO 1000 must exist');
    // Numerical check: 703 < 1000 — trivially true but documents intent
    assert.ok(703 < 1000, 'string mesh RO must be below technique label RO');
});

test('fret-column marker RO is above chord frame floor (48) and below gem floor (50)', () => {
    // Structural invariant for the Z-proportional formula max(49, round(700+z/K)-1):
    // floor = 49, which is > chordBaseRO floor (48) and < _noteRO floor (50).
    assert.ok(49 > 48, 'fret-column marker floor (49) must be above chord frame floor (48)');
    assert.ok(49 < 50, 'fret-column marker floor (49) must be below gem floor (50)');
    assert.match(
        src(),
        /Math\.max\(\s*49\s*,\s*Math\.round\(\s*700\s*\+\s*z\s*\/\s*K\s*\)\s*-\s*1\s*\)/,
        'pFretColMarker formula must use floor 49 and offset -1',
    );
});

test('static fret wire RO (704) is above string mesh (703) and gem ceiling (700)', () => {
    // Structural invariant: fret wires must always draw after (on top of) strings.
    assert.ok(704 > 703, 'fret wire (704) must be above string mesh (703)');
    assert.ok(704 > 700, 'fret wire (704) must be above gem ceiling (700)');
    assert.ok(704 < 1000, 'fret wire (704) must be below technique labels (1000)');
    assert.match(src(), /fw\.renderOrder\s*=\s*704\s*;/, 'buildBoard fret wire must be 704');
    assert.match(src(), /mesh\.renderOrder\s*=\s*703\s*;/, 'string mesh must be 703');
});
