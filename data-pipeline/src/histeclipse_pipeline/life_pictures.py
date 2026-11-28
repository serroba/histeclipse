"""Pictures for the animals' stories: a silhouette from PhyloPic, a picture and page from Wikipedia.

A prototype. For the kinds and lineages a story is most often told of (see `wanted`), two
things are looked up, each kept with its author and licence and shown from where it lives:

- PhyloPic (https://www.phylopic.org): a silhouette of the animal, by a named contributor under
  a Creative Commons licence or dedication. Asked by name; a node's picture is kept only when
  it is of that name or of a species in it, so a kind is not shown as its nearest pictured
  relative. Which taxon the silhouette is of is kept and said.
- Wikipedia and Wikimedia Commons, as `pictures` does it: the page, and its lead image when
  Commons has it under a free licence. A genus's page must describe itself as a genus (its
  title is tried again with "(genus)", for names that are also words).

Both grow and change, so nothing is pinned by checksum: the file records when it was made and
PhyloPic's build. Answers are kept in a cache folder as they come, so a run that stops goes on
from where it was.
"""

import datetime as dt
import json
import re
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from typing import TYPE_CHECKING, TextIO, cast

from histeclipse_pipeline.pictures import USER_AGENT, Picture, picture, wikimedia_fetch

if TYPE_CHECKING:
    from collections.abc import Callable
    from pathlib import Path

    from histeclipse_pipeline.sky import Json

PHYLOPIC = "https://api.phylopic.org"
PHYLOPIC_PAGE = "https://www.phylopic.org/images/{uuid}"
#: A kind with this many finds or more is looked up, by group; so is every name a reader's
#: everyday word finds, and every lineage with `CLADE_KINDS` kinds or more.
ENOUGH_FINDS = {"mammals": 10, "dinosaurs": 3}
CLADE_KINDS = 8
#: How many lookups run at once: few, as both services are shared.
WORKERS = 4
LICENCES = {
    "https://creativecommons.org/publicdomain/zero/1.0/": "CC0 1.0",
    "https://creativecommons.org/publicdomain/mark/1.0/": "Public domain",
    "https://creativecommons.org/licenses/by/3.0/": "CC BY 3.0",
    "https://creativecommons.org/licenses/by/4.0/": "CC BY 4.0",
    "https://creativecommons.org/licenses/by-sa/3.0/": "CC BY-SA 3.0",
    "https://creativecommons.org/licenses/by-sa/4.0/": "CC BY-SA 4.0",
    "https://creativecommons.org/licenses/by-nc/3.0/": "CC BY-NC 3.0",
    "https://creativecommons.org/licenses/by-nc-sa/3.0/": "CC BY-NC-SA 3.0",
}

type Fetch = Callable[[str], object]


def wanted(
    stories: Path, everyday: set[str], *, every_kind: bool = False
) -> list[tuple[str, bool]]:
    """List the names to look up, each with whether it is a genus, the most found first.

    With `every_kind`, every genus with a site, however few its finds: PhyloPic answers fast
    enough for that, and a story names its rarest kinds as it does its commonest.
    """
    names: dict[str, tuple[bool, int]] = {}
    for path in sorted(stories.glob("*.json")):
        if path.name == "pictures.json":
            continue
        file = json.loads(path.read_text())
        enough = 1 if every_kind else ENOUGH_FINDS.get(file["id"], 10)
        kinds = [0] * len(file["names"])
        for index in range(len(file["names"]) - 1, -1, -1):
            sites: list[float] = file["sites"][index]
            finds = int(sum(sites[3::6]))
            if sites:
                kinds[index] += 1
            parent: int = file["parent"][index]
            if parent >= 0:
                kinds[parent] += kinds[index]
            name: str = file["names"][index]
            genus = bool(sites)
            keep = name in everyday or (finds >= enough if genus else kinds[index] >= CLADE_KINDS)
            if keep and name not in names:
                names[name] = (genus, finds if genus else 10_000 + kinds[index])
    return [
        (name, genus) for name, (genus, _) in sorted(names.items(), key=lambda each: -each[1][1])
    ]


def silhouette(name: str, fetch: Fetch, build: int) -> dict[str, Json] | None:
    """Look a name up on PhyloPic: its silhouette, if one is of it or of a species in it."""
    query = urllib.parse.urlencode(
        {
            "build": build,
            "filter_name": name.lower(),
            "embed_items": "true",
            "embed_primaryImage": "true",
            "page": 0,
        }
    )
    answer = cast("dict[str, object]", fetch(f"{PHYLOPIC}/nodes?{query}"))
    embedded = cast("dict[str, object]", answer.get("_embedded") or {})
    for item in cast("list[dict[str, object]]", embedded.get("items") or []):
        image = cast("dict[str, object]", item.get("_embedded") or {}).get("primaryImage")
        if not isinstance(image, dict):
            continue
        links = cast("dict[str, object]", cast("dict[str, object]", image).get("_links") or {})
        titles = [
            str(node.get("title", ""))
            for node in cast("list[dict[str, object]]", links.get("nodes") or [])
        ]
        of = next((title for title in titles if title == name or title.startswith(name + " ")), None)
        thumbnails = cast("list[dict[str, str]]", links.get("thumbnailFiles") or [])
        thumbnail = next((each for each in thumbnails if each.get("sizes") == "128x128"), None)
        licence_url = cast("dict[str, str]", links.get("license") or {}).get("href", "")
        uuid = cast("dict[str, object]", image).get("uuid")
        if of is None or thumbnail is None or licence_url not in LICENCES or not isinstance(uuid, str):
            continue
        contributor = cast("dict[str, str]", links.get("contributor") or {}).get("title")
        by = cast("dict[str, object]", image).get("attribution") or contributor
        return {
            "src": thumbnail["href"],
            "of": of,
            "by": str(by) if by else "unknown author",
            "licence": LICENCES[licence_url],
            "licenceUrl": licence_url,
            "page": PHYLOPIC_PAGE.format(uuid=uuid),
        }
    return None


def wikipedia(name: str, genus: bool, fetch: Fetch) -> Picture | None:
    """Look a name up on Wikipedia: its page, and its lead picture where Commons has it free."""
    if not genus:
        try:
            return picture(name, fetch)
        except ValueError:
            return None
    return picture(name, fetch, "genus") or picture(f"{name} (genus)", fetch, "genus")


def pictures_file(found: dict[str, dict[str, Json]], build: int, made: str) -> dict[str, Json]:
    """Build the site's file: each name's silhouette and Wikipedia page, where it has either."""
    return {
        "schemaVersion": 1,
        "credit": (
            "Silhouettes from PhyloPic (phylopic.org), each by its contributor under its "
            "licence; pages and pictures from Wikipedia and Wikimedia Commons, each picture by "
            "its author under its licence"
        ),
        "made": made,
        "phylopicBuild": build,
        "names": {
            name: entry
            for name, entry in sorted(found.items())
            if entry.get("silhouette") is not None or entry.get("wikipedia") is not None
        },
    }


def _wiki_entry(found: Picture | None) -> Json:
    if found is None:
        return None
    return {
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


def _fetch(url: str) -> object:  # pragma: no cover - needs network access
    request = urllib.request.Request(  # noqa: S310
        url, headers={"User-Agent": USER_AGENT, "Accept": "application/vnd.phylopic.v2+json"}
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:  # noqa: S310  # pyright: ignore[reportAny]
            body: object = response.read()  # pyright: ignore[reportAny]
    except urllib.error.HTTPError as error:
        if error.code in {400, 404}:
            time.sleep(0.2)
            # A refusal still says which build is current.
            try:
                return cast("object", json.loads(error.read()))
            except ValueError:
                return {}
        raise
    time.sleep(0.2)  # Gently: a volunteer's service.
    return cast("object", json.loads(cast("bytes", body)))


def _kept(path: Path) -> dict[str, Json]:
    if not path.exists():
        return {}
    return {
        row["name"]: row["found"]
        for row in (json.loads(line) for line in path.read_text().splitlines() if line.strip())
    }


def _everyday(names_ts: Path) -> set[str]:
    """The genera and lineages the app's everyday names find (`features/life/names.ts`)."""
    return set(re.findall(r":\s*'([A-Z][a-z]+)'", names_ts.read_text()))


def fetch_life_pictures(  # pragma: no cover - needs network access
    stories: Path, names_ts: Path, cache: Path, which: str
) -> int:
    """Look up what is not yet in the cache from one source (`phylopic` or `wikipedia`)."""
    cache.mkdir(parents=True, exist_ok=True)
    path = cache / f"{which}.jsonl"
    kept = _kept(path)
    known = _everyday(names_ts)
    names = wanted(stories, known, every_kind=which == "phylopic")
    build = 0
    if which == "phylopic":
        root = cast("dict[str, object]", _fetch(f"{PHYLOPIC}/nodes?build=0"))
        build = int(cast("int", root.get("build", 0)))
        _ = (cache / "phylopic-build.txt").write_text(str(build))
    lock = threading.Lock()
    done = 0

    def look(each: tuple[str, bool], out: TextIO) -> None:
        nonlocal done
        name, genus = each
        try:
            found: Json = (
                silhouette(name, _fetch, build)
                if which == "phylopic"
                else _wiki_entry(wikipedia(name, genus, wikimedia_fetch))
            )
        except (urllib.error.URLError, TimeoutError, ValueError, KeyError) as error:
            print(f"{which} {name}: {error}", flush=True)  # noqa: T201
            return
        with lock:
            _ = out.write(json.dumps({"name": name, "found": found}, ensure_ascii=False) + "\n")
            out.flush()
            done += 1
            if done % 50 == 0:
                print(f"{which} {done}/{len(todo)} {name}", flush=True)  # noqa: T201

    # The names a reader's everyday word finds first, then the rest, the most found first.
    todo = sorted(
        (each for each in names if each[0] not in kept), key=lambda each: each[0] not in known
    )
    with path.open("a") as out, ThreadPoolExecutor(WORKERS) as pool:
        _ = list(pool.map(lambda each: look(each, out), todo))
    return len(names)


def write_life_pictures(cache: Path, out: Path) -> int:
    """Write the site's file from what the cache holds; count the names with a silhouette."""
    silhouettes = _kept(cache / "phylopic.jsonl")
    pages = _kept(cache / "wikipedia.jsonl")
    build_file = cache / "phylopic-build.txt"
    build = int(build_file.read_text()) if build_file.exists() else 0
    found: dict[str, dict[str, Json]] = {
        name: {"silhouette": silhouettes.get(name), "wikipedia": pages.get(name)}
        for name in sorted(set(silhouettes) | set(pages))
    }
    made = dt.datetime.now(tz=dt.UTC).date().isoformat()
    _ = out.write_text(
        json.dumps(pictures_file(found, build, made), separators=(",", ":"), ensure_ascii=False)
        + "\n"
    )
    return sum(1 for entry in found.values() if entry["silhouette"] is not None)
