"""Global maps of the bodies seen close up, from their missions, at the sizes the site loads.

Each map is a mission's own release, in simple cylindrical projection (equal steps of latitude
and longitude, north at the top): MESSENGER's monochrome mosaic of Mercury (NASA Photojournal
PIA15063), the Viking colour mosaic of Mars (USGS Astrogeology), Cassini's colour map of Jupiter
(PIA07782), Cassini's colour map of Saturn (11 August 2011; Li, West, Jiang & Knowles 2023, in
the PDS), NASA's Blue Marble Next Generation of Earth (April 2004, with topography and
bathymetry), and the Lunar Reconnaissance Orbiter's colour mosaic of the Moon (NASA's CGI Moon
Kit). Each download is pinned by checksum, so a changed upstream file is never used unseen, and is
shrunk to the widths the site loads: one shown at once (planets), and a sharper one fetched only
close up (#258). All are NASA or USGS works, in the public domain; the site credits each where it
is shown.

Saturn's map is a FITS file of three float bands, longitude counted west from its left edge
(0° there, 180° in the middle). Its header and label say the first row is the south pole, but
its features say otherwise: as stored, the first row is the north, where the Great White Spot
storm of 2010-11 raged (about 35° N), and the rings' shadow falls in the south, as it did with
the Sun 10.7° north of the ring plane. Its gaps (the poles out of sight or in winter night,
and the rings' shadow) are filled with the mean colour of the nearest latitude imaged, which
suits a planet of bands.

The planets' moons (#335) are their missions' global mosaics, as USGS Astrogeology and NASA's
Photojournal publish them: Galileo and Voyager for Jupiter's four, Cassini (and Voyager) for
Saturn's, Viking for Phobos; Titan's ground both in near infrared and by Cassini's radar. Each
is checked against its own features for where longitude 0 lies; those centred on 180° are
turned half a turn.

Venus's map is Magellan's radar of the ground beneath its clouds (1990-94, the colourised
topographic mosaic at 6.6 km, USGS Astrogeology): the site shows it only when asked, as from
space Venus shows only cloud.
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
    #: A Cassini global map as FITS, read by `cassini_fits_map`, not an image file.
    fits: bool = False
    #: Whether the map starts at 0° on its left edge (180° in the middle) and is turned half a
    #: turn to the site's layout, 0° in the middle.
    half_turn: bool = False


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
        stem="planets/saturn",
        url=(
            "https://atmos.nmsu.edu/PDS/data/PDS4/co_iss_global-maps/data_derived/"
            "Cassini_ISS_RGB_Saturn_global_color_map_original.fits"
        ),
        sha256="32a62eca9b82255c7dd763ba0752cee1664ae73d5ec4d5d5260227deecd422af",
        # 3,600 columns once the repeated edge is dropped: its sharp size is its own.
        widths=(2048, 3600),
        fits=True,
    ),
    MapSource(
        stem="planets/venus-radar",
        url="https://planetarymaps.usgs.gov/mosaic/Venus_Magellan_C3-MDIR_ClrTopo_Global_Mosaic_6600m.tif",
        sha256="5c4acbade3a88526cf80b006f21816405fc6cc8d184ca9f3d1dc6d00f71694e0",
        widths=(2048, 4096),
    ),
    MapSource(
        stem="planets/mars-height",
        # MOLA heights, coloured and shaded (USGS, public domain).
        url="https://planetarymaps.usgs.gov/mosaic/Mars_MGS_MOLA_ClrShade_merge_global_463m.tif",
        sha256="c438516ecbc24d6bb7072103d59d2f0e023a033e57c02f1d79043a8cac01f229",
        widths=(2048, 4096),
    ),
    MapSource(
        stem="moon-height",
        # LOLA heights, coloured and shaded (USGS, public domain).
        url="https://planetarymaps.usgs.gov/mosaic/Lunar_LRO_LOLA_ClrShade_Global_128ppd_v04.tif",
        sha256="2b51e3541af472cd64208e68c8f30616c7387405c706ab6c0ca00eb7b8a13d15",
        widths=(2048, 4096),
    ),
    MapSource(
        stem="moon-minerals",
        # Clementine's colour ratios, telling the rocks apart (USGS, public domain).
        url="https://planetarymaps.usgs.gov/mosaic/Lunar_Clementine_UVVIS_Warp_ClrRatio_Global_200m.tif",
        sha256="e818ab2b404d216b12d708a01354f9864d64aa887be8b43a795cf4b5feb3fc28",
        widths=(2048, 4096),
    ),
    MapSource(
        stem="planets/mercury-colour",
        # MESSENGER's enhanced-colour map (PIA17386), centred on 180° E.
        url=f"{PHOTOJOURNAL}/pia17/pia17386/PIA17386.jpg",
        sha256="5e1c8607693605d18ae11c0401f925759762d3affa4a5f057ab9a611a125fdb1",
        widths=(2048, 4096),
        half_turn=True,
    ),
    MapSource(
        stem="planets/jupiter-2024",
        # Hubble OPAL, 19-20 Nov 2024 (CC BY 4.0): left edge 0° System III west longitude,
        # decreasing to the right, so east rises to the right from 0° at the left.
        url=(
            "https://archive.stsci.edu/missions/hlsp/opal/cycle31/jupiter/"
            "hlsp_opal_hst_wfc3-uvis_jupiter-2024c_f395n-f502n-f631n_v1_globalmap.tif"
        ),
        sha256="59f95498702f8684060008866a961b72b2f03e30db8a8b318f5ea226c305b5ae",
        widths=(2048, 3600),
        half_turn=True,
    ),
    MapSource(
        stem="moons/phobos",
        # Viking orbiter images, mosaicked by P. Stooke and controlled by DLR (USGS).
        url="https://planetarymaps.usgs.gov/mosaic/Phobos_Viking_Mosaic_40ppd_DLRcontrol.tif",
        sha256="d7934d5b209e5f31ed26297e1e85a4713d8d0aa2906111ffe4b3d60d02ae0ccb",
        widths=(2048,),
    ),
    MapSource(
        stem="moons/io",
        # Galileo and Voyager, in colour (USGS).
        url=(
            "https://planetarymaps.usgs.gov/mosaic/Io_GalileoSSI-Voyager_Global_Mosaic_ClrMerge_1km.tif"
        ),
        sha256="135f88cb645bfdb4e045b380971ab2ba14e230590c96c9c86cfe7310fda881ac",
        widths=(2048, 4096),
    ),
    MapSource(
        stem="moons/europa",
        # Galileo and Voyager (USGS), centred on 180°.
        url=(
            "https://planetarymaps.usgs.gov/mosaic/Europa_Voyager_GalileoSSI_global_mosaic_500m.tif"
        ),
        sha256="a323f0c9ccb47d5af9902ea8297fe81f9a9708795645b80801f103c3f7c9a624",
        widths=(2048, 4096),
        half_turn=True,
    ),
    MapSource(
        stem="moons/ganymede",
        # Galileo and Voyager (USGS), centred on 180°.
        url=(
            "https://planetarymaps.usgs.gov/mosaic/Ganymede_Voyager_GalileoSSI_global_mosaic_1km.tif"
        ),
        sha256="c2c8d9506b8cf8f7a0a90d823d9052e91c8d9885cf7267fdce8de8216f4df888",
        widths=(2048, 4096),
        half_turn=True,
    ),
    MapSource(
        stem="moons/callisto",
        # Galileo and Voyager (USGS), centred on 180°.
        url=(
            "https://planetarymaps.usgs.gov/mosaic/Callisto_Voyager_GalileoSSI_global_mosaic_1km.tif"
        ),
        sha256="e1f0bd2e0e05de605d067d6b5f5ededddaf31ca6c064562a1ca770f15a7dbaa3",
        widths=(2048, 4096),
        half_turn=True,
    ),
    MapSource(
        stem="moons/mimas",
        # Cassini, Voyager filling gaps (PIA14926, June 2012).
        url=f"{PHOTOJOURNAL}/pia14/pia14926/PIA14926.jpg",
        sha256="a0cdde111976af47d38b88388863cf43d451f1610b6207c6ac8864c9462f4d0e",
        widths=(2048, 4096),
    ),
    MapSource(
        stem="moons/enceladus",
        # Cassini (USGS).
        url="https://planetarymaps.usgs.gov/mosaic/Enceladus_Cassini_mosaic_global_110m.tif",
        sha256="c9d29292141dd986e52b2a24b692df34701d1dabaee69bcb9fb64ebc6baba335",
        widths=(2048, 4096),
    ),
    MapSource(
        stem="moons/tethys",
        # Cassini, mosaicked by DLR (USGS).
        url="https://planetarymaps.usgs.gov/mosaic/Tethys_Cassini_mosaic_global_293m.tif",
        sha256="40723c3ebfaaa52a657827b37309bc84234811db1cf26a21d086e26aba2b3640",
        widths=(2048, 4096),
    ),
    MapSource(
        stem="moons/dione",
        # Cassini and Voyager, mosaicked by DLR (USGS).
        url="https://planetarymaps.usgs.gov/mosaic/Dione_Cassini_Voyager_mosaic_global_154m.tif",
        sha256="5c5d796c02e3c99fde5dd034e01dd1f25905699a4885843aed445ded955e08b5",
        widths=(2048, 4096),
    ),
    MapSource(
        stem="moons/rhea",
        # Cassini and Voyager, mosaicked by DLR (USGS).
        url="https://planetarymaps.usgs.gov/mosaic/Rhea_Cassini_Voyager_mosaic_global_417m.tif",
        sha256="ce537c3c93670a0d4ea5a64b99bffb76ff308727eb3eabeee0a38cf9f6f1abc7",
        widths=(2048, 4096),
    ),
    MapSource(
        stem="moons/titan",
        # Cassini in near infrared (PIA19658, USGS), centred on 180°: its sharp size its own
        # 4040 pixels, not enlarged. (USGS's 450 m mosaic, 45° N to 65° S, is sharper only past
        # 8192 pixels, and lower in contrast, being an average of its images.)
        url="https://planetarymaps.usgs.gov/mosaic/Titan_ISS_P19658_Mosaic_Global_4km.tif",
        sha256="ca0fe5f6f9bdba1b6d03245969a42336a010ddc17d636e5e06fffa939d10ca83",
        widths=(2048, 4040),
        half_turn=True,
    ),
    MapSource(
        stem="moons/titan-radar",
        # Cassini's radar (SAR and HiSAR) through flyby T104, mosaicked by the Cassini SAR Team
        # and USGS (preliminary, 2015), centred on 180°; black where the radar never looked
        # (about 38% of the ground). Its longitudes checked against the near-infrared map's:
        # they correlate best as they are, turned half a turn, neither shifted nor mirrored.
        url=(
            "https://planetarymaps.usgs.gov/mosaic/"
            "Titan_SAR_HiSAR_MosaicThru_T104_Jan2015_clon180_128ppd.tif"
        ),
        sha256="fde8a97ad85d5711a8070b491cccc0cc93a963ed9ddef753c517ba6874742773",
        widths=(2048, 4096),
        half_turn=True,
    ),
    MapSource(
        stem="moons/iapetus",
        # Cassini and Voyager, mosaicked by DLR (USGS).
        url="https://planetarymaps.usgs.gov/mosaic/Iapetus_Cassini_Voyager_mosaic_global_783m.tif",
        sha256="eb8acdbed3af495102b6ec6d3efce1f03dc6bc39bb43323c23231ce590494d6e",
        widths=(2048, 4096),
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


FITS_BLOCK = 2880
FITS_CARD = 80
BANDS = 3


def _fits_header(data: bytes) -> tuple[dict[str, str], int]:
    """Read a FITS header's cards up to END; return them and where the data begins."""
    cards: dict[str, str] = {}
    at = 0
    while at + FITS_CARD <= len(data):
        card = data[at : at + FITS_CARD].decode("ascii")
        at += FITS_CARD
        key = card[:8].strip()
        if key == "END":
            return cards, -(-at // FITS_BLOCK) * FITS_BLOCK
        if card[8:10] == "= ":
            cards[key] = card[10:].split("/", 1)[0].strip().strip("'").strip()
    msg = "FITS header has no END"
    raise ValueError(msg)


def fits_bands(data: bytes) -> FloatArray:
    """Read a FITS image of three 32-bit float bands: its bands as (rows, columns, 3)."""
    cards, start = _fits_header(data)
    shape = [int(cards.get(f"NAXIS{axis}", "0")) for axis in (3, 2, 1)]
    if cards.get("BITPIX") != "-32" or cards.get("NAXIS") != "3" or shape[0] != BANDS:
        msg = f"expected three bands of 32-bit floats, not {cards}"
        raise ValueError(msg)
    count = shape[0] * shape[1] * shape[2]
    values = np.frombuffer(data, dtype=">f4", count=count, offset=start).astype(np.float64)
    return np.moveaxis(values.reshape(shape), 0, -1)


def filled_by_latitude(bands: FloatArray) -> FloatArray:
    """Fill the gaps (black, where nothing was imaged) with the mean of the nearest row imaged."""
    filled: FloatArray = np.nan_to_num(bands)
    seen: FloatArray = (np.max(filled, axis=2, keepdims=True) > 0).astype(np.float64)
    counts: FloatArray = np.sum(seen, axis=1)
    imaged = np.flatnonzero(counts[:, 0] > 0)
    if imaged.size == 0:
        msg = "nothing was imaged"
        raise ValueError(msg)
    means: FloatArray = np.sum(filled * seen, axis=1) / np.maximum(counts, 1)
    rows = np.arange(dims(filled)[0])
    nearest = imaged[np.argmin(np.abs(imaged[np.newaxis, :] - rows[:, np.newaxis]), axis=1)]
    return filled * seen + means[nearest][:, np.newaxis, :] * (1 - seen)


def cassini_fits_map(data: bytes) -> Image.Image:
    """Turn Cassini's FITS global map into an image: north up, 0° in the middle, gaps filled.

    Columns run from 360° west at the left edge round to 0°, so east rises to the right. The
    first and last columns are the same meridian; the first is a dark seam and is dropped, which
    leaves 0° in the last column, and half a turn brings it to the middle.
    """
    bands = fits_bands(data)[:, 1:]
    turned = np.roll(bands, dims(bands)[1] // 2 + 1, axis=1)
    pixels = np.clip(filled_by_latitude(turned), 0, 255).round().astype(np.uint8)
    return Image.fromarray(pixels)


def half_turned(image: Image.Image) -> Image.Image:
    """Turn a map half a turn about the pole: the middle column to the left edge."""
    pixels: np.typing.NDArray[np.uint8] = np.asarray(image.convert("RGB"), dtype=np.uint8)
    return Image.fromarray(np.roll(pixels, image.width // 2, axis=1))


def web_map(
    image: Image.Image, *, stretch: bool = False, width: int = WIDTH, half_turn: bool = False
) -> Image.Image:
    """Make the map for the web: RGB, ``width`` by half that, brightened and turned if asked."""
    turned = half_turned(image) if half_turn else image
    shrunk = turned.convert("RGB").resize((width, width // 2), Image.Resampling.LANCZOS)
    return stretched(shrunk) if stretch else shrunk


def write_map(image: Image.Image, path: Path) -> None:
    """Write a map as a progressive JPEG."""
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, "JPEG", quality=JPEG_QUALITY, progressive=True, optimize=True)


def download(url: str, path: Path) -> None:  # pragma: no cover - needs network access
    """Download ``url`` to ``path``, through a partial file so a broken one is never kept."""
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})  # noqa: S310
    path.parent.mkdir(parents=True, exist_ok=True)
    partial = path.with_suffix(path.suffix + ".part")
    with urllib.request.urlopen(request, timeout=120) as response, partial.open("wb") as file:  # noqa: S310  # pyright: ignore[reportAny]
        shutil.copyfileobj(response, file)  # pyright: ignore[reportAny]
    _ = partial.replace(path)


def fetch_planet_maps(  # pragma: no cover - needs network access
    folder: Path, cache: Path, only: str | None = None
) -> int:
    """Download each map once into ``cache``, check it, and write each size under ``folder``.

    ``only`` limits it to the map with that stem, so a large source can be fetched, made and
    cleared one at a time.
    """
    # Mars's mosaic is 23040 by 11520 pixels and Earth's 21600 by 10800, past Pillow's guard
    # against decompression bombs; their checksums are pinned, so they are the files expected.
    Image.MAX_IMAGE_PIXELS = None
    written = 0
    for source in MAPS:
        if only is not None and source.stem != only:
            continue
        path = cache / source.url.rsplit("/", 1)[-1]
        if not path.exists():
            download(source.url, path)
        with (
            cassini_fits_map(checked(path, source.sha256).read_bytes())
            if source.fits
            else Image.open(checked(path, source.sha256))
        ) as image:
            for width in source.widths:
                made = web_map(
                    image, stretch=source.stretch, width=width, half_turn=source.half_turn
                )
                write_map(made, folder / f"{source.stem}-{width}.jpg")
                written += 1
    return written
