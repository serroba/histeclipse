"""Where the continents were, every 5 million years back to 1.8 billion years ago.

Cao et al. (2024), *Earth's tectonic and plate boundary evolution over 1.8 billion years*,
Geoscience Frontiers 15, 101922; model on Zenodo (doi:10.5281/zenodo.13628813, CC BY 4.0). Its
present-day continent outlines are carried back along its rotations, in its paleomagnetic
reference frame (the same kind as PALEOMAP's, so latitudes mean the same on both), and each
time's continents are drawn as a mask on a 0.25° grid: 255 inside a continent, 0 outside, with
the hairline gaps between neighbouring outlines sealed.

Only continental crust that survives today can be carried back, so the further back, the less
there is: about 41% of the surface today, 12% at 1,800 Ma.

pyGPlates (GPL-2) runs here, to make the masks; it is not part of the site.
"""

import hashlib
import io
import json
import sys
import tempfile
import urllib.request
import zipfile
from collections.abc import Callable
from pathlib import Path

import numpy as np
import numpy.typing as npt
import pygplates
from PIL import Image

type Mask = npt.NDArray[np.uint8]
type Json = bool | int | float | str | list[Json] | dict[str, Json] | None

ARCHIVE_URL = "https://zenodo.org/api/records/13628813/files/1.8Ga_model_GSF.zip/content"
ARCHIVE_SHA256 = "4ae9158a29c597b46f687f8c3f0f5a4a55df5ab69bde18e24257a17d358d8592"
FOLDER = "1.8Ga_model_GSF"
CONTINENTS = "shapes_continents.gpmlz"
ROTATIONS = ("1000_0_rotfile.rot", "1800_1000_rotfile.rot")
SOURCE = "https://doi.org/10.5281/zenodo.13628813"
CREDIT = (
    "Cao et al. (2024), Geoscience Frontiers 15, 101922, 1.8 Ga plate model; Zenodo, CC BY 4.0; "
    "continent outlines reconstructed with pyGPlates and drawn as 0.25° masks"
)
OLDEST_MA = 1800
STEP_MA = 5
#: 0.25°, node-registered: 90° N to 90° S, 180° W to 180° E (both edges, the same meridian).
ROWS = 721
COLUMNS = 1441


def verified(data: bytes, sha256: str, what: str) -> bytes:
    """Return `data` if its SHA-256 is the one pinned, else refuse it."""
    digest = hashlib.sha256(data).hexdigest()
    if digest != sha256:
        msg = f"{what}: expected sha256 {sha256}, got {digest}"
        raise ValueError(msg)
    return data


def mask(inside: Callable[[float, float], bool], rows: int = ROWS, columns: int = COLUMNS) -> Mask:
    """Draw a mask by asking, node by node, whether (latitude, longitude) is in a continent."""
    latitudes = np.linspace(90, -90, rows).tolist()
    longitudes = np.linspace(-180, 180, columns).tolist()
    out = np.zeros((rows, columns), dtype=np.uint8)
    for row, latitude in enumerate(latitudes):
        for column, longitude in enumerate(longitudes):
            if inside(float(latitude), float(longitude)):
                out[row, column] = 255
    return out


def _grow(inside: npt.NDArray[np.bool_]) -> npt.NDArray[np.bool_]:
    """Grow by one node each way: east and west wrapping round, north and south not."""
    grown = inside.copy()
    grown |= np.roll(inside, 1, axis=1) | np.roll(inside, -1, axis=1)
    grown[1:] |= inside[:-1]
    grown[:-1] |= inside[1:]
    return grown


def sealed(drawn: Mask) -> Mask:
    """Seal hairline gaps between neighbouring continents: grow by a node, then shrink back.

    Adjacent outlines in the model leave slivers a node wide between them, which would show as
    lines across a continent; real coasts and straits wider than a node are kept.
    """
    inside = drawn > 0
    closed = ~_grow(~_grow(inside))
    return np.where(closed, 255, 0).astype(np.uint8)


def continent_share(drawn: Mask) -> float:
    """Share of the surface inside a continent, each row weighted by its area (cos latitude)."""
    weights = np.cos(np.radians(np.linspace(90, -90, len(drawn))))
    inside = (drawn[:, :-1] > 0).mean(axis=1)
    share: np.float64 = np.average(inside, weights=weights)
    return float(share)


def reconstructed_inside(
    continents: pygplates.FeatureCollection,
    rotation: pygplates.RotationModel,
    ma: float,
) -> Callable[[float, float], bool]:
    """Whether a point lies in a continent as reconstructed `ma` million years ago."""
    reconstructed: list[pygplates.ReconstructedFeatureGeometry] = []
    pygplates.reconstruct(continents, rotation, reconstructed, ma)
    partitioner = pygplates.PlatePartitioner(reconstructed, rotation)

    def inside(latitude: float, longitude: float) -> bool:
        return partitioner.partition_point(pygplates.PointOnSphere(latitude, longitude)) is not None

    return inside


def to_png(drawn: Mask) -> bytes:
    """Write a mask as an optimised 8-bit greyscale PNG, north at the top."""
    out = io.BytesIO()
    Image.fromarray(drawn, mode="L").save(out, format="PNG", optimize=True)
    return out.getvalue()


def write_masks(
    continents: pygplates.FeatureCollection,
    rotation: pygplates.RotationModel,
    ages: list[int],
    folder: Path,
    grid: tuple[int, int] = (ROWS, COLUMNS),
) -> int:
    """Draw one mask per age on a (rows, columns) grid, write PNGs and ``index.json``."""
    folder.mkdir(parents=True, exist_ok=True)
    rows, columns = grid
    frames: list[Json] = []
    for ma in ages:
        drawn = sealed(mask(reconstructed_inside(continents, rotation, float(ma)), rows, columns))
        _ = (folder / f"{ma}.png").write_bytes(to_png(drawn))
        frames.append(
            {"ma": ma, "file": f"{ma}.png", "continents": round(continent_share(drawn), 3)}
        )
    index: dict[str, Json] = {
        "schemaVersion": 1,
        "credit": CREDIT,
        "source": SOURCE,
        "rows": rows,
        "columns": columns,
        "frames": frames,
    }
    _ = (folder / "index.json").write_text(json.dumps(index, separators=(",", ":")) + "\n")
    return len(frames)


def build(
    archive: bytes,
    folder: Path,
    *,
    ages: list[int] | None = None,
    grid: tuple[int, int] = (ROWS, COLUMNS),
) -> int:
    """Unpack the model's continents and rotations, and draw every 5 million years."""
    with zipfile.ZipFile(io.BytesIO(archive)) as opened, tempfile.TemporaryDirectory() as unpacked:
        for name in (CONTINENTS, *ROTATIONS):
            _ = (Path(unpacked) / name).write_bytes(opened.read(f"{FOLDER}/{name}"))
        continents = pygplates.FeatureCollection(str(Path(unpacked) / CONTINENTS))
        rotation = pygplates.RotationModel([str(Path(unpacked) / name) for name in ROTATIONS])
        every = list(range(0, OLDEST_MA + 1, STEP_MA)) if ages is None else ages
        return write_masks(continents, rotation, every, folder, grid)


def main(argv: list[str] | None = None) -> int:  # pragma: no cover - needs network access
    """Download the model (checked against its pinned checksum) and write the masks."""
    folder = Path((argv if argv is not None else sys.argv[1:])[0])
    request = urllib.request.Request(ARCHIVE_URL, headers={"User-Agent": "histeclipse-pipeline"})
    with urllib.request.urlopen(request, timeout=300) as response:  # noqa: S310  # pyright: ignore[reportAny]
        body: object = response.read()  # pyright: ignore[reportAny]
    if not isinstance(body, bytes):
        msg = f"{ARCHIVE_URL}: expected bytes"
        raise TypeError(msg)
    count = build(verified(body, ARCHIVE_SHA256, "Cao et al. 2024 model"), folder)
    print(f"wrote {count} continent masks to {folder}")  # noqa: T201
    return 0
