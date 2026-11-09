"""Tests for the fossil groups' trees through time and place (PBDB)."""

import pytest

from histeclipse_pipeline.time_tree import (
    Find,
    Taxon,
    genus_of,
    middle_of,
    parse_finds,
    parse_taxa,
    species_counts,
    tracks,
    tree_file,
)

TAXA_HEADER = (
    '"orig_no","taxon_no","flags","taxon_name","difference","accepted_no","accepted_rank",'
    '"accepted_name","parent_no","is_extant","firstapp_max_ma","lastapp_min_ma"\n'
)
TAXA = (
    TAXA_HEADER
    + """\
"1","1","","Dinosauria","","1","unranked clade","Dinosauria","0","extant","251.9","0"
"2","2","","Theropoda","","2","unranked clade","Theropoda","1","extant","235","0"
"3","3","","Tyrannosauridae","","3","family","Tyrannosauridae","2","extinct","83.6","66"
"4","4","","Tyrannosaurus","","4","genus","Tyrannosaurus","3","extinct","83.6","66"
"5","5","","Manospondylus","synonym of","4","genus","Tyrannosaurus","3","extinct","83.6","66"
"6","6","","Tyrannosaurus rex","","6","species","Tyrannosaurus rex","4","extinct","72.2","66"
"7","7","I","Grallator","","7","genus","Grallator","2","extinct","250.8","161.5"
"8","8","","Kurupi","","8","genus","Kurupi","3","extant","72.2","66"
"9","9","","Gallus","","9","genus","Gallus","2","extant","11.63","0"
"""
)

FINDS_HEADER = (
    '"occurrence_no","accepted_name","accepted_rank","accepted_no","max_ma","min_ma",'
    '"paleolng","paleolat"\n'
)
FINDS = (
    FINDS_HEADER
    + """"1","Tyrannosaurus rex","species","6","70","66","-80","50"
"2","Tyrannosaurus","genus","4","68","66","-78","52"
"3","Tyrannosauridae","family","3","70","66","-80","50"
"4","Tyrannosaurus","genus","4","100","66","-80","50"
"5","Grallator","genus","7","210","200","10","20"
"6","Kurupi","genus","8","72","68","-35","-25"
"7","Unplaced","genus","4","70","66","",""
"""
)


def test_reads_valid_names_and_leaves_out_synonyms() -> None:
    taxa = parse_taxa(TAXA)
    assert 5 not in taxa
    assert taxa[4] == Taxon(4, "Tyrannosaurus", "genus", 3, 83.6, 66.0)
    assert taxa[1].parent is None
    assert taxa[7].trace


def test_a_genus_is_living_only_if_found_in_the_holocene() -> None:
    taxa = parse_taxa(TAXA)
    # PBDB flags Kurupi, an abelisaurid, as extant; its last find is 66 million years old.
    assert taxa[8].last_ma == 66.0
    assert taxa[9].last_ma == 0.0


def test_a_find_goes_to_its_genus_through_its_species() -> None:
    taxa = parse_taxa(TAXA)
    assert genus_of(6, taxa) == 4
    assert genus_of(4, taxa) == 4
    assert genus_of(3, taxa) is None
    assert genus_of(99, taxa) is None
    assert species_counts(taxa) == {4: 1}


def test_tracks_each_genus_by_step_leaving_out_vague_finds() -> None:
    taxa = parse_taxa(TAXA)
    found = tracks(parse_finds(FINDS), taxa)
    # The two Tyrannosaurus finds dated closely both fall in the step from 65 Ma; the one dated
    # only to 100-66 Ma is too vague, and the family-level find names no genus.
    assert found[4] == [(65, 51.0, -79.0, 2)]
    assert found[7] == [(205, 20.0, 10.0, 1)]


def test_the_middle_of_places_is_on_the_sphere() -> None:
    # Either side of the antimeridian: the middle is on it, not at the prime meridian.
    latitude, longitude = middle_of([(0.0, 179.0), (0.0, -179.0)])
    assert latitude == pytest.approx(0.0)
    assert abs(longitude) == pytest.approx(180.0)
    assert middle_of([(10.0, 20.0)]) == (10.0, 20.0)
    # Opposite places have no middle: the first stands for both.
    assert middle_of([(0.0, 0.0), (0.0, 180.0)]) == (0.0, 0.0)


def test_builds_a_group_file_parents_first_without_traces() -> None:
    taxa = parse_taxa(TAXA)
    found = tracks(
        [*parse_finds(FINDS), Find(number=99, max_ma=70, min_ma=66, paleolat=0, paleolng=0)],
        taxa,
    )
    built = tree_file(("dinosaurs", "Non-avian dinosaurs"), "Dinosauria", taxa, found, "2026-11-09")
    # Siblings oldest first: Tyrannosaurus (from 83.6 Ma) before Kurupi (from 72.2 Ma).
    assert built["names"] == [
        "Dinosauria",
        "Theropoda",
        "Tyrannosauridae",
        "Tyrannosaurus",
        "Kurupi",
    ]
    assert built["parent"] == [-1, 0, 1, 2, 2]
    # A group spans its kept members, not its own first and last finds.
    assert built["first"] == [83.6, 83.6, 83.6, 83.6, 72.2]
    assert built["last"] == [66.0, 66.0, 66.0, 66.0, 66.0]
    assert built["tracks"] == [[], [], [], [65, 51.0, -79.0, 2], [70, -25.0, -35.0, 1]]
    assert built["species"] == [0, 0, 0, 1, 0]
    assert built["rank"] == [13, 13, 8, 12, 12]
    assert built["pbdb"] == [1, 2, 3, 4, 8]


def test_a_group_missing_from_the_classification_is_an_error() -> None:
    with pytest.raises(ValueError, match="Mammalia"):
        _ = tree_file(("mammals", "Mammals"), "Mammalia", parse_taxa(TAXA), {}, "2026-11-09")
