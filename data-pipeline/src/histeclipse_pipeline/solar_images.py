"""Maps of the whole Sun from NASA's Solar Dynamics Observatory, for the space view.

Images come from Helioviewer (NASA/ESA), which serves calibrated SDO data with its pointing:
each frame is rendered with solar north up, centred on the Sun, at a scale chosen here so the
disc's radius is exactly ``DISK_RADIUS`` of the frame's width.

SDO sees only the side facing Earth, so for each channel four frames a quarter of a solar
rotation apart are stitched into one map of the whole surface (``sun_map``). The newest frame is
kept as well: beyond its limb it shows the corona and prominences, which the web app draws
around the Sun when it is seen from Earth's side.

SDO data is public: credit NASA/SDO and the AIA and HMI science teams.
"""

import io
import json
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING, TypedDict

import numpy as np
from PIL import Image

from histeclipse_pipeline.arrays import dims
from histeclipse_pipeline.sky import Json, parse_json
from histeclipse_pipeline.sun_map import (
    Composite,
    Frame,
    composite,
    fill_unseen,
    flatten_all,
    grid,
    julian_day,
    linear_from_srgb,
    srgb_from_linear,
    usable,
)

if TYPE_CHECKING:
    from pathlib import Path

    from histeclipse_pipeline.arrays import FloatArray

HELIOVIEWER_API = "https://api.helioviewer.org/v2"
#: The newest frame, one date for every layer so they show the same Sun: two days before the
#: May 2024 superstorm, with the giant active region 3664 near the middle of the disc.
DEFAULT_DATE = "2024-05-08T12:00:00Z"
#: Frames per map, and the days between them: a quarter of the Sun's 27.27-day turn as seen
#: from Earth, so each frame looks 90° further round and every longitude is seen within 45° of
#: the centre of some frame's disc.
FRAME_COUNT = 4
FRAME_SPACING_DAYS = 27.2753 / 4
#: The disc's radius as a share of the frame's width; the frame reaches 1.25 solar radii.
DISK_RADIUS = 0.4
#: Widths of the newest frame, kept for the corona around the limb.
SIZES = (512, 2048)
#: Widths of the maps (twice their height): a small one to show at once and a sharp one, which
#: at the disc's centre about matches the frames' own detail.
MAP_SIZES = (512, 4096)
#: The frames stitched into a map are fetched at this width.
FRAME_SIZE = 2048
WEBP_QUALITY = 82


@dataclass(frozen=True)
class Layer:
    """One SDO channel: what it shows and where Helioviewer keeps it."""

    key: str
    source_id: int
    layer: str
    #: What the channel shows, for its button; the light it is, small beneath (#249).
    label: str
    detail: str
    description: str
    #: Whether the brightness is light (scaled and blended as linear light) or, for the
    #: magnetogram, a signed field coded as grey (blended as it is, never rescaled).
    light: bool = True


LAYERS = (
    Layer(
        "visible",
        18,
        "SDO,HMI,HMI,continuum",
        "Surface",
        "visible light, 617 nm",
        "617 nm, close to what the eye sees through a safe filter: the surface and its sunspots.",
    ),
    Layer(
        "magnetogram",
        19,
        "SDO,HMI,HMI,magnetogram",
        "Magnetic field",
        "at the surface",
        "The magnetic field at the surface: white where it points out of the Sun, black in.",
        light=False,
    ),
    Layer(
        "304",
        13,
        "SDO,AIA,AIA,304",
        "Chromosphere",
        "304 Å · 50,000 °C",
        "Extreme ultraviolet from helium at about 50,000 °C: the chromosphere and prominences.",
    ),
    Layer(
        "171",
        10,
        "SDO,AIA,AIA,171",
        "Quiet corona",
        "171 Å · 600,000 °C",
        "Iron at about 600,000 °C: the quiet corona and its magnetic loops.",
    ),
    Layer(
        "193",
        11,
        "SDO,AIA,AIA,193",
        "Corona and holes",
        "193 Å · 1 million °C",
        "Iron at about 1 million °C: the corona, with dark coronal holes where the wind escapes.",
    ),
    Layer(
        "131",
        9,
        "SDO,AIA,AIA,131",
        "Flares",
        "131 Å · 10 million °C",
        "Iron at about 10 million °C: the hottest flaring plasma.",
    ),
)


class Observation(TypedDict):
    """When the closest SDO image was taken, and the Sun's radius on it in arcseconds."""

    date: str
    radius_arcsec: float


def parse_closest_image(body: Json) -> Observation:
    """Read Helioviewer's ``getClosestImage`` answer."""
    if not isinstance(body, dict):
        msg = "getClosestImage: expected an object"
        raise TypeError(msg)
    date, scale, rsun = body.get("date"), body.get("scale"), body.get("rsun")
    if not isinstance(date, str):
        msg = "getClosestImage: missing date"
        raise TypeError(msg)
    if not isinstance(scale, int | float) or not isinstance(rsun, int | float):
        msg = "getClosestImage: missing scale or rsun"
        raise TypeError(msg)
    # rsun is in pixels of the original image, scale in arcseconds per pixel.
    return {"date": date.replace(" ", "T") + "Z", "radius_arcsec": float(rsun) * float(scale)}


def image_scale(radius_arcsec: float, size: int) -> float:
    """Arcseconds per pixel that make the disc's radius ``DISK_RADIUS`` of a ``size`` frame."""
    return radius_arcsec / (DISK_RADIUS * size)


def closest_image_url(layer: Layer, date: str) -> str:
    """Helioviewer query for the image of ``layer`` closest to ``date``."""
    query = urllib.parse.urlencode({"date": date, "sourceId": layer.source_id})
    return f"{HELIOVIEWER_API}/getClosestImage/?{query}"


def screenshot_url(layer: Layer, date: str, scale: float, size: int) -> str:
    """Helioviewer query rendering ``layer`` centred on the Sun, north up, without overlays."""
    query = urllib.parse.urlencode(
        {
            "date": date,
            "imageScale": f"{scale:.6f}",
            "layers": f"[{layer.layer},1,100]",
            "events": "",
            "eventLabels": "false",
            "scale": "false",
            "x0": 0,
            "y0": 0,
            "width": size,
            "height": size,
            "display": "true",
            "watermark": "false",
        }
    )
    return f"{HELIOVIEWER_API}/takeScreenshot/?{query}"


#: When the frame closest to a date is blank, try these hours away from it, in turn.
RETRY_HOURS = (0, 1, -1, 3, -3, 6, -6)


def shifted(date: str, hours: float) -> str:
    """``date`` moved by ``hours``, as an ISO 8601 UTC moment."""
    moment = datetime.fromisoformat(date) + timedelta(hours=hours)
    return moment.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def frame_dates(newest: str = DEFAULT_DATE) -> list[str]:
    """List the moments to fetch for one map, oldest first, ending at ``newest``."""
    steps = range(FRAME_COUNT - 1, -1, -1)
    return [shifted(newest, -24 * FRAME_SPACING_DAYS * step) for step in steps]


def decode(png: bytes) -> FloatArray:
    """Decode a rendered frame as height x width x RGB, 0..1, still sRGB-encoded."""
    with Image.open(io.BytesIO(png)) as image:
        rgb = np.asarray(image.convert("RGB"), dtype=np.float64)
    return rgb / 255


def encode(pixels: FloatArray) -> Image.Image:
    """Height x width x RGB, 0..1 sRGB-encoded, as an 8-bit image."""
    values = np.round(np.clip(pixels, 0, 1) * 255).astype(np.uint8)
    return Image.fromarray(values, mode="RGB")


def to_webp(image: Image.Image) -> bytes:
    """Encode an image as WebP."""
    out = io.BytesIO()
    image.save(out, format="WEBP", quality=WEBP_QUALITY, method=6)
    return out.getvalue()


def resized(image: Image.Image, width: int) -> Image.Image:
    """``image`` scaled to ``width``, keeping its shape."""
    if image.width == width:
        return image
    height = round(image.height * width / image.width)
    return image.resize((width, height), Image.Resampling.LANCZOS)


#: Map rows stitched at a time, which bounds memory for the large map.
_BAND_ROWS = 256


def stitch(layer: Layer, frames: list[tuple[FloatArray, str]], width: int) -> FloatArray:
    """Stitch (sRGB pixels, moment) frames into a 2:1 sRGB map of the surface in ``layer``."""
    linear = [
        Frame(linear_from_srgb(pixels) if layer.light else pixels, julian_day(moment), DISK_RADIUS)
        for pixels, moment in frames
    ]
    if layer.light:
        linear = flatten_all(linear)
    lon, lat = grid(width)
    pieces = [
        composite(linear, lon[row : row + _BAND_ROWS], lat[row : row + _BAND_ROWS])
        for row in range(0, dims(lon)[0], _BAND_ROWS)
    ]
    stitched = Composite(
        np.concatenate([piece.pixels for piece in pieces], axis=0),
        np.concatenate([piece.trust for piece in pieces], axis=0),
    )
    filled = fill_unseen(stitched, mottled=layer.light)
    return srgb_from_linear(filled) if layer.light else np.clip(filled, 0, 1)


def disc_name(layer: Layer, size: int) -> str:
    """Where the newest frame goes under ``textures/sun/``."""
    return f"{layer.key}-{size}.webp"


def map_name(layer: Layer, width: int) -> str:
    """Where a map goes under ``textures/sun/``."""
    return f"{layer.key}-map-{width}.webp"


class LayerEntry(TypedDict):
    """One layer in the manifest."""

    key: str
    label: str
    detail: str
    description: str
    frames: list[str]
    map: dict[str, str]
    disc: dict[str, str]


class Manifest(TypedDict):
    """``sun-images.json``: what the maps and frames are and where they came from."""

    schemaVersion: int
    credit: str
    diskRadius: float
    layers: list[LayerEntry]


CREDIT = "NASA/SDO and the AIA and HMI science teams, via Helioviewer"


def manifest(observed: dict[str, list[str]]) -> Manifest:
    """Describe every layer in ``LAYERS``, given when its frames were taken, oldest first."""
    return {
        "schemaVersion": 3,
        "credit": CREDIT,
        "diskRadius": DISK_RADIUS,
        "layers": [
            {
                "key": layer.key,
                "label": layer.label,
                "detail": layer.detail,
                "description": layer.description,
                "frames": observed[layer.key],
                "map": {
                    str(width): f"textures/sun/{map_name(layer, width)}" for width in MAP_SIZES
                },
                "disc": {str(size): f"textures/sun/{disc_name(layer, size)}" for size in SIZES},
            }
            for layer in LAYERS
        ],
    }


def _download(url: str) -> bytes:  # pragma: no cover - needs network access
    with urllib.request.urlopen(url, timeout=300) as response:  # noqa: S310  # pyright: ignore[reportAny]
        body: object = response.read()  # pyright: ignore[reportAny]
        if not isinstance(body, bytes):
            msg = f"{url}: expected bytes"
            raise TypeError(msg)
        return body


def _cached(cache: Path, name: str, url: str) -> bytes:  # pragma: no cover - needs network access
    path = cache / name
    if path.exists():
        return path.read_bytes()
    body = _download(url)
    _ = path.write_bytes(body)
    return body


def fetch_frame(
    layer: Layer, date: str, cache: Path
) -> tuple[FloatArray, str]:  # pragma: no cover - needs network access
    """Fetch the usable frame of ``layer`` closest to ``date``, decoded, and when it was taken."""
    for hours in RETRY_HOURS:
        moment = shifted(date, hours)
        stamp = moment.replace(":", "")
        closest = _cached(cache, f"{layer.key}-{stamp}.json", closest_image_url(layer, moment))
        observation = parse_closest_image(parse_json(closest))
        scale = image_scale(observation["radius_arcsec"], FRAME_SIZE)
        url = screenshot_url(layer, moment, scale, FRAME_SIZE)
        pixels = decode(_cached(cache, f"{layer.key}-{stamp}-{FRAME_SIZE}.png", url))
        if usable(pixels, DISK_RADIUS):
            return pixels, observation["date"]
    msg = f"no usable {layer.key} frame near {date}"
    raise ValueError(msg)


def fetch_images(
    public: Path, cache: Path, date: str = DEFAULT_DATE
) -> Manifest:  # pragma: no cover - needs network access
    """Fetch every layer's frames, write its map and newest frame, and write the manifest.

    Downloads are kept in ``cache``, so a second run only redoes the stitching.
    """
    folder = public / "textures" / "sun"
    folder.mkdir(parents=True, exist_ok=True)
    cache.mkdir(parents=True, exist_ok=True)
    observed: dict[str, list[str]] = {}
    for layer in LAYERS:
        frames = [fetch_frame(layer, moment, cache) for moment in frame_dates(date)]
        observed[layer.key] = [moment for _, moment in frames]
        newest = encode(frames[-1][0])
        for size in SIZES:
            _ = (folder / disc_name(layer, size)).write_bytes(to_webp(resized(newest, size)))
        surface = encode(stitch(layer, frames, max(MAP_SIZES)))
        for width in MAP_SIZES:
            _ = (folder / map_name(layer, width)).write_bytes(to_webp(resized(surface, width)))
    result = manifest(observed)
    path = public / "data" / "sun-images.json"
    _ = path.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n")
    return result
