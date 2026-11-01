import pytest

from histeclipse_pipeline.sky import as_json
from histeclipse_pipeline.skycultures import (
    CULTURES,
    hip_stars_file,
    match_catalogue,
    parse_hipparcos,
    referenced_stars,
)

HEADER = [
    "<HEADER>",
    "line[1] = name ra dec hip_number vmag ra_deg dec_deg parallax pm_ra pm_dec",
    "<DATA>",
]
# Arcturus as HEASARC lists it (epoch J1991.25), a star without a parallax, and a broken row.
ROWS = [
    (
        "HIP 69673|213.91811403|19.18726997|69673|-0.05|213.91811403|+19.18726997|88.85"
        "|-1093.45|-1999.4|"
    ),
    "HIP 1|0.00091185|1.08901332|1|9.10|0.00091185|+01.08901332||||",
    "HIP 2|||2|9.27|||||",
    "<END>",
    "HIP 3|1|1|3|1|1|1|1|1|1|",
]


def test_moves_hipparcos_positions_on_to_j2000() -> None:
    stars = parse_hipparcos(HEADER + ROWS)
    arcturus = stars[69673]
    # Arcturus at J2000 (SIMBAD): 213.9153°, +19.1824°.
    assert arcturus.ra == pytest.approx(213.91530, abs=2e-5)
    assert arcturus.dec == pytest.approx(19.18241, abs=2e-5)
    assert arcturus.parallax == pytest.approx(88.85)
    assert stars[1].parallax is None
    assert stars[1].pm_ra == 0
    # Rows without a position are skipped, and nothing after <END> is read.
    assert sorted(stars) == [1, 69673]


def test_reads_a_table_that_ends_without_an_end_marker() -> None:
    assert sorted(parse_hipparcos([*HEADER, ROWS[1], ""])) == [1]


def test_lists_the_hipparcos_stars_a_culture_uses() -> None:
    index = as_json(
        {
            "constellations": [
                {"id": "A", "lines": [[746, 3179, "DSO:NGC5139"], [3179, 4427]]},
                {"id": "B", "lines": [[5350358584482202880, 11569]]},
                {"id": "C"},
            ]
        }
    )
    assert referenced_stars(index) == {746, 3179, 4427, 11569}


def test_matches_bright_stars_to_the_bright_star_catalogue() -> None:
    stars = parse_hipparcos(HEADER + ROWS)
    # Arcturus is HR 5340; a faint star at Arcturus's place does not count as it.
    sky = as_json(
        {
            "stars": {
                "hr": [5340, 9000, 9001],
                "ra": [213.91542, 213.91542, 10.0],
                "dec": [19.1825, 19.1825, 1.0],
                "vmag": [-0.04, 6.0, 9.1],
            }
        }
    )
    assert match_catalogue(stars, sky) == {69673: 5340}


def test_writes_columns_for_the_stars_found() -> None:
    stars = parse_hipparcos(HEADER + ROWS)
    file = hip_stars_file(stars, {1, 69673, 99999}, {69673: 5340})
    assert file["hip"] == [1, 69673]
    assert file["hr"] == [None, 5340]
    assert file["epoch"] == 2000
    assert file["parallax"] == [None, 88.85]
    assert "Hipparcos" in str(file["source"])


def test_pins_every_culture_file() -> None:
    for files in CULTURES.values():
        assert set(files) == {"index.json", "description.md"}
        assert all(len(digest) == 64 for digest in files.values())
