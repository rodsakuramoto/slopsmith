"""Tests for lib/gp2rs.py tempo/tick math helpers.

These functions are the pure arithmetic core of the Guitar Pro → Rocksmith
conversion pipeline. Fixture-free: all you need is hand-constructed
`TempoEvent` lists and integer tick / string inputs. The module-level
`import guitarpro` in gp2rs.py is harmless for import (no guitarpro
objects are constructed at module load).

See issue #46.
"""

from types import SimpleNamespace

import pytest

from gp2rs import (
    GP_TICKS_PER_QUARTER,
    TempoEvent,
    _compute_tuning,
    _extract_year,
    _gp_string_to_rs,
    _is_bass_track,
    _standard_tuning_for,
    _tempo_at_tick,
    _tick_to_seconds,
)


def _fake_track(string_midis, instrument=24):
    """Lightweight Track stand-in for the bass-detection / tuning helpers.

    `string_midis` is GP-order (high → low). The real Track is a heavy
    dataclass; the helpers only read `.strings[].number/.value` and
    `.channel.instrument`, so SimpleNamespace is enough.
    """
    strings = [SimpleNamespace(number=i + 1, value=v)
               for i, v in enumerate(string_midis)]
    channel = SimpleNamespace(instrument=instrument)
    return SimpleNamespace(strings=strings, channel=channel)


# ── _tick_to_seconds ─────────────────────────────────────────────────────────

def test_tick_to_seconds_at_zero():
    # Tick 0 is always time 0 regardless of tempo.
    tempo_map = [TempoEvent(tick=0, tempo=120.0)]
    assert _tick_to_seconds(0, tempo_map) == 0.0


def test_tick_to_seconds_constant_tempo():
    # At 120 BPM with 960 ticks/quarter, one quarter = 0.5s, so 1920 ticks = 1.0s.
    tempo_map = [TempoEvent(tick=0, tempo=120.0)]
    assert _tick_to_seconds(GP_TICKS_PER_QUARTER, tempo_map) == pytest.approx(0.5)
    assert _tick_to_seconds(2 * GP_TICKS_PER_QUARTER, tempo_map) == pytest.approx(1.0)
    assert _tick_to_seconds(4 * GP_TICKS_PER_QUARTER, tempo_map) == pytest.approx(2.0)


def test_tick_to_seconds_tempo_change_accumulates():
    # 4 quarter notes at 120 BPM = 2.0s, then 4 at 60 BPM = 4.0s. Total 6.0s.
    tempo_map = [
        TempoEvent(tick=0, tempo=120.0),
        TempoEvent(tick=4 * GP_TICKS_PER_QUARTER, tempo=60.0),
    ]
    # At the tempo-change boundary, time is 2.0 (4 beats at 120).
    assert _tick_to_seconds(4 * GP_TICKS_PER_QUARTER, tempo_map) == pytest.approx(2.0)
    # 4 more beats at 60 BPM = 4.0s. Total 6.0.
    assert _tick_to_seconds(8 * GP_TICKS_PER_QUARTER, tempo_map) == pytest.approx(6.0)


def test_tick_to_seconds_extrapolates_past_last_event():
    # Ticks past the last tempo event use that last event's tempo.
    tempo_map = [
        TempoEvent(tick=0, tempo=120.0),
        TempoEvent(tick=1000, tempo=240.0),
    ]
    # First 1000 ticks at 120 BPM = 1000/960 * 0.5 = 0.5208...s
    # Next 1000 ticks at 240 BPM = 1000/960 * 0.25 = 0.2604...s
    expected = (1000 / GP_TICKS_PER_QUARTER) * (60.0 / 120.0) + \
               (1000 / GP_TICKS_PER_QUARTER) * (60.0 / 240.0)
    assert _tick_to_seconds(2000, tempo_map) == pytest.approx(expected)


# ── _tempo_at_tick ───────────────────────────────────────────────────────────

def test_tempo_at_tick_before_first_event_returns_first_tempo():
    tempo_map = [TempoEvent(tick=100, tempo=120.0)]
    # Tick 0 is before the "first" event (which is at 100). Function starts
    # result at tempo_map[0].tempo and only updates when event.tick <= tick.
    assert _tempo_at_tick(0, tempo_map) == 120.0


def test_tempo_at_tick_at_exact_event():
    tempo_map = [
        TempoEvent(tick=0, tempo=120.0),
        TempoEvent(tick=500, tempo=200.0),
    ]
    assert _tempo_at_tick(500, tempo_map) == 200.0


def test_tempo_at_tick_between_events():
    tempo_map = [
        TempoEvent(tick=0, tempo=120.0),
        TempoEvent(tick=1000, tempo=200.0),
    ]
    assert _tempo_at_tick(500, tempo_map) == 120.0


def test_tempo_at_tick_past_last_event():
    tempo_map = [
        TempoEvent(tick=0, tempo=120.0),
        TempoEvent(tick=100, tempo=60.0),
        TempoEvent(tick=500, tempo=180.0),
    ]
    assert _tempo_at_tick(999999, tempo_map) == 180.0


def test_tempo_at_tick_single_event_map():
    tempo_map = [TempoEvent(tick=0, tempo=90.0)]
    assert _tempo_at_tick(0, tempo_map) == 90.0
    assert _tempo_at_tick(100000, tempo_map) == 90.0


# ── _gp_string_to_rs ─────────────────────────────────────────────────────────
# GP string numbering: 1 = highest pitch, N = lowest
# RS string numbering: 0 = lowest pitch (low E on a guitar)
# Transform: rs_index = num_strings - gp_string

@pytest.mark.parametrize("gp_string,num_strings,rs_index", [
    # 6-string guitar: GP 1 (high e) -> RS 5, GP 6 (low E) -> RS 0
    (1, 6, 5),
    (2, 6, 4),
    (3, 6, 3),
    (4, 6, 2),
    (5, 6, 1),
    (6, 6, 0),
    # 4-string bass: GP 1 (G) -> RS 3, GP 4 (E) -> RS 0
    (1, 4, 3),
    (2, 4, 2),
    (3, 4, 1),
    (4, 4, 0),
    # 7-string guitar: GP 1 (high e) -> RS 6, GP 7 (low B) -> RS 0
    (1, 7, 6),
    (7, 7, 0),
])
def test_gp_string_to_rs(gp_string, num_strings, rs_index):
    assert _gp_string_to_rs(gp_string, num_strings) == rs_index


# ── _extract_year ────────────────────────────────────────────────────────────

@pytest.mark.parametrize("copyright_text, expected", [
    ("1998 Goat Head Music, WB Music Corp, USA", "1998"),
    ("Copyright 2024 Some Label", "2024"),
    ("Released in 1972 by ABC Records", "1972"),
    ("No year present anywhere", ""),
    ("", ""),
    (None, ""),
    # 4-digit numbers outside the [1800-2099] window aren't years.
    ("Catalog 4521", ""),
])
def test_extract_year(copyright_text, expected):
    song = SimpleNamespace(copyright=copyright_text, subtitle=None)
    assert _extract_year(song) == expected


def test_extract_year_falls_back_to_subtitle():
    song = SimpleNamespace(copyright=None, subtitle="From the 2010 album")
    assert _extract_year(song) == "2010"


# ── _is_bass_track ───────────────────────────────────────────────────────────

@pytest.mark.parametrize("instrument, expected", [
    # GM Bass family is 32-39 inclusive. Lock the boundaries so an
    # off-by-one in the program check (e.g. `32 < instrument < 39`
    # vs `32 <= instrument <= 39`) doesn't silently regress.
    (32, True),   # Acoustic Bass — lower edge of bass family
    (33, True),   # Electric Bass (finger)
    (39, True),   # Synth Bass 2 — upper edge of bass family
    (31, False),  # Guitar Harmonics — just below bass family
    (40, False),  # Violin — just above bass family
])
def test_is_bass_track_gm_program_boundaries(instrument, expected):
    # Top string is high (MIDI 64 = E4) so non-bass programs can't
    # accidentally pass through the pitch fallback.
    track = _fake_track([64, 59, 55, 50], instrument=instrument)
    assert _is_bass_track(track) is expected


def test_is_bass_track_pitch_fallback_for_4_string_bass():
    # Standard 4-string bass G2 D2 A1 E1 with the program mis-set to
    # piano (0) — common GP file authoring artefact.
    track = _fake_track([43, 38, 33, 28], instrument=0)
    assert _is_bass_track(track) is True


def test_is_bass_track_detects_5_string_bass():
    # 5-string bass with B0 added below E1, program mis-set to acoustic guitar.
    track = _fake_track([43, 38, 33, 28, 23], instrument=24)
    assert _is_bass_track(track) is True


def test_is_bass_track_rejects_standard_guitar():
    # E4 B3 G3 D3 A2 E2 — top string > MIDI 48, no bass program.
    track = _fake_track([64, 59, 55, 50, 45, 40], instrument=24)
    assert _is_bass_track(track) is False


def test_is_bass_track_rejects_7_string_detuned_guitar():
    # 7-string drop A: top still high (D4=62), low extends to A1 (33).
    track = _fake_track([62, 57, 53, 48, 43, 38, 33], instrument=29)
    assert _is_bass_track(track) is False


def test_is_bass_track_handles_empty_strings():
    track = _fake_track([], instrument=24)
    assert _is_bass_track(track) is False


# ── _standard_tuning_for ────────────────────────────────────────────────────

@pytest.mark.parametrize("num, is_bass, expected", [
    (6, False, [64, 59, 55, 50, 45, 40]),
    (7, False, [64, 59, 55, 50, 45, 40, 35]),
    (8, False, [64, 59, 55, 50, 45, 40, 35, 30]),
    (4, True,  [43, 38, 33, 28]),
    (5, True,  [43, 38, 33, 28, 23]),
    (6, True,  [48, 43, 38, 33, 28, 23]),
])
def test_standard_tuning_for(num, is_bass, expected):
    assert _standard_tuning_for(num, is_bass) == expected


def test_standard_tuning_for_pads_beyond_8_string_guitar():
    # Pathological 9-string falls back to descending fourths.
    out = _standard_tuning_for(9, is_bass=False)
    assert len(out) == 9
    assert out[:8] == [64, 59, 55, 50, 45, 40, 35, 30]
    # Next entry extends down by a fourth (5 semitones).
    assert out[8] == 30 - 5


# ── _compute_tuning ─────────────────────────────────────────────────────────

def test_compute_tuning_standard_6_string_guitar_returns_zeros():
    track = _fake_track([64, 59, 55, 50, 45, 40], instrument=24)
    assert _compute_tuning(track) == [0, 0, 0, 0, 0, 0]


def test_compute_tuning_eb_standard_guitar_returns_minus_one_per_string():
    track = _fake_track([63, 58, 54, 49, 44, 39], instrument=24)
    assert _compute_tuning(track) == [-1, -1, -1, -1, -1, -1]


def test_compute_tuning_7_string_preserves_length():
    track = _fake_track([64, 59, 55, 50, 45, 40, 35], instrument=24)
    assert _compute_tuning(track) == [0, 0, 0, 0, 0, 0, 0]


def test_compute_tuning_5_string_low_b_bass_returns_zeros():
    # Low-B 5-string standard: G2 D2 A1 E1 B0 (MIDI 43 38 33 28 23).
    track = _fake_track([43, 38, 33, 28, 23], instrument=33)
    assert _compute_tuning(track) == [0, 0, 0, 0, 0]


def test_compute_tuning_5_string_high_c_bass_returns_zeros():
    # High-C 5-string standard: C3 G2 D2 A1 E1 (MIDI 48 43 38 33 28).
    # Previously this miscomputed as +5 on every string because the
    # function always picked the low-B reference.
    track = _fake_track([48, 43, 38, 33, 28], instrument=33)
    assert _compute_tuning(track) == [0, 0, 0, 0, 0]


def test_standard_tuning_for_5_string_bass_picks_high_c_when_top_is_c():
    # Explicit hint: top string at MIDI 48 → high-C variant.
    assert _standard_tuning_for(5, is_bass=True, top_midi=48) == [48, 43, 38, 33, 28]


def test_standard_tuning_for_5_string_bass_defaults_to_low_b():
    # Without a hint, fall back to the more common low-B layout.
    assert _standard_tuning_for(5, is_bass=True) == [43, 38, 33, 28, 23]


def test_compute_tuning_6_string_bass_routes_to_bass_table():
    track = _fake_track([48, 43, 38, 33, 28, 23], instrument=33)
    assert _compute_tuning(track) == [0, 0, 0, 0, 0, 0]


def test_compute_tuning_drop_d_guitar():
    # Drop D: low E2 (40) → D2 (38), other strings unchanged. RS tuning
    # is stored low→high, so index 0 is the lowest string.
    track = _fake_track([64, 59, 55, 50, 45, 38], instrument=24)
    assert _compute_tuning(track) == [-2, 0, 0, 0, 0, 0]
