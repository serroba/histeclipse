"""Tests for ArchaeoGLOBE's ways of life by region."""

import io
import struct
import zipfile

import pytest

from histeclipse_pipeline.archaeoglobe import (
    MOMENTS,
    assessments,
    dbf_rows,
    from_eckert_iv,
    read_regions,
    region_outlines,
    to_eckert_iv,
    ways_file,
)


def dbf(rows: list[tuple[str, str]]) -> bytes:
    """A dBASE table with two text fields, Archaeo_ID (4) and Archaeo_RG (20)."""
    fields = [("Archaeo_ID", 4), ("Archaeo_RG", 20)]
    header_length = 32 + 32 * len(fields) + 1
    record_length = 1 + sum(length for _, length in fields)
    header = struct.pack("<BBBBIHH", 3, 126, 1, 1, len(rows), header_length, record_length) + bytes(
        20
    )
    for name, length in fields:
        header += name.encode().ljust(11, b"\0") + b"C" + bytes(4) + bytes([length, 0]) + bytes(14)
    body = b"".join(
        b" " + region.encode().ljust(4) + name.encode().ljust(20) for region, name in rows
    )
    return header + b"\r" + body


def shp(polygons: list[list[tuple[float, float]]]) -> bytes:
    """A polygon shapefile, one ring per record."""
    records = b""
    for number, ring in enumerate(polygons, start=1):
        content = (
            struct.pack("<i", 5)
            + bytes(32)
            + struct.pack("<ii", 1, len(ring))
            + struct.pack("<i", 0)
        )
        content += struct.pack(f"<{2 * len(ring)}d", *[value for point in ring for value in point])
        records += struct.pack(">ii", number, len(content) // 2) + content
    return bytes(100) + records


@pytest.mark.parametrize(("lon", "lat"), [(0.0, 0.0), (-150.0, 64.0), (120.0, -30.0), (10.0, 85.0)])
def test_the_inverse_projection_undoes_the_forward_one(lon: float, lat: float) -> None:
    back = from_eckert_iv(*to_eckert_iv(lon, lat))
    assert back == pytest.approx((lon, lat), abs=1e-6)


def test_reads_the_regions_table() -> None:
    assert dbf_rows(dbf([("1", "Alaska"), ("2", "Yukon Territory")])) == [
        {"Archaeo_ID": "1", "Archaeo_RG": "Alaska"},
        {"Archaeo_ID": "2", "Archaeo_RG": "Yukon Territory"},
    ]


def test_outlines_come_back_in_degrees_by_region() -> None:
    square = [
        to_eckert_iv(lon, lat)
        for lon, lat in [(-160, 60), (-140, 60), (-140, 70), (-160, 70), (-160, 60)]
    ]
    speck = [to_eckert_iv(lon, lat) for lon, lat in [(0, 0), (0.01, 0), (0.01, 0.01), (0, 0)]]
    outlines = region_outlines(shp([square, speck]), dbf([("1", "Alaska"), ("2", "Speck")]))
    assert list(outlines) == [1]
    assert outlines[1][0][0] == pytest.approx((-160.0, 60.0), abs=1e-6)


def test_reads_the_levels_of_each_way_of_life_at_each_moment() -> None:
    columns = ["Region", "Label"] + [
        f"{prefix}_{moment}" for prefix in ("FHG", "EXAG", "PAS") for moment, _ in MOMENTS
    ]
    values = (
        ["7", "Somewhere"] + ["Widespread"] * 10 + ["None"] * 5 + ["Common"] * 5 + ["Minimal"] * 10
    )
    text = ",".join(columns) + "\n" + ",".join(values) + "\n"
    levels = assessments(text)[7]
    assert levels["foraging"] == [3] * 10
    assert levels["extensive"] == [0] * 5 + [2] * 5
    assert levels["pastoralism"] == [1] * 10
    assert levels["urban"] == [0] * 10


def test_the_site_file_and_the_archive() -> None:
    ring = [(-160.0, 60.0), (-140.0, 60.0), (-140.0, 70.0), (-160.0, 60.0)]
    data = ways_file({1: "Alaska"}, {1: [ring]}, {1: {"foraging": [3] * 10}})
    assert data["years"] == [year for _, year in MOMENTS]
    assert data["regions"] == [
        {
            "id": 1,
            "name": "Alaska",
            "rings": [[-16000, 6000, -14000, 6000, -14000, 7000, -16000, 6000]],
            "levels": {"foraging": [3] * 10},
        }
    ]
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as zipped:
        zipped.writestr("regions/r.shp", b"shp")
        zipped.writestr("regions/r.dbf", b"dbf")
    assert read_regions(buffer.getvalue()) == (b"shp", b"dbf")
