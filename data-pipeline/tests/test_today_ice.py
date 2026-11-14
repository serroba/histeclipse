import io
import struct
import zipfile
from typing import TYPE_CHECKING

import numpy as np
from PIL import Image

from histeclipse_pipeline.icesheets import COLUMNS, ROWS, Frame, write_icesheets
from histeclipse_pipeline.today_ice import FLOOR, signed_area, today_ice, with_today

if TYPE_CHECKING:
    from pathlib import Path

type Ring = list[tuple[float, float]]


def square(west: float, south: float, east: float, north: float, *, hole: bool = False) -> Ring:
    """A closed ring round a box: clockwise (an outer ring), or anticlockwise for a hole."""
    ring = [(west, south), (west, north), (east, north), (east, south), (west, south)]
    return ring[::-1] if hole else ring


def shapefile(records: list[list[Ring]]) -> bytes:
    """A polygon shapefile, each record its rings in parts."""
    body = b""
    for number, rings in enumerate(records, start=1):
        points = [point for ring in rings for point in ring]
        starts = [sum(len(each) for each in rings[:index]) for index in range(len(rings))]
        content = (
            struct.pack("<i", 5)
            + bytes(32)
            + struct.pack("<ii", len(rings), len(points))
            + struct.pack(f"<{len(starts)}i", *starts)
            + struct.pack(f"<{2 * len(points)}d", *[value for point in points for value in point])
        )
        body += struct.pack(">ii", number, len(content) // 2) + content
    return bytes(100) + body


def archive(records: list[list[Ring]]) -> bytes:
    """A zip holding the shapefile and an empty table, as Natural Earth's are."""
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as zipped:
        zipped.writestr("ice.shp", shapefile(records))
        zipped.writestr("ice.dbf", b"")
    return buffer.getvalue()


def node(latitude: float, longitude: float) -> tuple[int, int]:
    return round((90 - latitude) * 4), round((longitude + 180) * 4)


def test_tells_outer_rings_from_holes() -> None:
    assert signed_area(square(0, 0, 1, 1)) < 0
    assert signed_area(square(0, 0, 1, 1, hole=True)) > 0


def test_rasterises_today_ice_with_its_holes_left_out() -> None:
    # An ice cap with a nunatak, and, in a second layer, a shelf.
    cap = [[square(-50, 70, -30, 80), square(-41, 74, -39, 76, hole=True)]]
    shelf = [[square(-170, -85, -150, -78)]]
    mask = today_ice([archive(cap), archive(shelf)], COLUMNS, ROWS)
    assert mask.shape == (ROWS, COLUMNS)
    assert mask[node(72, -45)]
    assert not mask[node(75, -40)]  # the nunatak
    assert mask[node(-80, -160)]
    assert not mask[node(0, 0)]


def test_brings_each_frame_to_at_least_today_ice() -> None:
    mask = np.array([[True, True, False]])
    thick = with_today(np.array([[0.0, 2000.0, 50.0]]), mask)
    assert thick.tolist() == [[FLOOR, 2000.0, 50.0]]


def test_writes_frames_with_today_ice_filled(tmp_path: Path) -> None:
    mask = np.zeros((5, 9), dtype=np.bool_)
    mask[0, 0] = True
    frames = [Frame(0.0, np.zeros((5, 9)))]
    assert write_icesheets(iter(frames), tmp_path, mask) == 1
    with Image.open(tmp_path / "0.png") as image:
        # Today's ice is in the step (red), and left to the photo (green).
        assert image.getpixel((0, 0)) == (FLOOR // 16, 0, 0)
        assert image.getpixel((1, 0)) == (0, 0, 0)
