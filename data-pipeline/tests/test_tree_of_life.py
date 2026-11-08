"""The tree of life, trimmed from Open Tree of Life's synthetic tree and taxonomy."""

from __future__ import annotations

import io
import tarfile
from typing import TYPE_CHECKING

import pytest

from histeclipse_pipeline.tree_of_life import (
    EXTINCT,
    PHYLOGENY,
    TAXONOMY_ONLY,
    Taxon,
    genus_names,
    match_genera,
    member,
    node_flags,
    ott_of,
    parse_newick,
    parse_taxonomy,
    supported_labels,
    tree_file,
    trim,
)
from tests.json_values import json_round_trip

if TYPE_CHECKING:
    from pathlib import Path

HEADER = "uid\t|\tparent_uid\t|\tname\t|\trank\t|\tsourceinfo\t|\tuniqname\t|\tflags\t|\t\n"
ROWS = [
    (1, "", "life", "no rank", ""),
    (2, "1", "Animalia", "kingdom", ""),
    (3, "2", "Chordata", "phylum", ""),
    (4, "3", "Mammalia", "class", ""),
    (5, "4", "Primates", "order", ""),
    (6, "5", "Homo", "genus", "extinct_inherited,sibling_higher"),
    (7, "6", "Homo sapiens", "species", ""),
    (8, "2", "Arthropoda", "phylum", ""),
    (9, "8", "Trilobita", "no rank", "extinct,incertae_sedis"),
    (10, "9", "Olenidae", "family", "extinct"),
    (11, "10", "Olenus", "no rank", "extinct,incertae_sedis"),
    (12, "9", "Paradoxides", "no rank", "extinct"),
    # A namesake outside the fossil groups' clades, not to be matched.
    (13, "2", "Olenus", "genus", ""),
    (14, "9", "Dupla", "no rank", "extinct"),
    (15, "10", "Dupla", "no rank", "extinct"),
    (16, "4", "Rodentia", "order", ""),
    (17, "16", "Mus", "genus", ""),
]
TAXONOMY = HEADER + "".join(
    f"{uid}\t|\t{parent}\t|\t{name}\t|\t{rank}\t|\tsource:{uid}\t|\t\t|\t{flags}\t|\t\n"
    for uid, parent, name, rank, flags in ROWS
)
# life > Animalia > (Chordata > Mammalia > (Primates > Homo > H. sapiens, Rodentia > Mus),
# Arthropoda); the synthesis joins primates and rodents at an unnamed branch point, and has
# another above the rodents alone, which trimming drops.
PRIMATES = "((ott7)ott6)ott5"
RODENTS = "((ott17)ott16)mrcaott16ott17"
MAMMALS = f"(({PRIMATES},{RODENTS})mrcaott7ott17)ott4"
NEWICK = f"((({MAMMALS})ott3,ott8)ott2)ott1;"


def test_reads_the_taxonomy_rows_and_flags() -> None:
    taxa = parse_taxonomy(TAXONOMY.splitlines(keepends=True))
    assert len(taxa) == len(ROWS)
    assert taxa[1].parent == 0
    assert taxa[9].name == "Trilobita"
    assert taxa[9].flags == {"extinct", "incertae_sedis"}
    assert taxa[7].flags == frozenset()


def test_reads_a_newick_tree_with_labels_on_inner_nodes() -> None:
    tree = parse_newick("((a, b)ab,c)root;\n")
    assert tree.labels == ["root", "ab", "a", "b", "c"]
    assert tree.parents == [-1, 0, 1, 1, 0]
    with pytest.raises(ValueError, match="close"):
        _ = parse_newick("((a,b)ab")


def test_tells_a_taxon_from_a_branch_point() -> None:
    assert ott_of("ott770315") == 770315
    assert ott_of("mrcaott1ott2") is None
    assert ott_of(None) is None


def test_matches_genera_within_the_fossil_clades_only() -> None:
    taxa = parse_taxonomy(TAXONOMY.splitlines())
    matches = match_genera(["Olenus", "Paradoxides", "Dupla", "Nowhere"], taxa, [9, 4])
    assert matches.found == {"Olenus": 11, "Paradoxides": 12}
    assert matches.ambiguous == ["Dupla"]
    assert matches.missing == ["Nowhere"]


def test_trims_to_the_backbone_and_hangs_off_tree_genera_by_the_taxonomy() -> None:
    taxa = parse_taxonomy(TAXONOMY.splitlines())
    tree = parse_newick(NEWICK)
    # 99 is in neither the tree nor the taxonomy: it is left out.
    wanted = [11, 12, 9, 4, 7, 99]
    nodes, landed = trim(tree, taxa, frozenset({"mrcaott7ott17", "ott4"}), wanted)
    assert 99 not in landed
    names = [node.name for node in nodes]
    # Mus is neither wanted nor backbone; every kept node comes after its parent.
    assert "Mus" not in names
    assert all(node.parent < i for i, node in enumerate(nodes))
    assert nodes[0].name == "life"
    by_name = {node.name or "(branch point)": node for node in nodes}
    assert set(by_name) == {
        "life",
        "Animalia",
        "Chordata",
        "Mammalia",
        "(branch point)",
        "Primates",
        "Homo",
        "Homo sapiens",
        "Rodentia",
        "Arthropoda",
        "Trilobita",
        "Olenidae",
        "Olenus",
        "Paradoxides",
    }

    def parent_name(name: str) -> str:
        return nodes[by_name[name].parent].name

    assert parent_name("Trilobita") == "Arthropoda"
    assert parent_name("Olenus") == "Olenidae"
    assert parent_name("Paradoxides") == "Trilobita"
    assert parent_name("Primates") == ""
    assert parent_name("Rodentia") == ""
    assert by_name["(branch point)"].flags == PHYLOGENY
    assert by_name["Mammalia"].flags == PHYLOGENY
    assert by_name["Olenus"].flags == EXTINCT | TAXONOMY_ONLY
    assert by_name["Homo"].flags == EXTINCT  # as the taxonomy flags it, inherited
    assert by_name["Homo sapiens"].flags == 0
    assert nodes[landed[11]].name == "Olenus"
    assert nodes[landed[7]].name == "Homo sapiens"


def test_writes_columns_and_where_the_sites_taxa_are() -> None:
    taxa = parse_taxonomy(TAXONOMY.splitlines())
    nodes, landed = trim(parse_newick(NEWICK), taxa, frozenset(), [11, 12, 9, 4, 7])
    matches = match_genera(["Olenus", "Paradoxides", "Dupla"], taxa, [9, 4])
    built = tree_file(
        nodes,
        landed,
        genera=matches,
        groups={"trilobites": 9},
        humans={"sapiens": 7, "lost": 99},
        accessed="2026-11-08",
    )
    assert json_round_trip(built) == built
    names = built["name"]
    assert isinstance(names, list)
    assert len(names) == len(nodes)
    ours = built["ours"]
    assert isinstance(ours, dict)
    assert ours["fossilGenera"] == {"Olenus": landed[11], "Paradoxides": landed[12]}
    assert ours["fossilGroups"] == {"trilobites": landed[9]}
    assert ours["humans"] == {"sapiens": landed[7]}
    assert built["unmatched"] == {"ambiguous": ["Dupla"], "missing": []}
    ranks = built["ranks"]
    assert isinstance(ranks, list)
    names_of_ranks = [str(rank) for rank in ranks]
    assert names_of_ranks == sorted(names_of_ranks)


def test_reads_which_nodes_phylogenies_support() -> None:
    annotations: dict[str, dict[str, dict[str, dict[str, str]]]] = {
        "nodes": {"ott4": {"supported_by": {"s@t": "n"}}, "ott5": {"terminal": {"s@t": "n"}}}
    }
    assert supported_labels(annotations) == {"ott4"}
    with pytest.raises(TypeError, match="object"):
        _ = supported_labels([])
    with pytest.raises(TypeError, match="nodes"):
        _ = supported_labels({})


def test_reads_the_fossil_files_genus_names() -> None:
    assert genus_names({"genera": ["Olenus", "Paradoxides"]}) == ["Olenus", "Paradoxides"]
    with pytest.raises(TypeError, match="object"):
        _ = genus_names([])
    with pytest.raises(TypeError, match="genus names"):
        _ = genus_names({"genera": [1]})


def test_reads_a_file_inside_an_archive(tmp_path: Path) -> None:
    path = tmp_path / "release.tgz"
    with tarfile.open(path, "w:gz") as archive:
        data = b"(a,b)ab;"
        info = tarfile.TarInfo("release/tree.tre")
        info.size = len(data)
        archive.addfile(info, io.BytesIO(data))
        archive.addfile(tarfile.TarInfo("release/folder"), None)
    with tarfile.open(path, "r:gz") as archive:
        assert member(archive, "release/tree.tre").read() == data
        archive.getmember("release/folder").type = tarfile.DIRTYPE
        with pytest.raises(ValueError, match="not a file"):
            _ = member(archive, "release/folder")


def test_keeps_our_species_living_though_the_taxonomy_flags_it_extinct() -> None:
    flagged = Taxon(parent=1, name="Homo sapiens", rank="species", flags=frozenset({"extinct"}))
    neanderthal = Taxon(
        parent=1, name="H. s. neanderthalensis", rank="no rank", flags=frozenset({"extinct"})
    )
    assert node_flags(770315, flagged, supported=True, taxonomy_only=False) & EXTINCT == 0
    assert node_flags(83926, neanderthal, supported=False, taxonomy_only=False) & EXTINCT
