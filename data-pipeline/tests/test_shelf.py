import io
import json
from typing import TYPE_CHECKING

import numpy as np
import pytest
from PIL import Image

from histeclipse_pipeline.shelf import (
    COLUMNS,
    HIGHEST,
    LOWEST,
    ROWS,
    encode,
    read_grid,
    to_png,
    write_shelf,
)

if TYPE_CHECKING:
    from pathlib import Path


def ascii_grid(rows: int = ROWS, columns: int = COLUMNS, value: float = -50.0) -> str:
    out = io.StringIO()
    header = (
        f"ncols {columns}\nnrows {rows}\nxllcenter -180.0\nyllcenter -90.0\n"
        "cellsize 0.1\nnodata_value -9999999\n"
    )
    _ = out.write(header)
    np.savetxt(out, np.full((rows, columns), value), fmt="%.0f")
    return out.getvalue()


def test_reads_an_esri_ascii_grid() -> None:
    heights = read_grid(ascii_grid(value=-22.0))
    assert heights.shape == (ROWS, COLUMNS)
    assert heights[100, 100] == -22.0


def test_rejects_a_grid_of_another_size() -> None:
    with pytest.raises(ValueError, match="expected 1801 by 3601"):
        _ = read_grid(ascii_grid(rows=3, columns=4))


def test_rejects_missing_values() -> None:
    with pytest.raises(ValueError, match="1801 nodes have no value"):
        _ = read_grid(ascii_grid().replace("\n-50 ", "\n-9999999 "))


def test_packs_a_metre_a_byte_within_the_band() -> None:
    samples = np.array([-11_000, LOWEST, -130.4, -0.6, 0, 22, HIGHEST, 8_000], dtype=np.float64)
    assert encode(samples).tolist() == [0, 0, 70, 199, 200, 222, 255, 255]


def test_writes_the_image_and_its_index(tmp_path: Path) -> None:
    heights = np.full((ROWS, COLUMNS), -1000.0)
    heights[:900] = 10.0
    assert write_shelf(heights, tmp_path) == len(to_png(heights))
    with Image.open(tmp_path / "today.png") as image:
        assert (image.mode, image.size) == ("L", (COLUMNS, ROWS))
        assert image.getpixel((0, 0)) == 210
        assert image.getpixel((0, ROWS - 1)) == 0
    index = json.loads((tmp_path / "index.json").read_text())  # pyright: ignore[reportAny]
    assert (index["lowest"], index["highest"], index["file"]) == (LOWEST, HIGHEST, "today.png")
