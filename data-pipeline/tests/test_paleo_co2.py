"""Tests for the Paleo-CO2 Data Archive's estimates, by method."""

import io
import zipfile
from typing import TYPE_CHECKING, cast

from openpyxl import Workbook

from histeclipse_pipeline.paleo_co2 import (
    Estimate,
    Study,
    archive_file,
    estimates_in,
    method_of,
    read_archive,
)

if TYPE_CHECKING:
    from openpyxl.worksheet.worksheet import Worksheet

HEADING = [
    "proxy",
    "first_author_last_name",
    "publication_year",
    "doi",
    "age_ka",
    "Age_uncertainty_pos_ka",
    "Age_uncertainty_neg_ka",
    "CO2_ppm",
    "CO2_uncertainty_pos_ppm",
    "CO2_uncertainty_neg_ppm",
    "Name of individual entering the data",
    "Contact email",
    # A heading that comes again, in a later block of columns: the first counts.
    "CO2_ppm",
]


def _study(*rows: list[object]) -> bytes:
    book = Workbook()
    sheet = cast("Worksheet", book.active)
    sheet.append(["Basic Info"])
    sheet.append([])
    sheet.append(HEADING)
    for row in rows:
        sheet.append(row)
    out = io.BytesIO()
    book.save(out)
    return out.getvalue()


PERSON = ["Someone", "someone@example.org", "NA"]
HAYNES = Study("Haynes", 2020, "10.1073/pnas.2003197117")
#: A row's proxy and study, as Haynes et al. 2020's sheet gives them.
B_CA = ["B/Ca", "Haynes", 2020, "10.1073/pnas.2003197117"]
NONE = ["NA"] * 6


def test_puts_each_proxy_under_its_method() -> None:
    assert method_of("boron isotopes") == "Boron"
    assert method_of("B/Ca, boron isotopes") == "Boron"
    assert method_of("land_plant_d13C_1") == "Land-plant δ¹³C"
    assert method_of("stomata-franks") == "Leaf gas exchange"
    assert method_of("Stomata-SR") == "Stomatal ratio"
    assert method_of("paleosols") == "Paleosols"
    assert method_of("tree rings") is None


def test_reads_a_studys_estimates_leaving_out_who_entered_them() -> None:
    data = _study(
        [
            "B/Ca",
            "Haynes",
            2020,
            "10.1073/pnas.2003197117",
            55709,
            "NA",
            400,
            652,
            170,
            134,
            *PERSON,
        ],
        [
            "B/Ca",
            "Haynes",
            2020,
            "10.1073/pnas.2003197117",
            55800,
            "NA",
            "NA",
            700,
            "NA",
            "NA",
            *PERSON,
        ],
        [
            "paleosol",
            "Ekart",
            1999,
            "10.2475/ajs.299.10.805",
            300000,
            "NA",
            "NA",
            -50,
            10,
            10,
            *PERSON,
        ],
        [
            "B/Ca",
            "Haynes",
            2020,
            "10.1073/pnas.2003197117",
            "NA",
            "NA",
            "NA",
            "NA",
            "NA",
            "NA",
            *PERSON,
        ],
    )
    assert estimates_in(data) == [
        Estimate(55.709, 652.0, 518.0, 822.0, "Boron", HAYNES),
        Estimate(55.8, 700.0, None, None, "Boron", HAYNES),
    ]


def test_reads_every_study_in_the_archive_and_names_those_without_co2() -> None:
    archive = io.BytesIO()
    with zipfile.ZipFile(archive, "w") as zipped:
        zipped.writestr(
            "archive/b_ca_haynes_2020.xlsx",
            _study(
                ["B/Ca", "Haynes", 2020, "10.1073/pnas.2003197117", 55709, "NA", 400, 652, 170, 134]
            ),
        )
        zipped.writestr(
            "archive/paleosol_nordt_2003.xlsx", _study(["paleosol", "Nordt", 2003, "x", "NA"])
        )
        zipped.writestr("__MACOSX/archive/._b_ca_haynes_2020.xlsx", b"")
        zipped.writestr("archive/.DS_Store", b"")
    estimates, empty = read_archive(archive.getvalue())
    assert [estimate.ppm for estimate in estimates] == [652.0]
    assert empty == ["paleosol_nordt_2003.xlsx"]


def test_the_site_file_has_methods_studies_and_compact_estimates() -> None:
    older = Estimate(
        300.0, 1000.0, None, 1500.0, "Paleosols", Study("Ekart", 1999, "doi:10.2475/x")
    )
    younger = Estimate(55.709, 652.4, 518.0, 822.0, "Boron", HAYNES)
    unlinked = Estimate(1.0, 280.0, None, None, "Boron", Study("", 2001, "NA"))
    data = archive_file([older, younger, unlinked], "2026-11-04")
    assert data["accessed"] == "2026-11-04"
    methods = data["methods"]
    assert isinstance(methods, list)
    assert methods[:2] == ["Boron", "Phytoplankton"]
    assert data["studies"] == [
        {"author": "", "year": 2001, "doi": None},
        {"author": "Ekart", "year": 1999, "doi": "10.2475/x"},
        {"author": "Haynes", "year": 2020, "doi": "10.1073/pnas.2003197117"},
    ]
    assert data["estimates"] == [
        [1.0, 280, None, None, 0, 0],
        [55.709, 652, 518, 822, 0, 2],
        [300.0, 1000, None, 1500, 7, 1],
    ]
