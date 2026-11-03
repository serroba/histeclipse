"""Tests for the cards' pictures from Wikipedia and Wikimedia Commons."""

import pytest

from histeclipse_pipeline.pictures import (
    Picture,
    commons_file,
    picture,
    pictures_file,
    plain,
    titles_in,
)

SUMMARIES: dict[str, object] = {
    "Jebel_Irhoud": {
        "content_urls": {"desktop": {"page": "https://en.wikipedia.org/wiki/Jebel_Irhoud"}},
        "originalimage": {
            "source": "https://upload.wikimedia.org/wikipedia/commons/3/3a/Hublin_at_Jebel_Irhoud.jpg?utm_source=x"
        },
    },
    "Apidima_Cave": {
        "content_urls": {"desktop": {"page": "https://en.wikipedia.org/wiki/Apidima_Cave"}}
    },
    "A_logo": {
        "content_urls": {"desktop": {"page": "https://en.wikipedia.org/wiki/A_logo"}},
        "originalimage": {"source": "https://upload.wikimedia.org/wikipedia/en/1/1a/Logo.png"},
    },
    "Unlicensed": {
        "content_urls": {"desktop": {"page": "https://en.wikipedia.org/wiki/Unlicensed"}},
        "originalimage": {"source": "https://upload.wikimedia.org/wikipedia/commons/a/ab/Odd.jpg"},
    },
    "Missing": {"type": "https://mediawiki.org/wiki/HyperSwitch/errors/not_found"},
    "Baculites": {
        "description": "Extinct genus of ammonites",
        "content_urls": {"desktop": {"page": "https://en.wikipedia.org/wiki/Baculites"}},
    },
    "Paladin": {
        "description": "Warrior of Charlemagne's court",
        "content_urls": {"desktop": {"page": "https://en.wikipedia.org/wiki/Paladin"}},
    },
}

COMMONS: dict[str, object] = {
    "File%3AHublin_at_Jebel_Irhoud.jpg": {
        "query": {
            "pages": {
                "1": {
                    "imageinfo": [
                        {
                            "thumburl": "https://upload.wikimedia.org/thumb/320px-Hublin.jpg",
                            "thumbwidth": 320,
                            "thumbheight": 240,
                            "descriptionurl": "https://commons.wikimedia.org/wiki/File:Hublin.jpg",
                            "extmetadata": {
                                "Artist": {"value": '<a href="//x">Jean-Jacques&nbsp;Hublin</a>'},
                                "LicenseShortName": {"value": "CC BY-SA 4.0"},
                                "LicenseUrl": {
                                    "value": "https://creativecommons.org/licenses/by-sa/4.0"
                                },
                            },
                        }
                    ]
                }
            }
        }
    },
    "File%3AOdd.jpg": {"query": {"pages": {"1": {"imageinfo": [{"extmetadata": {}}]}}}},
}


def looked_up(title: str) -> Picture:
    found = picture(title, fetch)
    assert found is not None
    return found


def fetch(url: str) -> object:
    key = url.rsplit("/", 1)[-1] if "summary" in url else url.rsplit("titles=", 1)[-1]
    return SUMMARIES.get(key) if "summary" in url else COMMONS.get(key, {"query": {"pages": {}}})


def test_finds_each_title_a_data_file_names_once() -> None:
    data = {
        "claims": [
            {"id": "a", "wikipedia": "Jebel Irhoud"},
            {"id": "b", "place": {"wikipedia": "Apidima Cave"}},
            {"id": "c", "wikipedia": "Jebel Irhoud"},
        ]
    }
    assert titles_in(data) == ["Jebel Irhoud", "Apidima Cave"]
    assert titles_in({"wikipedia": ["Baculites", "Paladin"], "x": {"wikipedia": "Baculites"}}) == [
        "Baculites",
        "Paladin",
    ]


def test_a_page_that_must_say_genus_is_skipped_when_it_is_about_something_else() -> None:
    assert picture("Baculites", fetch, "genus") == Picture(
        page="https://en.wikipedia.org/wiki/Baculites"
    )
    assert picture("Paladin", fetch, "genus") is None
    assert picture("Missing", fetch, "genus") is None


def test_reads_commons_metadata_as_plain_text() -> None:
    assert plain('<a href="//x">Jean-Jacques&nbsp;Hublin</a>\n ') == "Jean-Jacques Hublin"


def test_knows_a_commons_file_from_one_kept_on_wikipedia_alone() -> None:
    assert (
        commons_file("https://upload.wikimedia.org/wikipedia/commons/3/3a/A%20b.jpg?x") == "A b.jpg"
    )
    assert commons_file("https://upload.wikimedia.org/wikipedia/en/1/1a/Logo.png") is None
    thumbnail = (
        "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7b/Tracks.jpg/3840px-Tracks.jpg"
    )
    assert commons_file(thumbnail) == "Tracks.jpg"


def test_a_page_with_a_free_lead_image_gets_its_thumbnail_and_credit() -> None:
    assert looked_up("Jebel Irhoud") == Picture(
        page="https://en.wikipedia.org/wiki/Jebel_Irhoud",
        src="https://upload.wikimedia.org/thumb/320px-Hublin.jpg",
        width=320,
        height=240,
        artist="Jean-Jacques Hublin",
        licence="CC BY-SA 4.0",
        licence_url="https://creativecommons.org/licenses/by-sa/4.0",
        file_page="https://commons.wikimedia.org/wiki/File:Hublin.jpg",
    )


def test_a_page_without_a_free_image_keeps_its_link_only() -> None:
    for title in ("Apidima Cave", "A logo", "Unlicensed"):
        found = looked_up(title)
        assert found.src is None
        assert found.page.startswith("https://en.wikipedia.org/wiki/")


def test_a_title_with_no_page_is_an_error() -> None:
    with pytest.raises(ValueError, match="no Wikipedia page for 'Missing'"):
        _ = picture("Missing", fetch)


def test_the_site_file_has_each_page_and_its_picture_if_any() -> None:
    data = pictures_file(
        {
            "Jebel Irhoud": looked_up("Jebel Irhoud"),
            "Apidima Cave": looked_up("Apidima Cave"),
        },
        "2026-11-04",
    )
    assert data["made"] == "2026-11-04"
    assert data["pictures"] == {
        "Jebel Irhoud": {
            "page": "https://en.wikipedia.org/wiki/Jebel_Irhoud",
            "image": {
                "src": "https://upload.wikimedia.org/thumb/320px-Hublin.jpg",
                "width": 320,
                "height": 240,
                "artist": "Jean-Jacques Hublin",
                "licence": "CC BY-SA 4.0",
                "licenceUrl": "https://creativecommons.org/licenses/by-sa/4.0",
                "filePage": "https://commons.wikimedia.org/wiki/File:Hublin.jpg",
            },
        },
        "Apidima Cave": {"page": "https://en.wikipedia.org/wiki/Apidima_Cave", "image": None},
    }
