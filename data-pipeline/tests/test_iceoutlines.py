"""Tests for the Batchelor et al. (2019) ice-sheet outlines."""

import math
import struct

import pytest
from hypothesis import given
from hypothesis import strategies as st

from histeclipse_pipeline import iceoutlines
from histeclipse_pipeline.iceoutlines import (
    FILES,
    SLICES,
    from_lon_lat,
    is_geographic,
    outline_rings,
    outlines_file,
    polygon_rings,
    to_lon_lat,
    unwrapped,
)


def shapefile(rings: list[list[tuple[float, float]]], kind: int = 5) -> bytes:
    """A .shp holding one polygon of ``rings``, then a null shape."""
    points = [point for ring in rings for point in ring]
    xs, ys = [x for x, _ in points], [y for _, y in points]
    box = struct.pack("<4d", min(xs), min(ys), max(xs), max(ys))
    starts: list[int] = []
    total = 0
    for ring in rings:
        starts.append(total)
        total += len(ring)
    content = (
        struct.pack("<i", kind)
        + box
        + struct.pack("<ii", len(rings), total)
        + struct.pack(f"<{len(rings)}i", *starts)
        + struct.pack(f"<{2 * total}d", *[value for point in points for value in point])
    )
    null = struct.pack("<i", 0)
    records = struct.pack(">ii", 1, len(content) // 2) + content
    records += struct.pack(">ii", 2, len(null) // 2) + null
    header = struct.pack(">i", 9994) + bytes(20) + struct.pack(">i", (100 + len(records)) // 2)
    header += struct.pack("<ii", 1000, kind) + box + bytes(32)
    return header + records


@given(
    st.floats(min_value=-179.9, max_value=179.9),
    st.floats(min_value=20.0, max_value=89.9),
)
def test_the_inverse_projection_undoes_the_forward_one(lon: float, lat: float) -> None:
    back_lon, back_lat = to_lon_lat(*from_lon_lat(lon, lat))
    assert back_lat == pytest.approx(lat, abs=1e-6)
    assert back_lon == pytest.approx(lon, abs=1e-6)


def test_the_projection_keeps_known_distances() -> None:
    # On the ellipsoid, 60°N lies about 3,330 km from the pole on this projection.
    x, y = from_lon_lat(0.0, 60.0)
    assert x == pytest.approx(0.0, abs=1e-6)
    assert -y == pytest.approx(3_330_000, rel=0.01)
    assert to_lon_lat(0.0, 0.0) == pytest.approx((180.0, 90.0))


def test_reads_every_ring_and_skips_null_shapes() -> None:
    outer = [(0.0, 0.0), (10.0, 0.0), (10.0, 10.0), (0.0, 0.0)]
    hole = [(2.0, 2.0), (2.0, 4.0), (4.0, 4.0), (2.0, 2.0)]
    assert list(polygon_rings(shapefile([outer, hole]))) == [outer, hole]
    assert list(polygon_rings(shapefile([outer], kind=15))) == [outer]


def test_refuses_shapes_that_are_not_polygons() -> None:
    with pytest.raises(ValueError, match="not a polygon"):
        _ = list(polygon_rings(shapefile([[(0.0, 0.0), (1.0, 1.0)]], kind=3)))


def test_tells_degrees_from_metres() -> None:
    degrees = [(-20.0, 60.0), (20.0, 60.0), (20.0, 70.0), (-20.0, 60.0)]
    metres = [(-2e6, -2e6), (2e6, -2e6), (2e6, 2e6), (-2e6, -2e6)]
    assert is_geographic(shapefile([degrees]))
    assert not is_geographic(shapefile([metres]))


def test_a_ring_across_the_date_line_is_made_continuous() -> None:
    crossing = unwrapped([(170.0, 60.0), (-170.0, 60.0), (-170.0, 65.0), (170.0, 60.0)])
    assert crossing == [(170.0, 60.0), (190.0, 60.0), (190.0, 65.0), (170.0, 60.0)]
    back = unwrapped([(-170.0, 60.0), (170.0, 60.0)])
    assert back == [(-170.0, 60.0), (-190.0, 60.0)]


def test_outlines_come_back_in_degrees_with_small_rings_dropped() -> None:
    big = [from_lon_lat(lon, lat) for lon, lat in [(-100, 50), (-60, 50), (-60, 70), (-100, 50)]]
    speck = [from_lon_lat(lon, lat) for lon, lat in [(0, 60), (0.1, 60), (0.1, 60.1), (0, 60)]]
    rings = outline_rings(shapefile([big, speck]))
    assert len(rings) == 1
    assert rings[0][0] == pytest.approx((-100.0, 50.0))


def test_the_site_file_lists_every_slice_with_its_hypotheses() -> None:
    ring = [(-100.0, 50.0), (-60.0, 50.0), (-60.0, 70.0), (-100.0, 50.0)]
    data = outlines_file({("MIS 6", "best"): [ring]})
    assert data["schemaVersion"] == 1
    slices = data["slices"]
    assert isinstance(slices, list)
    assert len(slices) == len(SLICES)
    mis6 = next(s for s in slices if isinstance(s, dict) and s["name"] == "MIS 6")
    assert isinstance(mis6, dict)
    assert mis6["best"] == [[-10000, 5000, -6000, 5000, -6000, 7000, -10000, 5000]]
    assert mis6["min"] == []
    assert (mis6["fromKa"], mis6["toKa"]) == (132.0, 190.0)


def test_every_file_belongs_to_a_slice_and_slices_run_older() -> None:
    names = {time_slice.name for time_slice in SLICES}
    assert {name for name, _, _, _ in FILES} == names
    assert len(FILES) == 3 * (len(SLICES) - 1) + 1
    starts = [time_slice.from_ka for time_slice in SLICES]
    assert starts == sorted(starts)
    assert all(math.isfinite(t.to_ka) and t.to_ka > t.from_ka for t in SLICES)
    assert iceoutlines.CREDIT.startswith("Batchelor et al. (2019)")
