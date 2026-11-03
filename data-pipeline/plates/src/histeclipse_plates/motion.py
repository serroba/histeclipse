"""How far the main plates have moved through the ice ages, in Cao et al. (2024).

The same plate model as the continent masks (Geoscience Frontiers 15, 101922; Zenodo
doi:10.5281/zenodo.13628813, CC BY 4.0), in its paleomagnetic reference frame: motion relative
to Earth's spin axis, not to the hotspots or to another plate. A point on each main plate is
carried back along its rotation every 50,000 years over the last 2.6 million, and its distance
and bearing from then to now are kept.

pyGPlates (GPL-2) runs here, to read the model; it is not part of the site.
"""

import io
import json
import math
import sys
import tempfile
import urllib.request
import zipfile
from collections.abc import Callable
from pathlib import Path

import pygplates

from histeclipse_plates.masks import (
    ARCHIVE_SHA256,
    ARCHIVE_URL,
    FOLDER,
    ROTATIONS,
    SOURCE,
    Json,
    verified,
)

EARTH_RADIUS_KM = 6371.0
STEP_MA = 0.05
OLDEST_MA = 2.6
STATIC_POLYGONS = "static_polygons.gpmlz"
CREDIT = (
    "Cao et al. (2024), Geoscience Frontiers 15, 101922, 1.8 Ga plate model; Zenodo, CC BY 4.0; "
    "points carried back with pyGPlates, in the model's paleomagnetic frame"
)
#: A point on each main plate, by its name, as latitude and longitude.
PLATES: tuple[tuple[str, float, float], ...] = (
    ("Pacific", 19.6, -155.5),
    ("North American", 39.0, -98.0),
    ("South American", -15.8, -47.9),
    ("African", 15.0, 19.0),
    ("Eurasian", 60.0, 100.0),
    ("Indian", 28.6, 77.2),
    ("Australian", -25.3, 131.0),
    ("Antarctic", -80.0, 30.0),
)

type Carry = Callable[[float, float, float], tuple[float, float]]


def distance_km(start: tuple[float, float], end: tuple[float, float]) -> float:
    """Great-circle distance between two points (degrees), kilometres."""
    (lat1, lon1), (lat2, lon2) = (
        tuple(math.radians(value) for value in point) for point in (start, end)
    )
    half = (
        math.sin((lat2 - lat1) / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    )
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(half))


def bearing(start: tuple[float, float], end: tuple[float, float]) -> float:
    """Give the initial bearing from one point to another, degrees clockwise from north."""
    (lat1, lon1), (lat2, lon2) = (
        tuple(math.radians(value) for value in point) for point in (start, end)
    )
    across = math.sin(lon2 - lon1) * math.cos(lat2)
    along = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(
        lon2 - lon1
    )
    return math.degrees(math.atan2(across, along)) % 360


def motion_file(carry: Carry) -> dict[str, Json]:
    """For each plate and each step, its distance (km) and bearing (°) from then to today."""
    steps = [round(step * STEP_MA, 2) for step in range(round(OLDEST_MA / STEP_MA) + 1)]
    plates: list[Json] = []
    for name, latitude, longitude in PLATES:
        moved: list[Json] = []
        for ma in steps:
            then = carry(latitude, longitude, ma)
            now = (latitude, longitude)
            moved.append([round(distance_km(then, now)), round(bearing(then, now))])
        plates.append({"name": name, "latitude": latitude, "longitude": longitude, "moved": moved})
    return {
        "schemaVersion": 1,
        "credit": CREDIT,
        "source": SOURCE,
        "frame": "paleomagnetic",
        "stepMa": STEP_MA,
        "plates": plates,
    }


def model_carry(folder: Path) -> Carry:  # pragma: no cover - needs the model
    """Carry a present-day point back to a moment, along its plate's rotation."""
    rotation = pygplates.RotationModel([str(folder / name) for name in ROTATIONS])
    partitioner = pygplates.PlatePartitioner(
        pygplates.FeatureCollection(str(folder / STATIC_POLYGONS)), rotation
    )

    def carry(latitude: float, longitude: float, ma: float) -> tuple[float, float]:
        point = pygplates.PointOnSphere(latitude, longitude)
        polygon = partitioner.partition_point(point)
        plate = 0 if polygon is None else polygon.get_feature().get_reconstruction_plate_id()
        back = rotation.get_rotation(ma, plate, 0, 0) * point
        return back.to_lat_lon()

    return carry


def main(argv: list[str] | None = None) -> int:  # pragma: no cover - needs network access
    """Download the model (checked against its checksum) and write how far the plates moved."""
    arguments = sys.argv[1:] if argv is None else argv
    path = Path(arguments[0])
    request = urllib.request.Request(ARCHIVE_URL, headers={"User-Agent": "histeclipse-pipeline"})  # noqa: S310
    with urllib.request.urlopen(request, timeout=300) as response:  # noqa: S310  # pyright: ignore[reportAny]
        body: object = response.read()  # pyright: ignore[reportAny]
    if not isinstance(body, bytes):
        msg = f"{ARCHIVE_URL}: expected bytes"
        raise TypeError(msg)
    archive = verified(body, ARCHIVE_SHA256, "Cao et al. 2024 model")
    with tempfile.TemporaryDirectory() as unpacked:
        with zipfile.ZipFile(io.BytesIO(archive)) as zipped:
            zipped.extractall(unpacked)
        data = motion_file(model_carry(Path(unpacked) / FOLDER))
    _ = path.write_text(json.dumps(data, separators=(",", ":")) + "\n")
    print(f"wrote the motion of {len(PLATES)} plates to {path}")  # noqa: T201
    return 0
