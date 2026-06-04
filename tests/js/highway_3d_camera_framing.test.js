// Pins the camera framing + lookahead behaviour in
// plugins/highway_3d/screen.js.
//
// Two independent pieces are covered:
//   1. Zoom-dependent framing — the cam.position height/depth multipliers are
//      interpolated by zoom distance between a NEAR (tight, nut-position) and a
//      FAR (wide, whole-neck) view via the CAM_FRAME_* constants, instead of
//      being fixed literals.
//   2. Measure-based lookahead — the camera lookahead window spans
//      CAM_LOOKAHEAD_MEASURES measures ahead (derived from the chart beats,
//      ignoring intra-measure measure === -1 beats) instead of a fixed number
//      of seconds.
//
// A refactor that re-hardcodes the framing multipliers, drops the measure
// cache, or reverts the lookahead window to seconds would silently regress the
// camera. Also guards that the temporary debug hook stayed removed.
//
// Source-level only — same strategy as the other tests/js/ files.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SCREEN_JS = path.join(__dirname, '..', '..', 'plugins', 'highway_3d', 'screen.js');
const src = fs.readFileSync(SCREEN_JS, 'utf8');

// ── Zoom-dependent framing ──────────────────────────────────────────────────

test('framing NEAR/FAR multiplier constants are defined', () => {
    for (const name of [
        'CAM_FRAME_DIST_NEAR', 'CAM_FRAME_DIST_FAR',
        'CAM_FRAME_H_NEAR', 'CAM_FRAME_H_FAR',
        'CAM_FRAME_D_NEAR', 'CAM_FRAME_D_FAR',
    ]) {
        assert.match(src, new RegExp('const\\s+' + name + '\\s*='),
            `${name} must be declared as a framing constant`);
    }
});

test('cam.position uses interpolated framing multipliers, not literals', () => {
    // The height/depth multipliers are computed (_hMul / _dMul), not inlined.
    assert.match(
        src,
        /cam\.position\.set\(\s*curX\s*\+\s*shoulderOffset\s*,\s*h\s*\*\s*_hMul\s*,\s*dist\s*\*\s*_dMul\s*\)/,
        'cam.position.set must use the interpolated _hMul / _dMul multipliers',
    );
});

test('framing multipliers are a clamped zoom-distance interpolation', () => {
    // _zt is clamped to [0,1] and lerps each multiplier between NEAR and FAR.
    assert.match(
        src,
        /Math\.max\(0,\s*Math\.min\(1,[\s\S]*?CAM_FRAME_DIST_NEAR[\s\S]*?CAM_FRAME_DIST_FAR/,
        '_zt must clamp (dist - NEAR)/(FAR - NEAR) into [0,1]',
    );
    assert.match(
        src,
        /CAM_FRAME_H_NEAR\s*\+\s*\(\s*CAM_FRAME_H_FAR\s*-\s*CAM_FRAME_H_NEAR\s*\)\s*\*\s*_zt/,
        'height multiplier must lerp NEAR->FAR by _zt',
    );
    assert.match(
        src,
        /CAM_FRAME_D_NEAR\s*\+\s*\(\s*CAM_FRAME_D_FAR\s*-\s*CAM_FRAME_D_NEAR\s*\)\s*\*\s*_zt/,
        'depth multiplier must lerp NEAR->FAR by _zt',
    );
});

// ── Measure-based lookahead window ──────────────────────────────────────────

test('lookahead window is expressed in measures with a seconds fallback', () => {
    assert.match(src, /const\s+CAM_LOOKAHEAD_MEASURES\s*=\s*9\b/,
        'CAM_LOOKAHEAD_MEASURES must default to 9');
    assert.match(src, /const\s+CAM_LOOKAHEAD_SEC\s*=\s*3\.0\b/,
        'CAM_LOOKAHEAD_SEC must stay as the no-beats fallback');
});

test('measure-start cache only keeps beats with measure >= 0', () => {
    // Intra-measure beats carry measure === -1 and must be skipped.
    assert.match(
        src,
        /Number\.isFinite\(\s*_b\.measure\s*\)\s*&&\s*_b\.measure\s*>=\s*0[\s\S]*?_measureStarts\s*=\s*_ms/,
        'only measure-start beats (measure >= 0) feed _measureStarts',
    );
});

test('lookaheadEndTime targets the measure CAM_LOOKAHEAD_MEASURES ahead', () => {
    assert.match(
        src,
        /function\s+lookaheadEndTime\s*\(\s*now\s*\)/,
        'lookaheadEndTime(now) helper must exist',
    );
    assert.match(
        src,
        /const\s+targetIdx\s*=\s*curIdx\s*\+\s*CAM_LOOKAHEAD_MEASURES/,
        'target measure index = current measure + CAM_LOOKAHEAD_MEASURES',
    );
    // No beats → seconds fallback.
    assert.match(
        src,
        /if\s*\(\s*!ms\s*\|\|\s*ms\.length\s*===\s*0\s*\)\s*return\s+now\s*\+\s*CAM_LOOKAHEAD_SEC/,
        'lookaheadEndTime must fall back to seconds when there are no measures',
    );
});

test('fret-bounds scan drives its window off lookaheadEndTime, not fixed seconds', () => {
    assert.match(
        src,
        /function\s+lookaheadComputeFretBounds[\s\S]*?const\s+tEnd\s*=\s*lookaheadEndTime\(\s*now\s*\)/,
        'lookaheadComputeFretBounds must derive tEnd from lookaheadEndTime(now)',
    );
});

test('measure-start cache is invalidated on song change', () => {
    // The song-change reset (reconnect path) resets _camSnapped; it must also
    // drop the measure-start cache, otherwise lookaheadEndTime sizes the window
    // off the previous song's measure grid and over-zooms the first-data snap.
    assert.match(
        src,
        /_camSnapped\s*=\s*false\s*;[\s\S]*?_measureStarts\s*=\s*\[\]\s*;\s*_measureStartsRef\s*=\s*null\s*;/,
        'song-change reset must clear _measureStarts / _measureStartsRef alongside _camSnapped',
    );
});

// ── Debug hook stayed removed ───────────────────────────────────────────────

test('temporary camera debug hook is not present', () => {
    assert.doesNotMatch(src, /h3dCamDebug/,
        'the window.h3dCamDebug tuning hook must not ship in the renderer');
});
