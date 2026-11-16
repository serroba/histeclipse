"""Famous pictures by the space telescopes, for their cards (#798).

Each picture is taken from the telescope's European outreach site (ESA/Webb), which releases its
images under CC BY 4.0 with the credit each page gives. The file fetched is pinned by its
SHA-256, then made into a small square for the card's strip and a larger copy to open, both
served by the site itself: no reader's browser asks another host for them.

The words about each picture are the site's own, not the source's.
"""

import hashlib
import io
import json
import urllib.request
from dataclasses import dataclass
from typing import TYPE_CHECKING, TypedDict

from PIL import Image

if TYPE_CHECKING:
    from pathlib import Path

LICENCE = "CC BY 4.0"
LICENCE_URL = "https://creativecommons.org/licenses/by/4.0/"
#: The side of the square in a card's strip, shown at half this.
THUMB_SIZE = 192
#: The widest the copy to open is.
LARGE_WIDTH = 1280
WEBP_QUALITY = 80


@dataclass(frozen=True)
class Picture:
    """One picture: its id on the source's site, the file's hash, and what to say of it."""

    key: str
    sha256: str
    title: str
    #: When the source released it, ISO 8601.
    released: str
    #: What it shows, a line at a time, joined by spaces.
    about: tuple[str, ...]
    #: What it looks like, for a reader who cannot see it.
    alt: tuple[str, ...]
    credit: str


@dataclass(frozen=True)
class Telescope:
    """A telescope's pictures, and the site they come from."""

    #: The craft's id in GCAT, as the spacecraft record names it.
    craft: str
    name: str
    folder: str
    source: str
    #: Its pages (``{site}/images/{key}/``) and files (``{files}/{key}.jpg``).
    site: str
    files: str
    pictures: tuple[Picture, ...]


WEBB = Telescope(
    craft="D01093",
    name="James Webb Space Telescope",
    folder="webb",
    source="ESA/Webb",
    site="https://esawebb.org",
    files="https://cdn.esawebb.org/archives/images/screen",
    pictures=(
        Picture(
            "weic2209a",
            "72013769a15bff446c7bcbae7f60119bf16edb1ba9debb4bfa973f64eee87188",
            "Webb\u2019s First Deep Field",
            "2022-07-12",
            (
                "The galaxy cluster SMACS 0723, 4.6 billion light-years away, in a patch of sky",
                "the size of a grain of sand held at arm\u2019s length. The cluster\u2019s mass",
                "bends the light of far older galaxies behind it into arcs. Webb\u2019s first",
                "full-colour picture, from 12.5 hours of exposure.",
            ),
            (
                "Thousands of galaxies on a black sky, some stretched into thin orange arcs",
                "around a cluster of pale galaxies, with a few bright stars showing eight",
                "spikes.",
            ),
            "NASA, ESA, CSA, and STScI",
        ),
        Picture(
            "weic2205a",
            "e81782e0e673274464bc43c31545006212afcfec827f230e233d89f707a1c772",
            "The Cosmic Cliffs in Carina",
            "2022-07-12",
            (
                "The edge of a young star-forming region, NGC 3324, in the Carina Nebula, about",
                "7,600 light-years away. The light and winds of hot stars above the frame carve",
                "the cloud; its tallest peaks are about 7 light-years high. Infrared light",
                "shows stars the dust hides in visible light.",
            ),
            (
                "A ragged orange-brown wall of gas and dust like a mountain range, under a deep",
                "blue sky full of stars.",
            ),
            "NASA, ESA, CSA, and STScI",
        ),
        Picture(
            "weic2207b",
            "83086139de7693bbad0ff0f34ed03d0b83d615b3c7eaa4d42fc25d2b36169d4e",
            "The Southern Ring Nebula",
            "2022-07-12",
            (
                "NGC 3132, about 2,500 light-years away: shells of gas and dust thrown off by a",
                "dying star, here in near-infrared light. Of the two stars at its centre, the",
                "fainter made the nebula; Webb\u2019s mid-infrared camera showed it for the first",
                "time, wrapped in dust.",
            ),
            (
                "An oval nebula, pale blue within ragged rings of orange, a bright star at its",
                "centre, on a black sky.",
            ),
            "NASA, ESA, CSA, STScI, and the Webb ERO Production Team",
        ),
        Picture(
            "weic2208a",
            "ad65dd9ece1297a211b62142d416b9bde75fd45e101151dc0849c2e730898a6e",
            "Stephan\u2019s Quintet",
            "2022-07-12",
            (
                "Five galaxies close together on the sky. Four, about 290 million light-years",
                "away, pull at one another, trailing tails of gas and stars and driving a shock",
                "wave through the group; the fifth, on the left, is far nearer, at 40 million.",
                "A mosaic of more than 150 million pixels.",
            ),
            (
                "Five galaxies, four of them tangled together with red and gold clouds between",
                "them, against many faint distant galaxies.",
            ),
            "NASA, ESA, CSA, and STScI",
        ),
        Picture(
            "weic2216a",
            "6ca9cbfda29e7db094e100bce9d7b4cdb01ff7896248c02742539262fca101ad",
            "The Pillars of Creation",
            "2022-10-19",
            (
                "Columns of cool gas and dust in the Eagle Nebula, 6,500 light-years away, made",
                "famous by Hubble in 1995. In near-infrared light the pillars turn half",
                "transparent, and the newborn stars at their edges show: the red glow at their",
                "tips is from stars still forming.",
            ),
            (
                "Three tall brown and orange columns of dust rising against a blue field",
                "crowded with stars.",
            ),
            "NASA, ESA, CSA, STScI; J. DePasquale, A. Koekemoer, A. Pagan (STScI)",
        ),
        Picture(
            "potm2208a",
            "98158ddde060488b723fcd71e0354cde5dd880aacfd5e6f10ef5a012ac90c611",
            "The heart of the Phantom Galaxy",
            "2022-08-29",
            (
                "The spiral galaxy M74, about 32 million light-years away in Pisces, seen face",
                "on in mid-infrared light. Filaments of gas and dust wind out along its arms,",
                "and its centre, clear of gas, shows the cluster of stars at its core.",
            ),
            ("A spiral of fine grey and white filaments winding around a bright blue centre.",),
            "ESA/Webb, NASA & CSA, J. Lee and the PHANGS-JWST Team. Acknowledgement: J. Schmidt",
        ),
        Picture(
            "weic2211a",
            "8ce61fcfced27d8e81395369c4af994b9a4278ec88c5fd8c0aa455ab2491063e",
            "The Cartwheel Galaxy",
            "2022-08-02",
            (
                "A galaxy about 500 million light-years away in Sculptor, with two smaller",
                "companions. A smaller galaxy passed through its middle, and two rings spread",
                "from the collision like ripples on a pond; the outer ring has been growing for",
                "about 440 million years, forming stars as it goes.",
            ),
            (
                "A galaxy like a wheel, a bright hub joined by red spokes to a pink and blue",
                "rim, with two small galaxies to its left.",
            ),
            "NASA, ESA, CSA, STScI",
        ),
        Picture(
            "weic2214c",
            "be8791f14a0aac6423b8d9f6af97a22a04f00341df7c61d5ebb52144fa2332cb",
            "Neptune and its rings",
            "2022-09-21",
            (
                "Neptune in near-infrared light, where it is not blue: methane in its air",
                "absorbs that light, and only its high clouds of methane ice shine. The",
                "clearest view of its rings since Voyager 2 flew past in 1989.",
            ),
            (
                "A pale glowing globe with bright streaks of cloud, circled by thin faint rings",
                "and a few small moons.",
            ),
            "NASA, ESA, CSA, and STScI",
        ),
    ),
)

TELESCOPES = (WEBB,)


def page_url(telescope: Telescope, picture: Picture) -> str:
    """Give the picture's own page on the source's site."""
    return f"{telescope.site}/images/{picture.key}/"


def file_url(telescope: Telescope, picture: Picture) -> str:
    """Give the file fetched: the source's screen-sized copy."""
    return f"{telescope.files}/{picture.key}.jpg"


def verified(data: bytes, picture: Picture) -> bytes:
    """Return ``data`` if it is the file pinned for ``picture``."""
    digest = hashlib.sha256(data).hexdigest()
    if digest != picture.sha256:
        msg = f"{picture.key}: expected sha256 {picture.sha256}, got {digest}"
        raise ValueError(msg)
    return data


def _webp(image: Image.Image) -> bytes:
    out = io.BytesIO()
    image.save(out, format="WEBP", quality=WEBP_QUALITY, method=6)
    return out.getvalue()


def thumbnail(data: bytes) -> bytes:
    """Cut the middle square of a picture, ``THUMB_SIZE`` a side, as WebP."""
    with Image.open(io.BytesIO(data)) as image:
        rgb = image.convert("RGB")
    side = min(rgb.width, rgb.height)
    left, top = (rgb.width - side) // 2, (rgb.height - side) // 2
    square = rgb.crop((left, top, left + side, top + side))
    return _webp(square.resize((THUMB_SIZE, THUMB_SIZE), Image.Resampling.LANCZOS))


def large(data: bytes) -> tuple[bytes, int, int]:
    """Make a picture no wider than ``LARGE_WIDTH``, as WebP, with its width and height."""
    with Image.open(io.BytesIO(data)) as image:
        rgb = image.convert("RGB")
    if rgb.width > LARGE_WIDTH:
        height = round(rgb.height * LARGE_WIDTH / rgb.width)
        rgb = rgb.resize((LARGE_WIDTH, height), Image.Resampling.LANCZOS)
    return _webp(rgb), rgb.width, rgb.height


class PictureEntry(TypedDict):
    """One picture in the manifest."""

    key: str
    title: str
    released: str
    about: str
    alt: str
    credit: str
    page: str
    thumb: str
    large: str
    width: int
    height: int


class TelescopeEntry(TypedDict):
    """One telescope's pictures in the manifest."""

    name: str
    source: str
    licence: str
    licenceUrl: str
    pictures: list[PictureEntry]


class Manifest(TypedDict):
    """``telescope-pictures.json``: each telescope's pictures, by its craft's id."""

    schemaVersion: int
    telescopes: dict[str, TelescopeEntry]


def thumb_path(telescope: Telescope, picture: Picture) -> str:
    """Where a picture's square is served, from the site's root."""
    return f"pictures/{telescope.folder}/{picture.key}-thumb.webp"


def large_path(telescope: Telescope, picture: Picture) -> str:
    """Where a picture's larger copy is served, from the site's root."""
    return f"pictures/{telescope.folder}/{picture.key}.webp"


def manifest(sizes: dict[str, tuple[int, int]]) -> Manifest:
    """Describe every picture, given the width and height of each one's larger copy by key."""
    return {
        "schemaVersion": 1,
        "telescopes": {
            telescope.craft: {
                "name": telescope.name,
                "source": telescope.source,
                "licence": LICENCE,
                "licenceUrl": LICENCE_URL,
                "pictures": [
                    {
                        "key": picture.key,
                        "title": picture.title,
                        "released": picture.released,
                        "about": " ".join(picture.about),
                        "alt": " ".join(picture.alt),
                        "credit": picture.credit,
                        "page": page_url(telescope, picture),
                        "thumb": thumb_path(telescope, picture),
                        "large": large_path(telescope, picture),
                        "width": sizes[picture.key][0],
                        "height": sizes[picture.key][1],
                    }
                    for picture in telescope.pictures
                ],
            }
            for telescope in TELESCOPES
        },
    }


def _download(url: str) -> bytes:  # pragma: no cover - needs network access
    request = urllib.request.Request(url, headers={"User-Agent": "histeclipse-pipeline"})  # noqa: S310
    with urllib.request.urlopen(request, timeout=300) as response:  # noqa: S310  # pyright: ignore[reportAny]
        body: object = response.read()  # pyright: ignore[reportAny]
        if not isinstance(body, bytes):
            msg = f"{url}: expected bytes"
            raise TypeError(msg)
        return body


def fetch_pictures(public: Path, cache: Path) -> Manifest:  # pragma: no cover - needs network
    """Fetch every picture, write its square and larger copy, and write the manifest.

    Downloads are kept in ``cache``, so a second run only redoes the resizing.
    """
    cache.mkdir(parents=True, exist_ok=True)
    sizes: dict[str, tuple[int, int]] = {}
    for telescope in TELESCOPES:
        (public / "pictures" / telescope.folder).mkdir(parents=True, exist_ok=True)
        for picture in telescope.pictures:
            kept = cache / f"{picture.key}.jpg"
            if not kept.exists():
                _ = kept.write_bytes(_download(file_url(telescope, picture)))
            data = verified(kept.read_bytes(), picture)
            _ = (public / thumb_path(telescope, picture)).write_bytes(thumbnail(data))
            body, width, height = large(data)
            _ = (public / large_path(telescope, picture)).write_bytes(body)
            sizes[picture.key] = (width, height)
    result = manifest(sizes)
    path = public / "data" / "telescope-pictures.json"
    _ = path.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n")
    return result
