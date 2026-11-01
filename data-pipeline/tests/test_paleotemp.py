import io
import json
import zipfile
from typing import TYPE_CHECKING

import numpy as np
import pytest
from PIL import Image

from histeclipse_pipeline.paleotemp import (
    COLDEST,
    COLUMNS,
    ROWS,
    WARMEST,
    Map,
    Temperatures,
    decode,
    encode,
    global_mean,
    read_archive,
    read_map,
    repair,
    to_png,
    write_paleotemp,
)

if TYPE_CHECKING:
    from pathlib import Path


def grid(value: float = 15.0) -> Temperatures:
    """A whole map at one temperature, with the archive's planted anchors."""
    values = np.full((ROWS, COLUMNS), value)
    values[0, 0] = 50.0
    values[0, 1] = -55.0
    return values


def csv_text(values: Temperatures) -> str:
    out = io.StringIO()
    np.savetxt(out, values, fmt="%.6f", delimiter=",")
    return out.getvalue()


def test_reads_a_headerless_grid() -> None:
    read = read_map(250, csv_text(grid(30.0)))
    assert read.temperatures.shape == (ROWS, COLUMNS)
    assert read.temperatures[1, 5] == 30.0


def test_rejects_a_grid_of_another_size() -> None:
    with pytest.raises(ValueError, match="expected 181 by 361"):
        _ = read_map(5, "1,2,3\n4,5,6\n")


def test_drops_the_planted_anchors_and_joins_the_seam() -> None:
    values = grid(20.0)
    values[-1, 7] = 21.0  # a stray value at the south pole
    values[50, 0] = 10.0  # the two 180° columns disagree
    values[50, -1] = 14.0
    repaired = repair(values)
    assert np.array_equal(repaired[:1], np.full((1, COLUMNS), 20.0))
    assert np.array_equal(repaired[-1:], np.full((1, COLUMNS), 20.0))
    assert repaired[50, 0] == repaired[50, -1] == 12.0


def test_packs_temperatures_into_a_byte() -> None:
    packed = encode(np.array([COLDEST, -80.0, 0.0, WARMEST, 70.0], dtype=np.float64))
    assert packed.tolist() == [0, 0, 128, 255, 255]
    samples = (-40.0, -5.5, 0.0, 14.6, 33.0)
    for celsius, byte in zip(samples, bytes(encode(np.array(samples))), strict=True):
        assert abs(decode(byte) - celsius) <= (WARMEST - COLDEST) / 255 / 2 + 1e-9


def test_weights_the_mean_by_area() -> None:
    values = np.full((ROWS, COLUMNS), 10.0)
    values[:90] = 30.0  # the northern half warmer
    assert global_mean(values) == pytest.approx(20.0, abs=0.2)
    assert global_mean(repair(grid(15.0))) == pytest.approx(15.0)


def test_writes_greyscale_images_and_an_index(tmp_path: Path) -> None:
    with Image.open(io.BytesIO(to_png(repair(grid(0.0))))) as image:
        assert (image.mode, image.size) == ("L", (COLUMNS, ROWS))
        assert image.getpixel((0, 0)) == 128
    maps = [Map(0, grid(14.6)), Map(10, grid(18.0))]
    assert write_paleotemp(iter(maps), tmp_path) == 2
    index = json.loads((tmp_path / "index.json").read_text())  # pyright: ignore[reportAny]
    assert (index["columns"], index["rows"]) == (COLUMNS, ROWS)
    assert (index["coldest"], index["warmest"]) == (COLDEST, WARMEST)
    assert index["frames"] == [
        {"ma": 0, "file": "0.png", "mean": 14.6},
        {"ma": 10, "file": "10.png", "mean": 18.0},
    ]


def test_notes_the_map_that_stands_out(tmp_path: Path) -> None:
    _ = write_paleotemp(iter([Map(60, grid(22.0)), Map(65, grid(8.0))]), tmp_path)
    index = json.loads((tmp_path / "index.json").read_text())  # pyright: ignore[reportAny]
    assert "note" not in index["frames"][0]
    assert "does not say why" in index["frames"][1]["note"]


def test_reads_every_map_in_the_archive_youngest_first() -> None:
    out = io.BytesIO()
    text = csv_text(grid())
    with zipfile.ZipFile(out, "w") as archive:
        archive.writestr("010_temp.csv", text)
        archive.writestr("000_temp.csv", text)
        archive.writestr("__MACOSX/._000_temp.csv", b"\0")
        archive.writestr("readme.txt", "CC BY 4.0")
    assert [each.ma for each in read_archive(out.getvalue())] == [0, 10]
