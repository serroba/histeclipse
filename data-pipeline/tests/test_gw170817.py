"""GW170817's time-frequency maps, built from strain of GWOSC's shape (#1000)."""

from __future__ import annotations

import base64
import math

import numpy as np
import numpy.typing as npt
import pytest

from histeclipse_pipeline.gw170817 import (
    COLUMNS,
    FREQUENCIES,
    FROM,
    GPS_START,
    MERGER,
    RATE,
    SECONDS,
    TO,
    built,
    checked,
    energy_map,
    gated,
    glitch_at,
    kept,
    whitened,
)

TIMES = np.arange(SECONDS * RATE) / RATE


def noise(seed: int) -> npt.NDArray[np.float64]:
    """White noise of a strain's size."""
    return np.random.default_rng(seed).normal(0, 1e-21, SECONDS * RATE)


def chirp(strength: float) -> npt.NDArray[np.float64]:
    """A tone rising from 40 to 300 Hz over the 6 s before the merger, then nothing."""
    before = MERGER - TIMES
    on = (before > 0) & (before < 6)
    frequency = 40 + (300 - 40) * (1 - before / 6)
    phase = 2 * np.pi * np.cumsum(np.where(on, frequency, 0)) / RATE
    return np.where(on, strength * np.sin(phase), 0.0)


def test_refuses_what_gwosc_does_not_publish() -> None:
    good = noise(1)
    assert checked(good, GPS_START) is good
    with pytest.raises(ValueError, match="GPS"):
        _ = checked(good, GPS_START + 1)
    with pytest.raises(ValueError, match="samples"):
        _ = checked(good[:-1], GPS_START)
    bad = good.copy()
    bad[3] = np.nan
    with pytest.raises(ValueError, match="finite"):
        _ = checked(bad, GPS_START)
    bad[3] = 1e-10
    with pytest.raises(ValueError, match="within"):
        _ = checked(bad, GPS_START)


def test_finds_the_glitch_and_zeroes_round_it() -> None:
    strain = noise(2)
    at = MERGER - 1.05
    strain[round(at * RATE)] = 1e-17
    assert glitch_at(strain) == pytest.approx(at, abs=1 / RATE)
    quiet = gated(strain, at)
    assert np.max(np.abs(quiet[round((at - 0.04) * RATE) : round((at + 0.04) * RATE)])) == 0
    # Untouched away from it, but for the mean taken off.
    far = round((at - 1) * RATE)
    level = float(np.sum(strain)) / strain.size
    assert quiet[far] == pytest.approx(strain[far] - level)  # pyright: ignore[reportAny]


def test_whitens_noise_to_a_flat_level() -> None:
    white = whitened(noise(3) * 5)
    middle = white[4 * RATE : -4 * RATE]
    assert np.isfinite(middle).all()
    halves = np.std(middle[: len(middle) // 2]), np.std(middle[len(middle) // 2 :])
    assert halves[0] == pytest.approx(halves[1], rel=0.1)


def test_maps_noise_to_its_median_and_a_chirp_to_a_rising_track() -> None:
    energy = energy_map(whitened(noise(4) + chirp(6e-22)))
    times = TIMES - MERGER
    quiet = (times > -14) & (times < -4)
    ordered = np.sort(energy[:, quiet], axis=None)
    assert ordered[ordered.size // 2] == pytest.approx(math.log(2), rel=0.05)
    # The brightest frequency rises as the merger nears.
    early = int(np.argmax(energy[:, round((MERGER - 5) * RATE)]))
    late = int(np.argmax(energy[:, round((MERGER - 0.5) * RATE)]))
    assert FREQUENCIES[late] > 2 * FREQUENCIES[early]
    assert energy[late, round((MERGER - 0.5) * RATE)] > 12


def test_keeps_its_window_as_bytes() -> None:
    energy = np.full((len(FREQUENCIES), SECONDS * RATE), 6.5)
    tiles = kept(energy)
    assert tiles.shape == (len(FREQUENCIES), round((TO - FROM) * COLUMNS))
    assert tiles.dtype == np.uint8
    assert tiles[0, 0] == 128


def test_builds_the_file_the_site_reads() -> None:
    strains = {"H1": noise(5) + chirp(6e-22), "L1": noise(6), "V1": noise(7)}
    strains["L1"][round((MERGER - 1.1) * RATE)] = 1e-17
    data = built(strains)
    assert data["event"] == "GW170817"
    assert data["columns"] == round((TO - FROM) * COLUMNS)
    gate = data["gated"]
    assert isinstance(gate, dict)
    assert gate["from"] == pytest.approx(-1.1 - 0.15, abs=0.01)
    maps = data["detectors"]
    assert isinstance(maps, dict)

    def tiles(detector: str) -> npt.NDArray[np.uint8]:
        text = maps[detector]  # pyright: ignore[reportUnknownVariableType]
        assert isinstance(text, str)
        return np.frombuffer(base64.b64decode(text), dtype=np.uint8)

    for detector in ("H1", "L1", "V1"):
        assert tiles(detector).size == len(FREQUENCIES) * round((TO - FROM) * COLUMNS)
    # Hanford's chirp is bright; Virgo's noise mostly dark.
    assert tiles("H1").max() == 255
    virgo = tiles("V1")
    assert np.count_nonzero(virgo == 0) > len(virgo) / 2  # pyright: ignore[reportAny]
