"""The place names: the IAU's largest landmarks on each rocky body, from the gazetteer."""

from __future__ import annotations

import io
import zipfile

from histeclipse_pipeline.planet_names import ARCHIVES, archive_url, landmarks, table


def feature(name: str, code: str, diameter: float, **extra: str) -> dict[str, str]:
    """A gazetteer row, adopted, at 10° N 350° E unless said otherwise."""
    return {
        "clean_name": name,
        "code": code,
        "diameter": str(diameter),
        "center_lat": extra.get("lat", "10.004"),
        "center_lon": extra.get("lon", "350.0"),
        "approval": extra.get("approval", "Adopted by IAU"),
    }


def test_each_body_is_pinned_and_fetched_from_the_gazetteer() -> None:
    assert list(ARCHIVES) == ["mercury", "venus", "moon", "mars"]
    assert all(len(sha) == 64 for sha in ARCHIVES.values())
    assert archive_url("mars") == (
        "https://asc-planetarynames-data.s3.us-west-2.amazonaws.com/"
        "MARS_nomenclature_center_pts.zip"
    )


def test_the_table_is_taken_out_of_the_archive() -> None:
    # Given an archive with a shapefile's parts.
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as zipped:
        zipped.writestr("MARS_nomenclature_center_pts.shp", b"shape")
        zipped.writestr("MARS_nomenclature_center_pts.dbf", b"table")
    # When its table is taken out.
    # Then it is the .dbf.
    assert table(buffer.getvalue()) == b"table"


def test_the_largest_landmarks_come_first_in_plain_words() -> None:
    # Given a crater, a larger plain, and a still larger linear feature (a fossa).
    rows = [
        feature("Gale", "AA", 154.2),
        feature("Hellas Planitia", "PL", 2299.4, lat="-42.437", lon="70.5"),
        feature("Sirenum Fossae", "FO", 2731),
    ]
    # When the landmarks are picked.
    names = landmarks(rows)
    # Then the fossa is left out, and the plain comes before the crater.
    assert names == [
        ["Hellas Planitia", -42.44, 70.5, 2299, "plain"],
        ["Gale", 10.0, 350.0, 154, "crater"],
    ]


def test_only_adopted_names_are_kept_and_only_as_many_as_asked() -> None:
    # Given three craters, one of them not adopted.
    rows = [
        feature("Proposed", "AA", 500, approval="Proposed"),
        feature("Big", "AA", 300),
        feature("Small", "AA", 100),
    ]
    # When one is kept.
    # Then it is the largest adopted one.
    assert [name[0] for name in landmarks(rows, kept=1)] == ["Big"]


def test_a_longitude_of_360_is_written_as_0() -> None:
    assert landmarks([feature("Edge", "AA", 50, lon="360.0")])[0][2] == 0.0
