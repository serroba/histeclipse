"""Global maps of the bodies seen close up, from their missions, at the sizes the site loads.

Each map is a mission's own release, in simple cylindrical projection (equal steps of latitude
and longitude, north at the top): MESSENGER's monochrome mosaic of Mercury (NASA Photojournal
PIA15063), the Viking colour mosaic of Mars (USGS Astrogeology), Cassini's colour map of Jupiter
(PIA07782), NASA's Blue Marble Next Generation of Earth (April 2004, with topography and
bathymetry), and the Lunar Reconnaissance Orbiter's colour mosaic of the Moon (NASA's CGI Moon
Kit). Each download is pinned by checksum, so a changed upstream file is never used unseen, and is
shrunk to the widths the site loads: one shown at once (planets), and a sharper one fetched only
close up (#258). All are NASA or USGS works, in the public domain; the site credits each where it
is shown.

Venus is left out on purpose: from space it shows only cloud, and Magellan's map is radar of the
ground beneath. No mission has published a global map of Saturn; it keeps its painted bands.
Earth's first map (2048 wide) and the Moon's (1024) were made before this command and are kept.
"""

import hashlib
import shutil
import urllib.request
from dataclasses import dataclass
from typing import TYPE_CHECKING

import numpy as np
from PIL import Image

from histeclipse_pipeline.arrays import dims

if TYPE_CHECKING:
    from pathlib import Path

    from histeclipse_pipeline.arrays import FloatArray

WIDTH = 2048
#: Mercury's mosaic is reflectance, darker than the eye sees it: its brightest 0.5% (beyond
#: this quantile) are set at white, so the craters read. Measured away from the poles, where
#: low sunlight leaves glare and gaps.
STRETCH_QUANTILE = 0.995
JPEG_QUALITY = 85
USER_AGENT = "histeclipse-pipeline (https://github.com/serroba/histeclipse)"


@dataclass(frozen=True)
class MapSource:
    """A body's map: where it is, its checksum, the files made of it, and whether to brighten."""

    #: Each file's path under the textures folder without its width: ``planets/mars`` makes
    #: ``planets/mars-2048.jpg`` and so on.
    stem: str
    url: str
    sha256: str
    widths: tuple[int, ...]
    stretch: bool = False


PHOTOJOURNAL = "https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia"
BLUE_MARBLE = (
    "https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/"
    "bmng-topography-bathymetry"
)
MOON_KIT = "https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720"

MAPS = (
    MapSource(
        stem="planets/mercury",
        url=f"{PHOTOJOURNAL}/pia15/pia15063/PIA15063.jpg",
        sha256="f633fe2fc51656a9c5198cd34eaaf1fa5e5ae77c05461e012e19f4e14faa9f1f",
        widths=(2048, 4096),
        stretch=True,
    ),
    MapSource(
        stem="planets/mars",
        url="https://planetarymaps.usgs.gov/mosaic/Mars_Viking_ClrMosaic_global_925m.tif",
        sha256="5b3c6bea36cec0ec65b9ce5927db6b1c555c5fae60a227c774f9fcaecdf5bb33",
        widths=(2048, 4096),
    ),
    MapSource(
        stem="planets/jupiter",
        url=f"{PHOTOJOURNAL}/pia07/pia07782/PIA07782.jpg",
        sha256="6b835ddd8036ea9efd25def04f75aa60b69b096025a37eeae5e9b6978e0a2281",
        # Cassini's map is 3601 pixels wide: its sharp size is its own, not enlarged.
        widths=(2048, 3600),
    ),
    MapSource(
        stem="earth-blue-marble",
        url=f"{BLUE_MARBLE}/april/world.topo.bathy.200404.3x21600x10800.jpg",
        sha256="7d3a8c58de56782a68156c67dd171074e210a7feec9283987622e569fa338f6a",
        # Phones load the 4096; screens whose graphics allow it, the 8192.
        widths=(4096, 8192),
    ),
    MapSource(
        stem="moon-lroc",
        url=f"{MOON_KIT}/lroc_color_poles_4k.tif",
        sha256="918649a7f8ed2f1329b2cd95bb0d25483befdcb60ae1a66db681a637cc21344f",
        widths=(4096,),
    ),
)


def file_sha256(path: Path) -> str:
    """Hash a file in pieces, as Mars's mosaic is 800 MB: its SHA-256."""
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def checked(path: Path, sha256: str) -> Path:
    """Return ``path`` if its SHA-256 matches the pinned one."""
    digest = file_sha256(path)
    if digest != sha256:
        msg = f"{path.name}: SHA-256 {digest} does not match the pinned {sha256}"
        raise ValueError(msg)
    return path


def stretched(image: Image.Image) -> Image.Image:
    """Brighten an image so its brightest ``1 - STRETCH_QUANTILE`` are white, black kept."""
    pixels: FloatArray = np.asarray(image.convert("RGB"), dtype=np.float64)
    rows = dims(pixels)[0]
    top = float(np.quantile(pixels[rows // 6 : rows - rows // 6], STRETCH_QUANTILE))
    if top <= 0:
        return image.convert("RGB")
    scaled = np.clip(pixels * (255 / top), 0, 255).round().astype(np.uint8)
    return Image.fromarray(scaled)


def web_map(image: Image.Image, *, stretch: bool = False, width: int = WIDTH) -> Image.Image:
    """Make the map for the web: RGB, ``width`` by half that, brightened if asked."""
    shrunk = image.convert("RGB").resize((width, width // 2), Image.Resampling.LANCZOS)
    return stretched(shrunk) if stretch else shrunk


def write_map(image: Image.Image, path: Path) -> None:
    """Write a map as a progressive JPEG."""
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, "JPEG", quality=JPEG_QUALITY, progressive=True, optimize=True)


def _download(url: str, path: Path) -> None:  # pragma: no cover - needs network access
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})  # noqa: S310
    path.parent.mkdir(parents=True, exist_ok=True)
    partial = path.with_suffix(path.suffix + ".part")
    with urllib.request.urlopen(request, timeout=120) as response, partial.open("wb") as file:  # noqa: S310  # pyright: ignore[reportAny]
        shutil.copyfileobj(response, file)  # pyright: ignore[reportAny]
    _ = partial.replace(path)


def fetch_planet_maps(folder: Path, cache: Path) -> int:  # pragma: no cover - needs network access
    """Download each map once into ``cache``, check it, and write each size under ``folder``."""
    # Mars's mosaic is 23040 by 11520 pixels and Earth's 21600 by 10800, past Pillow's guard
    # against decompression bombs; their checksums are pinned, so they are the files expected.
    Image.MAX_IMAGE_PIXELS = None
    written = 0
    for source in MAPS:
        path = cache / source.url.rsplit("/", 1)[-1]
        if not path.exists():
            _download(source.url, path)
        with Image.open(checked(path, source.sha256)) as image:
            for width in source.widths:
                made = web_map(image, stretch=source.stretch, width=width)
                write_map(made, folder / f"{source.stem}-{width}.jpg")
                written += 1
    return written
