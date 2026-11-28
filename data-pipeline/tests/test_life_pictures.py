"""Tests for the stories' pictures: silhouettes from PhyloPic, pages from Wikipedia."""

import json
from typing import TYPE_CHECKING

from histeclipse_pipeline.life_pictures import (
    _everyday,  # pyright: ignore[reportPrivateUsage]
    _kept,  # pyright: ignore[reportPrivateUsage]
    _wiki_entry,  # pyright: ignore[reportPrivateUsage]
    pictures_file,
    silhouette,
    wanted,
    wikipedia,
    write_life_pictures,
)
from histeclipse_pipeline.pictures import Picture
from tests.json_values import read_json

if TYPE_CHECKING:
    from collections.abc import Callable
    from pathlib import Path

    from histeclipse_pipeline.sky import Json

CC0 = "https://creativecommons.org/publicdomain/zero/1.0/"
THUMBNAIL = "https://images.phylopic.org/images/u1/thumbnail/128x128.png"
PANTHERA: dict[str, Json] = {
    "src": THUMBNAIL,
    "of": "Panthera leo",
    "by": "A. Artist",
    "licence": "CC0 1.0",
    "licenceUrl": CC0,
    "page": "https://www.phylopic.org/images/u1",
}
LION = Picture(
    page="https://en.wikipedia.org/wiki/Panthera",
    src="https://upload.wikimedia.org/thumb/320px-Lion.jpg",
    width=320,
    height=240,
    artist="A. Photographer",
    licence="CC BY-SA 4.0",
    licence_url="https://creativecommons.org/licenses/by-sa/4.0",
    file_page="https://commons.wikimedia.org/wiki/File:Lion.jpg",
)
SUMMARIES: dict[str, object] = {
    "Baculites": {
        "description": "Extinct genus of ammonites",
        "content_urls": {"desktop": {"page": "https://en.wikipedia.org/wiki/Baculites"}},
    },
    "Paladin": {
        "description": "Warrior of Charlemagne's court",
        "content_urls": {"desktop": {"page": "https://en.wikipedia.org/wiki/Paladin"}},
    },
    "Paladin_%28genus%29": {
        "description": "Genus of trilobites",
        "content_urls": {"desktop": {"page": "https://en.wikipedia.org/wiki/Paladin_(genus)"}},
    },
    "Felidae": {
        "description": "Family of mammals",
        "content_urls": {"desktop": {"page": "https://en.wikipedia.org/wiki/Felidae"}},
    },
}


def site(finds: int, ma: int = 10) -> list[float | None]:
    return [ma, 0.0, 0.0, finds, 0, 20.0]


def stories(folder: Path) -> Path:
    """Write two groups' stories, and the two files beside them that are not stories."""
    cats = ["Panthera", "Smilodon", "Rare", "A", "B", "C", "D", "E"]
    mammals = {
        "id": "mammals",
        "names": ["Mammalia", "Felidae", "Canidae", *cats, "Canis"],
        "parent": [-1, 0, 0, *[1] * len(cats), 2],
        "sites": [
            [],
            [],
            [],
            # Two sites: their finds are summed.
            [*site(7), *site(5, 15)],
            site(10),
            site(9),
            *[site(1)] * 5,
            site(3),
        ],
    }
    dinosaurs = {
        "id": "dinosaurs",
        "names": ["Dinosauria", "Rex", "Scarce", "Panthera"],
        "parent": [-1, 0, 0, 0],
        "sites": [[], site(4), site(2), site(50)],
    }
    folder.mkdir(parents=True, exist_ok=True)
    _ = (folder / "mammals.json").write_text(json.dumps(mammals))
    _ = (folder / "dinosaurs.json").write_text(json.dumps(dinosaurs))
    _ = (folder / "pictures.json").write_text(json.dumps({"names": {}}))
    _ = (folder / "doors.json").write_text(json.dumps({"doors": []}))
    return folder


def node(
    title: str = "Panthera leo",
    *,
    licence: str = CC0,
    sizes: str = "128x128",
    uuid: str | None = "u1",
    by: tuple[str | None, str | None] = ("A. Artist", "C. Contributor"),
) -> dict[str, object]:
    """A PhyloPic node as its API embeds it, with its primary image (by: author, contributor)."""
    attribution, contributor = by
    links: dict[str, object] = {
        "nodes": [{"title": "Felis"}, {"title": title}],
        "thumbnailFiles": [
            {"sizes": "64x64", "href": "https://images.phylopic.org/small.png"},
            {"sizes": sizes, "href": THUMBNAIL},
        ],
        "license": {"href": licence},
    }
    if contributor is not None:
        links["contributor"] = {"title": contributor}
    image = {"uuid": uuid, "attribution": attribution, "_links": links}
    return {"_embedded": {"primaryImage": image}}


def answering(*nodes: dict[str, object]) -> tuple[list[str], Callable[[str], object]]:
    asked: list[str] = []

    def fetch(url: str) -> object:
        asked.append(url)
        return {"_embedded": {"items": list(nodes)}}

    return asked, fetch


def found(*nodes: dict[str, object]) -> dict[str, Json] | None:
    _, fetch = answering(*nodes)
    return silhouette("Panthera", fetch, 564)


def summaries(url: str) -> object:
    return SUMMARIES.get(url.rsplit("/", 1)[-1], {})


def test_lists_the_most_found_kinds_and_the_widest_lineages(tmp_path: Path) -> None:
    # A lineage with eight kinds or more comes first, then each kind with finds enough for its
    # group: 10 for the mammals, 3 for the dinosaurs. A name in two files is listed once.
    assert wanted(stories(tmp_path), set()) == [
        ("Mammalia", False),
        ("Felidae", False),
        ("Panthera", True),
        ("Smilodon", True),
        ("Rex", True),
    ]


def test_lists_every_name_an_everyday_word_finds(tmp_path: Path) -> None:
    names = wanted(stories(tmp_path), {"Canis", "Canidae", "Rare"})
    assert names == [
        ("Mammalia", False),
        ("Felidae", False),
        ("Canidae", False),
        ("Panthera", True),
        ("Smilodon", True),
        ("Rare", True),
        ("Rex", True),
        ("Canis", True),
    ]


def test_lists_every_kind_with_a_site_when_asked(tmp_path: Path) -> None:
    names = dict(wanted(stories(tmp_path), set(), every_kind=True))
    assert names == {
        "Mammalia": False,
        "Felidae": False,
        **dict.fromkeys(
            ["Panthera", "Smilodon", "Rare", "A", "B", "C", "D", "E", "Canis", "Rex", "Scarce"],
            True,
        ),
    }


def test_a_silhouette_of_the_name_or_of_a_species_in_it_is_kept() -> None:
    asked, fetch = answering(node())
    assert silhouette("Panthera", fetch, 564) == PANTHERA
    assert len(asked) == 1
    assert asked[0].startswith("https://api.phylopic.org/nodes?build=564&filter_name=panthera&")
    assert found(node("Panthera")) == {**PANTHERA, "of": "Panthera"}


def test_a_silhouette_of_another_taxon_is_not_kept() -> None:
    assert found(node("Pantherinae")) is None
    assert found(node("Felis catus")) is None
    assert found() is None
    assert silhouette("Panthera", lambda _: {}, 564) is None


def test_a_silhouette_needs_a_known_licence_a_thumbnail_and_an_address() -> None:
    assert found(node(licence="https://example.org/all-rights-reserved")) is None
    assert found(node(sizes="192x192")) is None
    assert found(node(uuid=None)) is None
    # A node with no picture is passed over for the next.
    assert found({"_embedded": {"primaryImage": None}}, {}, node()) == PANTHERA


def test_a_silhouette_is_credited_to_its_author_then_its_contributor() -> None:
    assert found(node(by=(None, "C. Contributor"))) == {**PANTHERA, "by": "C. Contributor"}
    assert found(node(by=(None, None))) == {**PANTHERA, "by": "unknown author"}


def test_a_genus_page_must_say_it_is_a_genus() -> None:
    assert wikipedia("Baculites", summaries, genus=True) == Picture(
        page="https://en.wikipedia.org/wiki/Baculites"
    )
    # A name that is also a word is tried again as "Name (genus)".
    assert wikipedia("Paladin", summaries, genus=True) == Picture(
        page="https://en.wikipedia.org/wiki/Paladin_(genus)"
    )
    assert wikipedia("Felidae", summaries, genus=True) is None
    assert wikipedia("Nosuchname", summaries, genus=True) is None


def test_a_lineage_page_is_kept_as_it_is_and_one_with_no_page_is_none() -> None:
    assert wikipedia("Felidae", summaries, genus=False) == Picture(
        page="https://en.wikipedia.org/wiki/Felidae"
    )
    assert wikipedia("Nosuchclade", summaries, genus=False) is None


def test_a_page_is_written_with_its_picture_if_it_has_a_free_one() -> None:
    assert _wiki_entry(None) is None
    assert _wiki_entry(Picture(page="https://en.wikipedia.org/wiki/Felidae")) == {
        "page": "https://en.wikipedia.org/wiki/Felidae",
        "image": None,
    }
    assert _wiki_entry(LION) == {
        "page": "https://en.wikipedia.org/wiki/Panthera",
        "image": {
            "src": "https://upload.wikimedia.org/thumb/320px-Lion.jpg",
            "width": 320,
            "height": 240,
            "artist": "A. Photographer",
            "licence": "CC BY-SA 4.0",
            "licenceUrl": "https://creativecommons.org/licenses/by-sa/4.0",
            "filePage": "https://commons.wikimedia.org/wiki/File:Lion.jpg",
        },
    }


def test_the_site_file_drops_names_with_neither_a_silhouette_nor_a_page() -> None:
    page = _wiki_entry(Picture(page="https://en.wikipedia.org/wiki/Smilodon"))
    built = pictures_file(
        {
            "Smilodon": {"silhouette": None, "wikipedia": page},
            "Panthera": {"silhouette": PANTHERA, "wikipedia": None},
            "Rare": {"silhouette": None, "wikipedia": None},
        },
        564,
        "2026-11-28",
    )
    assert (built["schemaVersion"], built["accessed"], built["phylopicBuild"]) == (
        1,
        "2026-11-28",
        564,
    )
    assert built["sources"] == ["phylopic", "wikimediaCommons"]
    assert "PhyloPic" in str(built["credit"])
    assert built["names"] == {
        "Panthera": {"silhouette": PANTHERA, "wikipedia": None},
        "Smilodon": {"silhouette": None, "wikipedia": page},
    }
    names = built["names"]
    assert isinstance(names, dict)
    assert list(names) == ["Panthera", "Smilodon"]


def test_reads_what_the_cache_keeps_a_later_answer_over_an_earlier(tmp_path: Path) -> None:
    assert _kept(tmp_path / "phylopic.jsonl") == {}
    lines = [
        {"name": "Panthera", "found": None},
        {"name": "Rare", "found": None},
        {"name": "Panthera", "found": PANTHERA},
    ]
    text = "\n\n".join(json.dumps(line) for line in lines) + "\n"
    _ = (tmp_path / "phylopic.jsonl").write_text(text)
    assert _kept(tmp_path / "phylopic.jsonl") == {"Panthera": PANTHERA, "Rare": None}


def test_reads_the_names_the_apps_everyday_words_find(tmp_path: Path) -> None:
    names_ts = tmp_path / "names.ts"
    lines = [
        "export const EVERYDAY = {",
        "  lion: 'Panthera',",
        "  'big cats':  'Panthera',",
        "  dog: 'Canis',",
        "  note: 'not a name',",
        "  lower: 'canis',",
        "};",
    ]
    _ = names_ts.write_text("\n".join(lines) + "\n")
    assert _everyday(names_ts) == {"Panthera", "Canis"}


def test_writes_the_site_file_from_the_cache(tmp_path: Path) -> None:
    cache = tmp_path / "cache"
    cache.mkdir()
    page = _wiki_entry(LION)
    _ = (cache / "phylopic.jsonl").write_text(
        json.dumps({"name": "Panthera", "found": PANTHERA})
        + "\n"
        + json.dumps({"name": "Rare", "found": None})
        + "\n"
    )
    _ = (cache / "wikipedia.jsonl").write_text(
        json.dumps({"name": "Panthera", "found": page})
        + "\n"
        + json.dumps({"name": "Smilodon", "found": page})
        + "\n"
    )
    _ = (cache / "phylopic-build.txt").write_text("564")
    out = tmp_path / "pictures.json"

    assert write_life_pictures(cache, out) == 1

    built = read_json(out)
    assert isinstance(built, dict)
    assert built["phylopicBuild"] == 564
    assert built["names"] == {
        "Panthera": {"silhouette": PANTHERA, "wikipedia": page},
        "Smilodon": {"silhouette": None, "wikipedia": page},
    }


def test_an_empty_cache_writes_a_file_with_no_names(tmp_path: Path) -> None:
    out = tmp_path / "pictures.json"
    assert write_life_pictures(tmp_path / "nothing", out) == 0
    built = read_json(out)
    assert isinstance(built, dict)
    assert (built["phylopicBuild"], built["names"]) == (0, {})
