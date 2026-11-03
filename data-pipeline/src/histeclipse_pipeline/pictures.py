"""Pictures for the cards: each Wikipedia page's lead image, with its author and licence.

For every ``"wikipedia"`` title a data file names, the page's summary (Wikipedia's REST API)
gives its address and lead image; when that image is on Wikimedia Commons (so freely
licensed, not a non-free file kept on Wikipedia alone), Commons gives a 320-pixel thumbnail
and the image's author, licence and file page. Only those are kept: no text is copied, and the
pictures are shown from Wikimedia, credited. Pages change, so nothing is pinned by checksum;
the file records when it was made.
"""

import datetime as dt
import html
import json
import re
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import TYPE_CHECKING, cast

if TYPE_CHECKING:
    from collections.abc import Callable
    from pathlib import Path

    from histeclipse_pipeline.sky import Json

SUMMARY = "https://en.wikipedia.org/api/rest_v1/page/summary/{title}"
COMMONS = (
    "https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo"
    "&iiprop=url|extmetadata&iiurlwidth=320&titles={file}"
)
#: Where Commons keeps its files, and its thumbnails (``thumb/a/ab/File.jpg/320px-File.jpg``).
COMMONS_UPLOADS = (
    "https://upload.wikimedia.org/wikipedia/commons/",
    "https://thumb.wikimedia.org/wikipedia/commons/",
)
USER_AGENT = "histeclipse-pipeline (https://github.com/serroba/histeclipse)"
THUMB_WIDTH = 320

type Fetch = Callable[[str], object]


@dataclass(frozen=True)
class Picture:
    """A page, and its lead image's thumbnail and credit when it has a free one."""

    page: str
    src: str | None = None
    width: int | None = None
    height: int | None = None
    artist: str | None = None
    licence: str | None = None
    licence_url: str | None = None
    file_page: str | None = None


def titles_in(data: object) -> list[str]:
    """Every ``"wikipedia"`` title a data file names, once each, in order."""
    found: list[str] = []

    def walk(value: object) -> None:
        if isinstance(value, dict):
            for key, item in cast("dict[str, object]", value).items():
                if key == "wikipedia" and isinstance(item, str) and item not in found:
                    found.append(item)
                else:
                    walk(item)
        elif isinstance(value, list):
            for item in cast("list[object]", value):
                walk(item)

    walk(data)
    return found


def plain(text: str) -> str:
    """Commons' metadata as plain text: tags dropped, entities read, spaces collapsed."""
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", text))).strip()


def commons_file(image_url: str) -> str | None:
    """Name an upload's Commons file; None for a file kept on Wikipedia alone."""
    path = image_url.split("?", 1)[0]
    base = next((base for base in COMMONS_UPLOADS if path.startswith(base)), None)
    if base is None:
        return None
    parts = path.removeprefix(base).split("/")
    # A thumbnail's address names its file before the thumbnail's own name.
    name = parts[3] if parts[0] == "thumb" and len(parts) > 4 else parts[-1]  # noqa: PLR2004
    return urllib.parse.unquote(name)


def _meta(metadata: dict[str, object], key: str) -> str | None:
    entry = metadata.get(key)
    if not isinstance(entry, dict):
        return None
    value = cast("dict[str, object]", entry).get("value")
    return plain(value) if isinstance(value, str) and value.strip() else None


def picture(title: str, fetch: Fetch) -> Picture:
    """Look a title up: its page, and its lead image when Commons has it with a licence."""
    summary = cast(
        "dict[str, object]",
        fetch(SUMMARY.format(title=urllib.parse.quote(title.replace(" ", "_")))),
    )
    urls = cast("dict[str, dict[str, str]]", summary.get("content_urls", {}))
    page = urls.get("desktop", {}).get("page")
    if page is None:
        msg = f"no Wikipedia page for {title!r}"
        raise ValueError(msg)
    original = cast("dict[str, object]", summary.get("originalimage") or {})
    source = original.get("source")
    file = commons_file(source) if isinstance(source, str) else None
    if file is None:
        return Picture(page=page)
    query = cast(
        "dict[str, dict[str, dict[str, dict[str, object]]]]",
        fetch(COMMONS.format(file=urllib.parse.quote(f"File:{file}"))),
    )
    pages = list(query["query"]["pages"].values())
    infos = cast("list[dict[str, object]]", pages[0].get("imageinfo", [])) if pages else []
    if not infos:
        return Picture(page=page)
    info = infos[0]
    metadata = cast("dict[str, object]", info.get("extmetadata", {}))
    licence = _meta(metadata, "LicenseShortName")
    if licence is None or "fair use" in licence.lower() or "non-free" in licence.lower():
        return Picture(page=page)
    return Picture(
        page=page,
        src=cast("str", info["thumburl"]),
        width=cast("int", info["thumbwidth"]),
        height=cast("int", info["thumbheight"]),
        artist=_meta(metadata, "Artist") or "unknown author",
        licence=licence,
        licence_url=_meta(metadata, "LicenseUrl"),
        file_page=cast("str", info["descriptionurl"]),
    )


def pictures_file(pictures: dict[str, Picture], made: str) -> dict[str, Json]:
    """Build the site's file: each title's page, and its picture where it has a free one."""
    return {
        "schemaVersion": 1,
        "credit": "Wikipedia and Wikimedia Commons; each picture by its author, under its licence",
        "made": made,
        "pictures": {
            title: {
                "page": found.page,
                "image": None
                if found.src is None
                else {
                    "src": found.src,
                    "width": found.width,
                    "height": found.height,
                    "artist": found.artist,
                    "licence": found.licence,
                    "licenceUrl": found.licence_url,
                    "filePage": found.file_page,
                },
            }
            for title, found in pictures.items()
        },
    }


def _fetch(url: str) -> object:  # pragma: no cover - needs network access
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})  # noqa: S310
    with urllib.request.urlopen(request, timeout=60) as response:  # noqa: S310  # pyright: ignore[reportAny]
        body: object = response.read()  # pyright: ignore[reportAny]
    if not isinstance(body, bytes):
        msg = f"{url}: expected bytes"
        raise TypeError(msg)
    time.sleep(0.5)  # Gently: Wikimedia's APIs are shared.
    return cast("object", json.loads(body))


def fetch_pictures(source: Path, path: Path) -> int:  # pragma: no cover - needs network access
    """Look up every title in ``source`` and write the pictures file."""
    titles = titles_in(cast("object", json.loads(source.read_text())))
    pictures = {title: picture(title, _fetch) for title in titles}
    made = dt.datetime.now(tz=dt.UTC).date().isoformat()
    path.parent.mkdir(parents=True, exist_ok=True)
    _ = path.write_text(
        json.dumps(pictures_file(pictures, made), separators=(",", ":"), ensure_ascii=False) + "\n"
    )
    return sum(1 for found in pictures.values() if found.src is not None)
