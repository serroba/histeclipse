import io
import math

import numpy as np
import pytest
from PIL import Image

from histeclipse_pipeline.paleotemp import COLUMNS, ROWS
from histeclipse_pipeline.water_cycle import (
    Trend,
    anomalies,
    area_mean,
    area_share,
    critical_t,
    curve,
    decode,
    layer,
    month_dates,
    nearest,
    symmetric_bound,
    text,
    to_nodes,
    to_png,
    trend,
)


def node(latitude: int, longitude: int) -> tuple[int, int]:
    return 90 - latitude, longitude + 180


def test_critical_t_is_close_to_students() -> None:
    values = critical_t(np.array([10.0, 30.0, 1e9]))
    assert values.item(0) == pytest.approx(1.8125, abs=0.003)
    assert values.item(1) == pytest.approx(1.6973, abs=0.001)
    assert values.item(2) == pytest.approx(1.6449, abs=1e-4)


def test_fits_a_trend_per_decade_and_judges_it() -> None:
    years = list(range(1951, 2011))
    rng = np.random.default_rng(1)
    noise = rng.normal(0.0, 1.0, (len(years), 2, 2))
    fields = noise.copy()
    fields[:, 0, 0] = 0.05 * np.arange(len(years))  # a straight line: 0.5 a decade
    fields[:, 0, 1] += 0.2 * np.arange(len(years))  # a strong trend in noise
    fields[: len(years) // 2, 1, 1] = np.nan  # half the years only: too few
    found = trend(years, fields)
    assert found.slope.item(0, 0) == pytest.approx(0.5)
    assert found.slope.item(0, 1) == pytest.approx(2.0, abs=0.2)
    # Straight, strong, noise alone, too few years.
    assert found.significant.tolist() == [[True, True], [False, False]]
    assert math.isnan(found.slope.item(1, 1))
    flat = trend(years, np.zeros((len(years), 1, 1)))
    assert flat.slope.item(0, 0) == 0.0
    assert not flat.significant.item(0, 0)
    with pytest.raises(ValueError, match="3 years for 2 fields"):
        _ = trend([1, 2, 3], np.zeros((2, 1)))


def test_autocorrelated_residuals_need_a_stronger_trend() -> None:
    years = list(range(60))
    rise = 0.03 * np.arange(60, dtype=np.float64)
    wave = np.sin(np.arange(60, dtype=np.float64) / 6.0)  # slow wiggles: neighbours alike
    fields = np.asarray(rise + wave, dtype=np.float64).reshape(60, 1)
    mixed = np.random.default_rng(2).permutation(wave)
    shuffled = np.asarray(rise + mixed, dtype=np.float64).reshape(60, 1)
    assert not trend(years, fields).significant.item(0)
    assert trend(years, shuffled).significant.item(0)


def test_brings_coarse_and_fine_grids_onto_the_nodes() -> None:
    latitude = np.array([45.0, -45.0])
    longitude = np.array([90.0, 270.0])
    values = np.array([[[1.0, 2.0], [3.0, 4.0]]])
    nodes = to_nodes(values, latitude, longitude)
    assert nodes.shape == (1, ROWS, COLUMNS)
    assert nodes[0, *node(80, 100)] == 1.0
    assert nodes[0, *node(10, -100)] == 2.0  # -100° is 260° E
    assert nodes[0, *node(-80, -179)] == 4.0
    assert nearest(values, latitude, longitude).tolist() == nodes.tolist()
    fine_latitude = np.arange(89.75, -90, -0.5)
    fine_longitude = np.arange(-179.75, 180, 0.5)
    fine = np.ones((2, len(fine_latitude), len(fine_longitude)))
    fine[1] = 3.0
    on_nodes = to_nodes(fine, fine_latitude, fine_longitude)
    assert on_nodes[1, *node(0, 0)] == pytest.approx(3.0)


def test_area_means_and_shares() -> None:
    field = np.full((ROWS, COLUMNS), np.nan)
    assert area_mean(field) is None
    field[node(0, 0)] = 2.0
    field[node(60, 0)] = 5.0  # half the weight of the equator's
    assert area_mean(field) == pytest.approx(3.0)
    where = np.zeros((ROWS, COLUMNS), dtype=np.bool_)
    where[node(0, 0)] = True
    assert area_mean(field, where) == pytest.approx(2.0)
    flags = np.zeros((ROWS, COLUMNS), dtype=np.bool_)
    where[node(60, 0)] = True
    flags[node(0, 0)] = True
    assert area_share(flags, where) == pytest.approx(2 / 3)


def test_anomalies_and_curves() -> None:
    years = [2000, 2001, 2002, 2003]
    fields = np.full((4, ROWS, COLUMNS), np.nan)
    fields[:, *node(0, 0)] = [1.0, 3.0, 5.0, 7.0]
    fields[:, *node(10, 10)] = [np.nan, np.nan, np.nan, 1.0]  # no base years
    fields[3] = np.nan
    fields[3, *node(10, 10)] = 1.0
    against = anomalies(years, fields, (2000, 2001), needed=1.0)
    assert against[2, *node(0, 0)] == pytest.approx(3.0)
    assert math.isnan(against.item(3, *node(10, 10)))
    everywhere = np.ones((ROWS, COLUMNS), dtype=np.bool_)
    assert curve(years, against, everywhere) == ([2000, 2001, 2002], [-1.0, 1.0, 3.0])


def test_bounds_encodes_and_describes_a_trend_map() -> None:
    slope = np.full((ROWS, COLUMNS), np.nan)
    slope[node(0, 0)] = 1.0
    slope[node(0, 10)] = -0.31
    with pytest.raises(ValueError, match="no trends"):
        _ = symmetric_bound([np.full((2, 2), np.nan)], 0.1)
    bound = symmetric_bound([slope], 0.1)
    assert bound == pytest.approx(1.0)
    assert symmetric_bound([np.zeros((2, 2))], 0.5) == 0.5
    significant = np.zeros((ROWS, COLUMNS), dtype=np.bool_)
    significant[node(0, 0)] = True
    found = Trend(slope, significant)
    pixels = np.asarray(Image.open(io.BytesIO(to_png(found, bound))), dtype=np.int64)
    assert pixels.shape == (ROWS, COLUMNS, 4)
    red, green, blue, alpha = (pixels.item(*node(0, 0), channel) for channel in range(4))
    assert decode(red, bound) - decode(green, bound) == pytest.approx(1.0, abs=0.01)
    assert (blue, alpha) == (255, 255)
    red, green, blue, alpha = (pixels.item(*node(0, 10), channel) for channel in range(4))
    assert decode(red, bound) - decode(green, bound) == pytest.approx(-0.31, abs=0.01)
    assert (blue, alpha) == (0, 255)
    assert pixels.item(*node(50, 50), 3) == 0
    described = layer("demo", found, (1951, 2020), bound, 2)
    assert described["file"] == "demo.png"
    assert described["period"] == [1951, 2020]
    assert described["significantShare"] == 0.5
    empty = layer("none", Trend(np.full((ROWS, COLUMNS), np.nan), significant), (1, 2), 1.0, 1)
    assert (empty["mean"], empty["significantShare"]) == (None, None)


def test_reads_times_and_text() -> None:
    assert month_dates("hours since 2021-1-1 00:00:00", [0.0, 744.0]) == [(2021, 1), (2021, 2)]
    assert month_dates("days since 1800-1-1", [31.0]) == [(1800, 2)]
    with pytest.raises(ValueError, match="unsupported time units"):
        _ = month_dates("months since 1800-1-1", [1.0])
    with pytest.raises(ValueError, match="unsupported time units"):
        _ = month_dates("days", [1.0])
    assert text(b"abc", "x") == "abc"
    assert text("abc", "x") == "abc"
    with pytest.raises(TypeError, match="x: expected text"):
        _ = text(3, "x")
