"""Tests for the dated ancient genomes from the Allen Ancient DNA Resource."""

from histeclipse_pipeline.aadr import Genome, cell_of, genomes_file, parse_anno, passes

COLUMNS = 49


def row(**values: str) -> str:
    """One annotation row, its columns set by position name."""
    positions = {
        "individual": 2,
        "publication": 6,
        "doi": 7,
        "bp": 10,
        "group": 14,
        "latitude": 17,
        "longitude": 18,
        "assessment": 47,
    }
    cells = [".."] * COLUMNS
    for name, value in values.items():
        cells[positions[name]] = value
    return "\t".join(cells)


def ancient(individual: str, bp: str = "4879", assessment: str = "PASS") -> str:
    return row(
        individual=individual,
        publication="Narasimhan2019",
        doi="10.1126/science.aat7487",
        bp=bp,
        group="Russia_Altai_Afanasievo",
        latitude="50.55",
        longitude="86.59",
        assessment=assessment,
    )


HEADER = "\t".join(f"column {index}" for index in range(COLUMNS))


def test_keeps_ancient_individuals_that_pass_once_each_by_cell() -> None:
    text = "\n".join(
        [
            HEADER,
            ancient("I1829"),
            ancient("I1829", bp="4900"),  # the same person again: kept once
            ancient("I2000", assessment="QUESTIONABLE (contamination)"),
            ancient("I3000", bp="0"),  # present-day
            ancient("I4000", bp=".."),
            ancient("I5000", bp="2345", assessment="PROVISIONAL_PASS"),
            "too\tshort",
        ]
    )
    genomes = parse_anno(text)
    assert genomes == [
        Genome(
            (50, 86), 4880, "Russia_Altai_Afanasievo", "Narasimhan2019", "10.1126/science.aat7487"
        ),
        Genome(
            (50, 86), 2340, "Russia_Altai_Afanasievo", "Narasimhan2019", "10.1126/science.aat7487"
        ),
    ]


def test_cells_are_two_degrees_by_their_south_west_corner() -> None:
    assert cell_of(50.55, 86.59) == (50, 86)
    assert cell_of(-0.5, -0.5) == (-2, -2)
    assert cell_of(90.0, 180.0) == (88, 178)


def test_assessments_that_pass() -> None:
    assert passes("PASS")
    assert passes("MERGE_PASS (low coverage)")
    assert not passes("PROVISIONAL_CRITICAL")
    assert not passes("")


def test_the_site_file_indexes_cells_labels_and_papers() -> None:
    genomes = [
        Genome((50, 86), 4880, "B", "P2", "10.2/b"),
        Genome((10, 20), 3000, "A", "P1", "10.1/a"),
    ]
    data = genomes_file(genomes)
    assert data["cells"] == [[10, 20], [50, 86]]
    assert data["groups"] == ["A", "B"]
    assert data["papers"] == [{"name": "P1", "doi": "10.1/a"}, {"name": "P2", "doi": "10.2/b"}]
    assert data["genomes"] == [[0, 3000, 0, 0], [1, 4880, 1, 1]]
    assert data["cellDegrees"] == 2
