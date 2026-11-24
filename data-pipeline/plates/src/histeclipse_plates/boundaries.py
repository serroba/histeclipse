"""Where the plates met, every 5 million years back to 1.8 billion years ago (#1160).

The same plate model as the continent masks, Cao et al. (2024) (Geoscience Frontiers 15,
101922; Zenodo doi:10.5281/zenodo.13628813, CC BY 4.0), in its paleomagnetic reference frame.
Its plate boundaries are resolved with pyGPlates at each time, and each boundary is kept as a
line of longitude and latitude pairs, a point every degree or closer, sorted by kind: ridges
(and rifts) where plates part, subduction zones where one sinks under another, transforms where
they slide past, and the rest (sutures, inferred boundaries and the like).

The lines are as the model has them: the site turns each frame about the axis as it does the
masks, to line it up with PALEOMAP.

pyGPlates (GPL-2) runs here, to resolve the boundaries; it is not part of the site.
"""

import io
import json
import math
import sys
import tempfile
import urllib.request
import zipfile
from collections.abc import Callable, Iterable, Sequence
from pathlib import Path
from typing import Literal

import pygplates

from histeclipse_plates.masks import (
    ARCHIVE_SHA256,
    ARCHIVE_URL,
    FOLDER,
    OLDEST_MA,
    ROTATIONS,
    SOURCE,
    STEP_MA,
    Json,
    verified,
)

type Kind = Literal["ridge", "subduction", "transform", "other"]
KINDS: tuple[Kind, ...] = ("ridge", "subduction", "transform", "other")
#: The model's feature types, by the kind of boundary they are drawn as.
KIND_OF: dict[str, Kind] = {
    "MidOceanRidge": "ridge",
    "ContinentalRift": "ridge",
    "SubductionZone": "subduction",
    "Transform": "transform",
}
#: A boundary's resolved sections, in the model's files for each span of time.
TOPOLOGIES = (
    "250-0_plate_boundaries.gpml",
    "410-250_plate_boundaries.gpml",
    "1000-410_plate_boundaries.gpml",
    "1800-1000_plate_boundaries.gpml",
    "TopologyBuildingBlocks.gpml",
)
#: Points along a boundary at most this far apart, so a long one bends with the globe.
STEP_DEGREES = 1.0
#: A tenth of a degree, about 11 km: finer than the lines are drawn.
DECIMALS = 1
CREDIT = (
    "Cao et al. (2024), Geoscience Frontiers 15, 101922, 1.8 Ga plate model; Zenodo, CC BY 4.0; "
    "plate boundaries resolved with pyGPlates, in the model's paleomagnetic frame"
)

#: A boundary as resolved: its feature type's name, and its lines as (latitude, longitude) points.
type Section = tuple[str, Sequence[Sequence[tuple[float, float]]]]


def kind_of(feature_type: str) -> Kind:
    """Name the kind of boundary a feature type is drawn as."""
    return KIND_OF.get(feature_type, "other")


def flat_line(points: Iterable[tuple[float, float]]) -> list[float]:
    """Flatten (latitude, longitude) points to [longitude, latitude, ...], to 0.1 degree."""
    flat: list[float] = []
    for latitude, longitude in points:
        flat += [round(longitude, DECIMALS), round(latitude, DECIMALS)]
    return flat


def frame(ma: int, sections: Iterable[Section]) -> dict[str, Json]:
    """One time's boundaries, by kind; lines of fewer than two points are left out."""
    lines: dict[Kind, list[Json]] = {kind: [] for kind in KINDS}
    for feature_type, parts in sections:
        for part in parts:
            line = flat_line(part)
            if len(line) >= 4:  # noqa: PLR2004 - two points, each a longitude and a latitude
                lines[kind_of(feature_type)].append(list[Json](line))
    return {"ma": ma, "lines": {kind: lines[kind] for kind in KINDS}}


def write_boundaries(
    sections_at: Callable[[int], Iterable[Section]], ages: list[int], folder: Path
) -> int:
    """Write one file of boundaries per age, and ``index.json``."""
    folder.mkdir(parents=True, exist_ok=True)
    for ma in ages:
        compact = json.dumps(frame(ma, sections_at(ma)), separators=(",", ":"))
        _ = (folder / f"{ma}.json").write_text(compact + "\n")
    index: dict[str, Json] = {
        "schemaVersion": 1,
        "credit": CREDIT,
        "source": SOURCE,
        "stepMa": STEP_MA,
        "oldestMa": max(ages),
    }
    _ = (folder / "index.json").write_text(json.dumps(index, separators=(",", ":")) + "\n")
    return len(ages)


def model_sections(
    model: pygplates.TopologicalModel,
) -> Callable[[int], list[Section]]:  # pragma: no cover - needs the model's topologies
    """Resolve the model's boundaries at a time, a point every degree or closer."""
    step = math.radians(STEP_DEGREES)

    def at(ma: int) -> list[Section]:
        snapshot = model.topological_snapshot(float(ma))
        return [
            (
                section.get_topological_section_feature().get_feature_type().get_name(),
                [
                    sub.get_resolved_geometry().to_tessellated(step).to_lat_lon_list()
                    for sub in section.get_shared_sub_segments()
                ],
            )
            for section in snapshot.get_resolved_topological_sections()
        ]

    return at


def build(archive: bytes, folder: Path) -> int:  # pragma: no cover - needs the model
    """Unpack the model's topologies and rotations, and write every 5 million years."""
    with zipfile.ZipFile(io.BytesIO(archive)) as opened, tempfile.TemporaryDirectory() as unpacked:
        for name in (*TOPOLOGIES, *ROTATIONS):
            _ = (Path(unpacked) / name).write_bytes(opened.read(f"{FOLDER}/{name}"))
        rotation = pygplates.RotationModel([str(Path(unpacked) / name) for name in ROTATIONS])
        model = pygplates.TopologicalModel(
            [str(Path(unpacked) / name) for name in TOPOLOGIES], rotation
        )
        ages = list(range(0, OLDEST_MA + 1, STEP_MA))
        return write_boundaries(model_sections(model), ages, folder)


def main(argv: list[str] | None = None) -> int:  # pragma: no cover - needs network access
    """Download the model (checked against its pinned checksum) and write the boundaries.

    Arguments: the output folder.
    """
    arguments = argv if argv is not None else sys.argv[1:]
    folder = Path(arguments[0])
    request = urllib.request.Request(ARCHIVE_URL, headers={"User-Agent": "histeclipse-pipeline"})  # noqa: S310
    with urllib.request.urlopen(request, timeout=300) as response:  # noqa: S310  # pyright: ignore[reportAny]
        body: object = response.read()  # pyright: ignore[reportAny]
    if not isinstance(body, bytes):
        msg = f"{ARCHIVE_URL}: expected bytes"
        raise TypeError(msg)
    count = build(verified(body, ARCHIVE_SHA256, "Cao et al. 2024 model"), folder)
    print(f"wrote {count} frames of plate boundaries to {folder}")  # noqa: T201
    return 0
