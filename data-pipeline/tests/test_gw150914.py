"""GW150914's file, built from Figure 1 files of GWOSC's shape (#830)."""

from __future__ import annotations

import math
from typing import TYPE_CHECKING

import numpy as np
import pytest

from histeclipse_pipeline.gw150914 import (
    COUNT,
    built,
    parse,
    quarter_cycle_on,
    resampled,
)

if TYPE_CHECKING:
    from collections.abc import Callable

STEP = 1 / 16384


def figure_file(
    strain: Callable[[float], float] | float, start: float = 0.25, count: int = 3441
) -> str:
    """A file as GWOSC writes it: a header, then time and strain (10⁻²¹) per line."""
    lines = ["# time (seconds)           strain * 1.e21"]
    for index in range(count):
        time = start + index * STEP
        value = strain(time) if callable(strain) else strain
        lines.append(f"{time:.18e} {value:.18e}")
    return "\n".join(lines) + "\n"


def chirp(time: float, delay: float = 0.0) -> float:
    """A rising tone peaking at 0.42 s, for the tests."""
    t = time - delay
    return math.exp(-(((t - 0.42) / 0.03) ** 2)) * math.cos(2 * math.pi * 120 * t)


def test_reads_a_figure_file() -> None:
    times, strains = parse(figure_file(chirp))
    assert len(times) == 3441
    assert times[0] == pytest.approx(0.25)
    assert strains[0] == pytest.approx(chirp(0.25))


@pytest.mark.parametrize(
    ("text", "refusal"),
    [
        ("# nothing\n1 2\n", "thousand rows"),
        (figure_file(1.0).replace(" 1.0", " 1.0 3", 1), "thousand rows"),
        (figure_file(float("nan")), "finite"),
        (figure_file(1.0).replace("2.500000", "9.500000", 1), "rising evenly"),
        (figure_file(1.0, start=0.1), "within"),
        (figure_file(9.0), "strains within"),
    ],
)
def test_refuses_what_gwosc_does_not_publish(text: str, refusal: str) -> None:
    with pytest.raises(ValueError, match=refusal):
        _ = parse(text)


def test_puts_a_series_on_the_grid_and_refuses_one_too_short() -> None:
    times, strains = parse(figure_file(chirp))
    on_grid = resampled(times, strains)
    assert len(on_grid) == COUNT
    assert on_grid[100] == pytest.approx(chirp(0.2505 + 100 / 2048), abs=1e-3)
    short = parse(figure_file(0.5, start=0.3, count=1500))
    with pytest.raises(ValueError, match="cover"):
        _ = resampled(*short)


def test_turns_a_tone_a_quarter_cycle_on() -> None:
    at = np.arange(512) / 512
    turned = quarter_cycle_on(np.cos(2 * np.pi * 8 * at))
    assert np.allclose(turned, np.sin(2 * np.pi * 8 * at), atol=1e-9)
    odd = quarter_cycle_on(np.cos(2 * np.pi * 4 * np.arange(511) / 511))
    assert np.max(np.abs(odd)) == pytest.approx(1.0, abs=0.05)


def late(time: float) -> float:
    """The chirp 7 ms later, as at Hanford."""
    return chirp(time, 0.007)


def late_inverted(time: float) -> float:
    """The chirp 7 ms later and upside down, as Hanford's arms lie to Livingston's."""
    return -chirp(time, 0.007)


def test_builds_both_detectors_and_the_waves_two_polarisations() -> None:
    texts = {
        ("H1", "observed"): figure_file(late),
        ("L1", "observed"): figure_file(chirp),
        ("H1", "waveform"): figure_file(late_inverted),
        ("L1", "waveform"): figure_file(chirp),
    }
    data = built(texts)
    assert data["event"] == "GW150914"
    assert data["rate"] == 2048
    detectors = data["detectors"]
    assert isinstance(detectors, dict)
    assert set(detectors) == {"H1", "L1"}  # pyright: ignore[reportUnknownArgumentType]
    plus, cross = data["plus"], data["cross"]
    assert isinstance(plus, list)
    assert isinstance(cross, list)
    assert len(plus) == len(cross) == COUNT  # pyright: ignore[reportUnknownArgumentType]
    assert data["merger"] == pytest.approx(0.42, abs=0.002)
