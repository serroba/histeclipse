"""Famous pictures by the space telescopes, for their cards (#798).

Each picture is taken from the telescope's European outreach site (ESA/Webb, ESA/Hubble), which
releases its images under CC BY 4.0 with the credit each page gives. The file fetched is pinned
by its SHA-256, then made into a small square for the card's strip and a larger copy to open,
both served by the site itself: no reader's browser asks another host for them.

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

HUBBLE = Telescope(
    craft="S20580",
    name="Hubble Space Telescope",
    folder="hubble",
    source="ESA/Hubble",
    site="https://esahubble.org",
    files="https://cdn.esahubble.org/archives/images/screen",
    pictures=(
        Picture(
            "heic0611b",
            "0411989cfab25239ea46087a38d4dc64d1c0bc71624900b654693c4ce9548411",
            "The Hubble Ultra Deep Field",
            "2006-09-21",
            (
                "Nearly 10,000 galaxies in a patch of sky in Fornax a tenth as wide as the full",
                "Moon, from about a million seconds of exposure over 400 orbits in 2003 and",
                "2004. The faintest and reddest are seen as they were when the universe was",
                "less than a billion years old.",
            ),
            (
                "A black sky crowded with small galaxies of every shape, white, blue, orange",
                "and red, the smallest only faint specks.",
            ),
            "NASA, ESA, and S. Beckwith (STScI) and the HUDF Team",
        ),
        Picture(
            "heic1501a",
            "285e1f921b1fc258f48532e83dcfd30a7f9bcc704e1af9b0fa2c6468e31bc39d",
            "The Pillars of Creation",
            "2015-01-05",
            (
                "Columns of cold gas and dust in the Eagle Nebula (M16), about 6,500",
                "light-years away, the tallest some four light-years high. Stars form inside",
                "them while the light of young stars nearby wears them away. Hubble first",
                "pictured them in 1995; this sharper, wider view in visible light was taken in",
                "2014.",
            ),
            (
                "Three dark brown towers of dust with glowing edges, rising against a",
                "blue-green haze and a few bright stars.",
            ),
            "NASA, ESA/Hubble and the Hubble Heritage Team",
        ),
        Picture(
            "heic0601a",
            "545d43079d936bbce3ad3dac33145992b504327e74db8f30dd92b8da538d6aec",
            "The Orion Nebula",
            "2006-01-11",
            (
                "The nearest large region where stars are being born, about 1,500 light-years",
                "away, with more than 3,000 stars in view. The four massive stars of the",
                "Trapezium, at its bright heart, have hollowed out the cloud with their light.",
                "A mosaic taken over 105 orbits.",
            ),
            (
                "Billowing clouds of pink, red and brown gas around a bright white hollow,",
                "sprinkled with stars.",
            ),
            (
                "NASA, ESA, M. Robberto (Space Telescope Science Institute/ESA) and the Hubble"
                " Space Telescope Orion Treasury Project Team"
            ),
        ),
        Picture(
            "heic0515a",
            "9b9162b9a679c04fe9224dd3338691fa1eb56599e111ebd750f6eafe9d028bdc",
            "The Crab Nebula",
            "2005-12-01",
            (
                "What is left of a star whose explosion Chinese and Japanese astronomers",
                "recorded in 1054: threads of gas six light-years across, still flying",
                "outward, and at the centre a neutron star turning 30 times a second. About",
                "6,500 light-years away; a mosaic of 24 exposures.",
            ),
            (
                "An oval cloud of tangled orange and green threads around a blue-white glow,",
                "on a black sky.",
            ),
            (
                "NASA, ESA and Allison Loll/Jeff Hester (Arizona State University)."
                " Acknowledgement: Davide De Martin (ESA/Hubble)"
            ),
        ),
        Picture(
            "heic0506a",
            "626f7d6ba30d186a87b834c089b449e3b77c8defce4fe85ab7edf2078e3633e2",
            "The Whirlpool Galaxy",
            "2005-04-25",
            (
                "The spiral galaxy M51 and its small companion NGC 5195, about 31 million",
                "light-years away. The companion\u2019s pull, as it passes behind, is thought to",
                "sharpen the spiral arms, pink where new stars are forming. Released for",
                "Hubble\u2019s fifteenth year in orbit.",
            ),
            (
                "A face-on spiral galaxy with two long arms dotted pink and blue, one arm",
                "reaching to a smaller yellow galaxy at the right.",
            ),
            "NASA, ESA, S. Beckwith (STScI), and The Hubble Heritage Team (STScI/AURA)",
        ),
        Picture(
            "opo0328a",
            "f1af80a18a7d4d584ab4c58d85da035a3c4d599932e9e8566446d1e6a0345e56",
            "The Sombrero Galaxy",
            "2004-10-02",
            (
                "The galaxy M104 seen almost edge-on, about 28 million light-years away and",
                "50,000 light-years across: a bright bulge of old stars crossed by a dark lane",
                "of dust. A mosaic of six pictures taken in 2003.",
            ),
            (
                "A glowing white disc seen from the side, like a wide-brimmed hat, with a dark",
                "band of dust along its rim.",
            ),
            "NASA/ESA and The Hubble Heritage Team (STScI/AURA)",
        ),
        Picture(
            "heic0910h",
            "06a020f7121fb0639d43016ff9fdaa6b6a8b477e8ceb6bfd351a562dbd6bea6d",
            "The Butterfly Nebula",
            "2009-09-09",
            (
                "NGC 6302, about 3,800 light-years away in Scorpius: gas thrown off by a dying",
                "star once about five times the Sun\u2019s mass, in two lobes more than two",
                "light-years from tip to tip. The star hides behind a ring of dust at the",
                "waist. Among the first pictures from the camera astronauts fitted in May",
                "2009.",
            ),
            (
                "Two ragged wings of pink, white and orange gas spreading from a narrow dark",
                "waist, on a black sky.",
            ),
            "NASA, ESA and the Hubble SM4 ERO Team",
        ),
        Picture(
            "heic1007a",
            "11650df7abf839e4f3c8a4d349ed054d6c353e81723e0ec49006f51de417ad48",
            "Mystic Mountain",
            "2010-04-23",
            (
                "A pillar of gas and dust three light-years tall in the Carina Nebula, about",
                "7,500 light-years away, worn by the light of nearby stars. Jets of gas shoot",
                "from young stars hidden in its peaks. Released for Hubble\u2019s twentieth year",
                "in orbit.",
            ),
            (
                "A craggy brown and gold tower of dust with wisps streaming from its top,",
                "against blue and orange haze.",
            ),
            "NASA, ESA, M. Livio and the Hubble 20th Anniversary Team (STScI)",
        ),
    ),
)

TELESCOPES = (WEBB, HUBBLE)


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
