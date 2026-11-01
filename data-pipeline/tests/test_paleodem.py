import io
import json
import zipfile
from typing import TYPE_CHECKING

import pytest
from PIL import Image

from histeclipse_pipeline.paleodem import (
    COLUMNS,
    LAND_HEIGHT,
    ROWS,
    SEA_DEPTH,
    Grid,
    decode,
    encode,
    land_fraction,
    read_archive,
    read_grid,
    to_png,
    write_paleodem,
)

if TYPE_CHECKING:
    from pathlib import Path


def csv_text(elevation: float = -4000.0, land_north_of: int = 100) -> str:
    """A whole grid: sea everywhere, land north of a latitude, and the corner spike."""
    lines = ["# lon,lat,elev"]
    for lat in range(90, -91, -1):
        for lon in range(-180, 181):
            value = 500.0 if lat > land_north_of else elevation
            if (lon, lat) == (-180, 90):
                value = 10_500.0
            lines.append(f"{lon:.1f},{lat:.1f},{value:.1f}")
    return "\n".join(lines) + "\n"


def test_reads_a_grid_north_to_south_without_the_corner_spike() -> None:
    grid = read_grid(250, csv_text(land_north_of=60))
    assert (len(grid.rows), len(grid.rows[0])) == (ROWS, COLUMNS)
    assert grid.rows[0][0] == grid.rows[0][1] == 500.0
    assert grid.rows[-1][0] == -4000.0


def test_reads_a_plain_header_and_old_mac_line_endings() -> None:
    text = csv_text().replace("# lon,lat,elev", "longitude,latitude,elevation").replace("\n", "\r")
    assert read_grid(0, text).rows == read_grid(0, csv_text()).rows


def test_fills_a_missing_180_east_column_and_south_pole_row() -> None:
    full = read_grid(150, csv_text(land_north_of=-89))
    lines = [
        line
        for line in csv_text(land_north_of=-89).splitlines()
        if not line.startswith("180.0,") and not line.endswith(",-90.0,-4000.0")
    ]
    trimmed = read_grid(150, "\n".join(lines))
    assert trimmed.rows[:-1] == full.rows[:-1]
    # The pole takes the row next to it: land at 89° S here, where the full grid had sea.
    assert trimmed.rows[-1] == trimmed.rows[-2]


def test_rejects_a_grid_with_holes() -> None:
    with pytest.raises(ValueError, match="no value at"):
        _ = read_grid(5, "# lon,lat,elev\n0.0,0.0,1.0\n")


def test_packs_elevations_into_a_byte_with_sea_level_between_127_and_128() -> None:
    assert encode(0) == 128
    assert encode(-1) == 127
    assert encode(LAND_HEIGHT) == encode(9000) == 255
    assert encode(-SEA_DEPTH) == encode(-12_000) == 0
    for metres in (-10_000, -4000, -200, 0, 300, 2000, 6000):
        step = SEA_DEPTH / 127 if metres < 0 else LAND_HEIGHT / 127
        assert abs(decode(encode(metres)) - metres) <= step


def test_weights_land_by_area() -> None:
    # Land north of 0°: half the sphere, plus half the equator row's weight.
    assert land_fraction(read_grid(0, csv_text(land_north_of=-1))) == pytest.approx(0.5, abs=0.01)
    assert land_fraction(read_grid(0, csv_text(land_north_of=90))) == 0


def test_writes_greyscale_images_and_an_index(tmp_path: Path) -> None:
    grids = [read_grid(5, csv_text()), read_grid(0, csv_text(land_north_of=60))]
    image = Image.open(io.BytesIO(to_png(grids[1])))
    assert (image.mode, image.size) == ("L", (COLUMNS, ROWS))
    assert image.getpixel((10, 0)) == encode(500)
    assert write_paleodem(sorted(grids, key=lambda grid: grid.ma), tmp_path) == 2
    index = json.loads((tmp_path / "index.json").read_text())  # pyright: ignore[reportAny]
    assert index["frames"][0]["file"] == "0.png"
    assert index["seaDepth"] == SEA_DEPTH
    assert (tmp_path / "5.png").exists()


def test_reads_every_grid_in_the_archive_youngest_first() -> None:
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w") as archive:
        archive.writestr("csv/Map05_010Ma.csv", csv_text())
        archive.writestr("csv/Map01_000Ma.csv", csv_text())
        archive.writestr("csv/License.txt", "CC BY 4.0")
    grids = read_archive(out.getvalue())
    assert [grid.ma for grid in grids] == [0, 10]
    assert isinstance(grids[0], Grid)
