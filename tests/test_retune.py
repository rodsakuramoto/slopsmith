"""Unit tests for the pure helpers in lib/retune.py.

The subprocess/RsCli-backed paths (_ensure_arrangement_xmls,
_recompile_sngs_from_xml, retune_to_standard) are filesystem/binary heavy and
exempt from unit coverage; these tests cover the side-effect-free helpers.
"""

from pathlib import Path

import pytest

import retune


@pytest.mark.parametrize(
    "name,expected",
    [
        ("song_lead.sng", True),
        ("song_rhythm.sng", True),
        ("song_bass.sng", True),
        ("song_combo.sng", True),
        ("song_vocals.sng", False),
        ("song_jvocals.sng", False),
        ("song_showlights.sng", False),
        ("SONG_VOCALS.sng", False),  # case-insensitive
        ("vocals.sng", False),  # unprefixed token
        ("showlights.sng", False),
        ("vocalsong_lead.sng", True),  # key contains "vocals" but is instrumental
        ("showlightsband_rhythm.sng", True),
    ],
)
def test_is_instrumental_sng(name, expected):
    assert retune._is_instrumental_sng(Path(name)) is expected


def test_sng_platform_detects_mac():
    paths = [Path("songs/bin/macos/song_lead.sng")]
    assert retune._sng_platform(paths) == "mac"


def test_sng_platform_defaults_to_pc():
    paths = [Path("songs/bin/generic/song_lead.sng")]
    assert retune._sng_platform(paths) == "pc"


def test_sng_platform_mac_wins_when_mixed():
    paths = [
        Path("songs/bin/generic/song_lead.sng"),
        Path("songs/bin/macos/song_lead.sng"),
    ]
    assert retune._sng_platform(paths) == "mac"


def test_rscli_candidates_dedupes_preserving_order(monkeypatch):
    # RSCLI_PATH and the module-level RSCLI resolve to the same path -> one entry.
    monkeypatch.setenv("RSCLI_PATH", str(retune.RSCLI))
    monkeypatch.delenv("RESOURCESPATH", raising=False)
    monkeypatch.delenv("PATH_BIN", raising=False)
    candidates = retune._rscli_candidates()
    as_str = [str(p) for p in candidates]
    assert len(as_str) == len(set(as_str)), "candidates must be de-duplicated"
    assert str(retune.RSCLI) in as_str


def test_rscli_candidates_honors_resourcespath_first(monkeypatch):
    monkeypatch.setenv("RESOURCESPATH", "/app/resources")
    monkeypatch.delenv("RSCLI_PATH", raising=False)
    candidates = retune._rscli_candidates()
    assert candidates[0] == Path("/app/resources") / "bin" / "rscli" / "RsCli"


def test_require_rscli_raises_when_none_exist(monkeypatch, tmp_path):
    # Point every discovery hook at non-existent paths.
    monkeypatch.setenv("RSCLI_PATH", str(tmp_path / "nope" / "RsCli"))
    monkeypatch.setenv("RESOURCESPATH", str(tmp_path / "res"))
    monkeypatch.setenv("PATH_BIN", str(tmp_path / "pb"))
    monkeypatch.setattr(retune, "RSCLI", tmp_path / "rscli" / "RsCli")
    with pytest.raises(RuntimeError, match="RsCli is required"):
        retune._require_rscli()


def test_require_rscli_returns_first_existing(monkeypatch, tmp_path):
    real = tmp_path / "rscli" / "RsCli"
    real.parent.mkdir(parents=True)
    real.write_text("#!/bin/sh\n")
    real.chmod(0o755)
    monkeypatch.setenv("RSCLI_PATH", str(real))
    monkeypatch.delenv("RESOURCESPATH", raising=False)
    monkeypatch.delenv("PATH_BIN", raising=False)
    assert retune._require_rscli() == real


def test_require_rscli_skips_directories_and_non_executables(monkeypatch, tmp_path):
    # A directory named like the binary must not be accepted...
    as_dir = tmp_path / "res" / "bin" / "rscli" / "RsCli"
    as_dir.mkdir(parents=True)
    monkeypatch.setenv("RESOURCESPATH", str(tmp_path / "res"))
    # ...nor a present-but-non-executable file.
    non_exec = tmp_path / "rscli" / "RsCli"
    non_exec.parent.mkdir(parents=True)
    non_exec.write_text("#!/bin/sh\n")
    non_exec.chmod(0o644)
    monkeypatch.setenv("RSCLI_PATH", str(non_exec))
    monkeypatch.setattr(retune, "RSCLI", tmp_path / "missing" / "RsCli")
    monkeypatch.delenv("PATH_BIN", raising=False)
    with pytest.raises(RuntimeError, match="RsCli is required"):
        retune._require_rscli()
