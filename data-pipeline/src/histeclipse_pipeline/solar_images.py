"""Full-disk images of the Sun from NASA's Solar Dynamics Observatory, for the space view.

Images come from Helioviewer (NASA/ESA), which serves calibrated SDO data with its pointing:
each frame is rendered with solar north up, centred on the Sun, at a scale chosen here so the
disc's radius is exactly ``DISK_RADIUS`` of the frame's width. The web app relies on that to
map the frame onto the side of the Sun that faces Earth.

SDO data is public: credit NASA/SDO and the AIA and HMI science teams.
"""

import io
import json
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import TYPE_CHECKING, TypedDict

from PIL import Image

from histeclipse_pipeline.sky import Json, parse_json

if TYPE_CHECKING:
    from pathlib import Path

HELIOVIEWER_API = "https://api.helioviewer.org/v2"
#: One date for every layer, so they show the same Sun: two days before the May 2024
#: superstorm, with the giant active region 3664 near the middle of the disc.
DEFAULT_DATE = "2024-05-08T12:00:00Z"
#: The disc's radius as a share of the frame's width; the frame reaches 1.25 solar radii.
DISK_RADIUS = 0.4
SIZES = (512, 2048)
WEBP_QUALITY = 82


@dataclass(frozen=True)
class Layer:
    """One SDO channel: what it shows and where Helioviewer keeps it."""

    key: str
    source_id: int
    layer: str
    label: str
    description: str


LAYERS = (
    Layer(
        "visible",
        18,
        "SDO,HMI,HMI,continuum",
        "Visible light",
        "617 nm, close to what the eye sees through a safe filter: the surface and its sunspots.",
    ),
    Layer(
        "magnetogram",
        19,
        "SDO,HMI,HMI,magnetogram",
        "Magnetic field",
        "The field along our line of sight: white points toward us, black away.",
    ),
    Layer(
        "304",
        13,
        "SDO,AIA,AIA,304",
        "304 Å",
        "Extreme ultraviolet from helium at about 50,000 °C: the chromosphere and prominences.",
    ),
    Layer(
        "171",
        10,
        "SDO,AIA,AIA,171",
        "171 Å",
        "Iron at about 600,000 °C: the quiet corona and its magnetic loops.",
    ),
    Layer(
        "193",
        11,
        "SDO,AIA,AIA,193",
        "193 Å",
        "Iron at about 1 million °C: the corona, with dark coronal holes where the wind escapes.",
    ),
    Layer(
        "131",
        9,
        "SDO,AIA,AIA,131",
        "131 Å",
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


def to_webp(png: bytes) -> bytes:
    """Re-encode a rendered frame as WebP, keeping transparency off the disc."""
    with Image.open(io.BytesIO(png)) as image:
        out = io.BytesIO()
        image.save(out, format="WEBP", quality=WEBP_QUALITY, method=6)
        return out.getvalue()


def file_name(layer: Layer, size: int) -> str:
    """Where a frame goes under ``textures/sun/``."""
    return f"{layer.key}-{size}.webp"


class LayerEntry(TypedDict):
    """One layer in the manifest."""

    key: str
    label: str
    description: str
    observed: str
    files: dict[str, str]


class Manifest(TypedDict):
    """``sun-images.json``: what the frames are and where they came from."""

    schemaVersion: int
    credit: str
    diskRadius: float
    layers: list[LayerEntry]


CREDIT = "NASA/SDO and the AIA and HMI science teams, via Helioviewer"


def manifest(observations: dict[str, Observation]) -> Manifest:
    """Describe the frames of every layer in ``LAYERS``."""
    return {
        "schemaVersion": 1,
        "credit": CREDIT,
        "diskRadius": DISK_RADIUS,
        "layers": [
            {
                "key": layer.key,
                "label": layer.label,
                "description": layer.description,
                "observed": observations[layer.key]["date"],
                "files": {str(size): f"textures/sun/{file_name(layer, size)}" for size in SIZES},
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


def fetch_images(public: Path, date: str = DEFAULT_DATE) -> Manifest:  # pragma: no cover
    """Render every layer at every size into ``public/textures/sun`` and write the manifest."""
    folder = public / "textures" / "sun"
    folder.mkdir(parents=True, exist_ok=True)
    observations: dict[str, Observation] = {}
    for layer in LAYERS:
        observation = parse_closest_image(parse_json(_download(closest_image_url(layer, date))))
        observations[layer.key] = observation
        for size in SIZES:
            scale = image_scale(observation["radius_arcsec"], size)
            frame = to_webp(_download(screenshot_url(layer, date, scale, size)))
            _ = (folder / file_name(layer, size)).write_bytes(frame)
    result = manifest(observations)
    path = public / "data" / "sun-images.json"
    _ = path.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n")
    return result
