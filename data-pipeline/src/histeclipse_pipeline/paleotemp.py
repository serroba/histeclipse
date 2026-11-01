"""Surface temperature over the last 540 million years, from Scotese's paleotemperature maps.

Scotese, C. R. (2022), *Global Mean Surface Temperatures for 100 Phanerozoic Time Intervals*
(doi:10.5281/zenodo.5718392, CC BY 4.0): mean annual surface temperature on a 1° grid, from
HadCM3L climate simulations (Valdes, Scotese & Lunt 2021) adjusted to oxygen-isotope proxies
and to climate-sensitive rocks (Scotese et al. 2021, Earth-Science Reviews 215). The maps sit
on the same PALEOMAP geography as the PaleoDEMs, every 5 million years to 450 Ma and every 10
million years before that.

Each map becomes a small greyscale PNG: a byte step is 120 °C / 255, about half a degree,
from -60 °C to +60 °C.

The CSV grids are node-registered, 361 columns from 180° W to 180° E and 181 rows from 90° N
to 90° S. Each has two planted values, +50 and -55 in the first two cells of the north pole
row: colour-scale anchors for map software, not temperatures. The pole row takes its other
cells' value there. (The archive's NetCDF files leave out that row altogether.)
"""

import io
import json
import re
import urllib.request
import zipfile
from dataclasses import dataclass
from typing import TYPE_CHECKING

import numpy as np
import numpy.typing as npt
from PIL import Image

from histeclipse_pipeline.sky import Json, verified

if TYPE_CHECKING:
    from collections.abc import Iterable, Iterator
    from pathlib import Path

type Temperatures = npt.NDArray[np.float64]

ZENODO_RECORD = "https://zenodo.org/records/5718392"
ARCHIVE_URL = (
    "https://zenodo.org/api/records/5718392/files/gmst_scotese02a_v21321_csv-grid.zip/content"
)
ARCHIVE_SHA256 = "53f969e1bf8a75a7ac23067a032f846614b1340849ddc53de2e551d9dd894ff6"
CREDIT = (
    "Scotese (2022), Global Mean Surface Temperatures for 100 Phanerozoic Time Intervals, "
    "CC BY 4.0, after Scotese et al. (2021) and Valdes, Scotese & Lunt (2021); colour-scale "
    "anchors removed, packed into 8-bit images for this site"
)
COLUMNS = 361
ROWS = 181
#: The span the byte encoding covers, °C.
COLDEST = -60.0
WARMEST = 60.0

#: Maps that stand out, with what the site says about them. The 65 Ma map's global mean is
#: 8.1 °C, against 22.2 °C at 60 Ma and 20.8 °C at 70 Ma; the source's own text calls 65-40 Ma
#: a hothouse and does not explain the map. It is kept as published, with this note.
NOTES: dict[int, str] = {
    65: (
        "This map is far colder than its neighbours (a global mean of 8.1 °C, against about "
        "21 °C at 60 and 70 Ma), and the source does not say why. It may show the impact "
        "winter after the asteroid strike, which lasted years, not millions of years."
    ),
}

_FILE_NAME = re.compile(r"(?:^|/)(\d{3})_temp\.csv$")


@dataclass(frozen=True)
class Map:
    """One time step: millions of years ago, and temperatures in °C, north row first."""

    ma: int
    temperatures: Temperatures


def read_map(ma: int, text: str) -> Map:
    """Read one headerless CSV grid and check its shape."""
    rows = [[float(value) for value in line.split(",")] for line in text.splitlines() if line]
    temperatures = np.array(rows, dtype=np.float64)
    if temperatures.shape != (ROWS, COLUMNS):
        msg = f"{ma} Ma: expected {ROWS} by {COLUMNS} nodes, got {temperatures.shape}"
        raise ValueError(msg)
    return Map(ma, temperatures)


def repair(temperatures: Temperatures) -> Temperatures:
    """Give each pole row one value (dropping the planted anchors) and join the 180° seam."""
    out = temperatures.copy()
    out[0, :] = float(np.median(out[0, 2:]))
    out[-1, :] = float(np.median(out[-1, :]))
    seam = (out[:, 0] + out[:, -1]) / 2
    out[:, 0] = seam
    out[:, -1] = seam
    return out


def encode(temperatures: Temperatures) -> npt.NDArray[np.uint8]:
    """Pack °C into bytes, linearly from COLDEST (0) to WARMEST (255)."""
    scaled = (np.clip(temperatures, COLDEST, WARMEST) - COLDEST) / (WARMEST - COLDEST)
    return np.round(scaled * 255).astype(np.uint8)


def decode(byte: int) -> float:
    """Return the temperature a byte stands for, °C (what the shader computes)."""
    return COLDEST + byte / 255 * (WARMEST - COLDEST)


def to_png(temperatures: Temperatures) -> bytes:
    """Write temperatures as an optimised 8-bit greyscale PNG, north at the top."""
    out = io.BytesIO()
    Image.fromarray(encode(temperatures), mode="L").save(out, format="PNG", optimize=True)
    return out.getvalue()


def global_mean(temperatures: Temperatures) -> float:
    """Area-weighted mean temperature, °C (each row weighted by cos latitude)."""
    weights = np.cos(np.radians(np.linspace(90, -90, len(temperatures))))
    # The last column repeats the first (the same meridian), so it is not counted twice.
    by_row = temperatures[:, :-1].mean(axis=1)
    mean: np.float64 = np.average(by_row, weights=weights)
    return float(mean)


def read_archive(data: bytes) -> Iterator[Map]:
    """Yield every map in the Zenodo CSV-grid archive, youngest first."""
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        members: list[tuple[int, str]] = []
        for name in archive.namelist():
            match = _FILE_NAME.search(name)
            if match is not None and not name.startswith("__MACOSX/"):
                members.append((int(match.group(1)), name))
        for ma, name in sorted(members):
            yield read_map(ma, archive.read(name).decode("ascii"))


def file_name(ma: int) -> str:
    """Name the image for a time step, e.g. ``250.png``."""
    return f"{ma}.png"


def _frame(ma: int, mean: float) -> Json:
    frame: dict[str, Json] = {"ma": ma, "file": file_name(ma), "mean": round(mean, 1)}
    if ma in NOTES:
        frame["note"] = NOTES[ma]
    return frame


def index_file(frames: list[tuple[int, float]]) -> dict[str, Json]:
    """Build the manifest the web app reads: credit, encoding, grid shape and time steps."""
    return {
        "schemaVersion": 1,
        "credit": CREDIT,
        "source": ZENODO_RECORD,
        "columns": COLUMNS,
        "rows": ROWS,
        "coldest": COLDEST,
        "warmest": WARMEST,
        "frames": [_frame(ma, mean) for ma, mean in frames],
    }


def write_paleotemp(maps: Iterable[Map], folder: Path) -> int:
    """Repair each map, write one PNG per time step and ``index.json``."""
    folder.mkdir(parents=True, exist_ok=True)
    frames: list[tuple[int, float]] = []
    for each in maps:
        temperatures = repair(each.temperatures)
        _ = (folder / file_name(each.ma)).write_bytes(to_png(temperatures))
        frames.append((each.ma, global_mean(temperatures)))
    body = json.dumps(index_file(frames), separators=(",", ":"))
    _ = (folder / "index.json").write_text(body + "\n")
    return len(frames)


def fetch_paleotemp(folder: Path) -> int:  # pragma: no cover - needs network access
    """Download the CSV-grid archive (checked against its pinned checksum) and write the images."""
    request = urllib.request.Request(ARCHIVE_URL, headers={"User-Agent": "histeclipse-pipeline"})
    with urllib.request.urlopen(request, timeout=300) as response:  # noqa: S310  # pyright: ignore[reportAny]
        body: object = response.read()  # pyright: ignore[reportAny]
    if not isinstance(body, bytes):
        msg = f"{ARCHIVE_URL}: expected bytes"
        raise TypeError(msg)
    return write_paleotemp(
        read_archive(verified(body, ARCHIVE_SHA256, "temperature archive")), folder
    )
