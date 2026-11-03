"""Tests for reading the International Chronostratigraphic Chart from its RDF."""

from histeclipse_pipeline.ics import Unit, chart_file, parse_chart

TURTLE = """
@prefix gtsd: <https://data.stratigraphy.org/data/gts/> .
@prefix gts: <http://resource.geosciml.org/ontology/timescale/gts#> .
@prefix rank: <http://resource.geosciml.org/ontology/timescale/rank/> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
@prefix time: <http://www.w3.org/2006/time#> .
@prefix schema: <https://schema.org/> .

gtsd:Jurassic a skos:Concept ;
    gts:rank rank:Period ;
    skos:broader gtsd:Mesozoic ;
    skos:prefLabel "Jura"@de , "Jurassic"@en ;
    time:hasBeginning [ gtsd:inMYA 201.4 ; schema:marginOfError 0.2 ] ;
    time:hasEnd [ gtsd:inMYA 143.1 ; schema:marginOfError 0.6 ] ;
    schema:color "#34B2C9" .

gtsd:Ediacaran a skos:Concept ;
    gts:rank rank:Period ;
    skos:broader gtsd:Neoproterozoic ;
    skos:prefLabel "Ediacaran"@en ;
    time:hasBeginning [ skos:note "uncertain" ; gtsd:inMYA 635 ] ;
    time:hasEnd [ gtsd:inMYA 538.8 ] ;
    schema:color "#FED96A" .

gtsd:UpperPleistocene a skos:Concept ;
    gts:rank rank:Age ;
    time:hasBeginning [ gtsd:inMYA 0.129 ] ;
    time:hasEnd [ gtsd:inMYA 0.0117 ] .

gtsd:Undated a skos:Concept ;
    gts:rank rank:Period ;
    skos:prefLabel "Undated"@en .
"""


def test_reads_each_unit_with_its_ages_margins_and_colour_oldest_first() -> None:
    assert parse_chart(TURTLE) == [
        Unit(
            id="Ediacaran",
            name="Ediacaran",
            rank="Period",
            parent="Neoproterozoic",
            base=635.0,
            base_margin=0.0,
            base_uncertain=True,
            top=538.8,
            colour="#FED96A",
        ),
        Unit(
            id="Jurassic",
            name="Jurassic",
            rank="Period",
            parent="Mesozoic",
            base=201.4,
            base_margin=0.2,
            base_uncertain=False,
            top=143.1,
            colour="#34B2C9",
        ),
        Unit(
            id="UpperPleistocene",
            name="Upper Pleistocene",
            rank="Age",
            parent=None,
            base=0.129,
            base_margin=0.0,
            base_uncertain=False,
            top=0.0117,
            colour="#cccccc",
        ),
    ]


def test_the_site_file_keeps_every_field() -> None:
    data = chart_file(parse_chart(TURTLE))
    assert data["version"] == "2026-06"
    units = data["units"]
    assert isinstance(units, list)
    assert units[1] == {
        "id": "Jurassic",
        "name": "Jurassic",
        "rank": "Period",
        "parent": "Mesozoic",
        "base": 201.4,
        "baseMargin": 0.2,
        "baseUncertain": False,
        "top": 143.1,
        "colour": "#34B2C9",
    }
