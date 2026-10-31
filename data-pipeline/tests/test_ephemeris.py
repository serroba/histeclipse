from typing import TYPE_CHECKING

import numpy as np
import pytest

from histeclipse_pipeline.ephemeris import (
    DE441_SPLIT_JD,
    TARGETS,
    Ephemeris,
    excerpt,
)
from kernels import AFTER_SPLIT, ANCIENT, BEFORE_SPLIT, MODERN

if TYPE_CHECKING:
    from pathlib import Path


def test_joins_segments_across_the_split(across_split: Ephemeris) -> None:
    assert across_split.start_jd == 2_440_373.5
    assert across_split.end_jd == 2_440_655.5
    assert sorted(segment.target for segment in across_split.segments) == sorted(TARGETS)
    for segment in across_split.segments:
        assert len(segment.pieces) == 2
        assert segment.spk_segment is segment


def test_routes_each_date_to_the_piece_that_covers_it(across_split: Ephemeris) -> None:
    moon = across_split.segment(3, 301)
    before, after = moon.pieces
    jd = np.array([2_440_400.0, DE441_SPLIT_JD - 1e-3, DE441_SPLIT_JD, 2_440_600.0])
    routed = moon.compute(jd, np.zeros_like(jd))
    expected = np.column_stack(
        [
            before.compute(jd[:2], np.zeros(2)),
            after.compute(jd[2:], np.zeros(2)),
        ]
    )
    np.testing.assert_array_equal(routed, expected)


def test_moon_moves_continuously_across_the_split(across_split: Ephemeris) -> None:
    moon = across_split.segment(3, 301)
    step = 1e-4  # about 8.6 seconds
    position, velocity = moon.compute_and_differentiate(DE441_SPLIT_JD - step, 0.0)
    later = moon.compute(DE441_SPLIT_JD + step, 0.0)
    predicted = position + velocity * 2 * step
    assert position.shape == (3,)
    assert np.linalg.norm(later - predicted) < 0.01  # km


def test_accepts_the_last_covered_instant(across_split: Ephemeris) -> None:
    moon = across_split.segment(3, 301)
    assert np.isfinite(moon.compute(across_split.end_jd)).all()


@pytest.mark.parametrize("jd", [2_440_373.0, 2_440_656.0])
def test_rejects_dates_outside_coverage(across_split: Ephemeris, jd: float) -> None:
    with pytest.raises(ValueError, match="outside ephemeris coverage"):
        across_split.segment(3, 301).compute(jd)


def test_unknown_segment(across_split: Ephemeris) -> None:
    with pytest.raises(KeyError, match="No segment for target 5"):
        across_split.segment(0, 5)


def test_rejects_kernels_with_a_gap_between_them() -> None:
    with pytest.raises(ValueError, match="gap or overlap"):
        Ephemeris([ANCIENT, MODERN])


def test_excerpt_writes_a_loadable_subset(tmp_path: Path) -> None:
    with MODERN.open("rb") as source:
        kernels = excerpt(source, tmp_path, 2_460_750.5, 2_460_760.5)
    assert [(kernel.start_jd, kernel.end_jd) for kernel in kernels] == [(2_460_750.5, 2_460_760.5)]
    assert kernels[0].path.stat().st_size < MODERN.stat().st_size
    with Ephemeris([kernel.path for kernel in kernels]) as small, Ephemeris([MODERN]) as full:
        jd = 2_460_755.25
        np.testing.assert_allclose(
            small.segment(3, 301).compute(jd), full.segment(3, 301).compute(jd), rtol=0, atol=1e-6
        )


def test_excerpt_needs_data_for_both_sides_of_the_split(tmp_path: Path) -> None:
    with BEFORE_SPLIT.open("rb") as source, pytest.raises(ValueError, match="one segment per"):
        excerpt(source, tmp_path, 2_440_400.5, 2_440_450.5)


def test_excerpt_rejects_empty_range(tmp_path: Path) -> None:
    with AFTER_SPLIT.open("rb") as source, pytest.raises(ValueError, match="Empty range"):
        excerpt(source, tmp_path, 2_440_500.5, 2_440_500.5)
