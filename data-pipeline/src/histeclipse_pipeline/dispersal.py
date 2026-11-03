"""When people first settled each place, as one model has it: Timmermann & Friedrich (2016).

Timmermann & Friedrich (2016), *Late Pleistocene climate drivers of early human migration*,
Nature 538, 92-95 (doi:10.1038/nature19365). A reaction-diffusion model of human dispersal,
forced by a transient climate simulation of the last 125,000 years, gives the time of first
continuous settlement of each 1° cell. Data from the ICCP climate data server (OPeNDAP),
licensed CC BY-NC 4.0: "for noncommercial purposes only, and only so long as attribution is
given to the creator". The files written here keep that licence.

Two of its scenarios are kept: an early exit from Africa (scenario A) and a late one (B), to
be shown side by side. Each becomes a greyscale PNG, a byte per cell: the arrival in thousands
of years ago (1 to 125), 0 where the model never settles. North at the top; the first column
is centred on 179.5° W.
"""

import io
import json
import re
import urllib.request
from typing import TYPE_CHECKING, Literal

import numpy as np
import numpy.typing as npt
from PIL import Image

from histeclipse_pipeline.sky import Json, verified

if TYPE_CHECKING:
    from pathlib import Path

type Scenario = Literal["a", "b"]
type Grid = npt.NDArray[np.float64]

#: The server's HTTPS uses a TLS version too old to connect to; the pinned checksums guard
#: the plain-HTTP download.
URL = "http://climatedata.ibs.re.kr:9090/dods/public-data/human-dispersal-simulation/arrival-time.ascii?arrivaltime_{scenario}"
SHA256: dict[Scenario, str] = {
    "a": "a2bc145d0817f6473afc56d13254c8d71aa88c5c08a6523a070241398807a5a3",
    "b": "5d2f4a70045da46df86ac91bbcbf3e0d8ef24e658772d4e517de08a7473fef3d",
}
SCENARIOS: dict[Scenario, str] = {
    "a": "early exit from Africa (scenario A)",
    "b": "late exit from Africa (scenario B)",
}
SOURCE = "https://climatedata.ibs.re.kr/data/human-dispersal-simulation/arrival-time"
CREDIT = (
    "Timmermann & Friedrich (2016), Nature 538, 92; ICCP climate data server, CC BY-NC 4.0 "
    "(non-commercial use only); arrival times packed into 8-bit images for this site"
)
ROWS = 180
COLUMNS = 360
#: The model's grid starts at 19.5° W; the site's maps start at 179.5° W.
_FIRST_LONGITUDE = -19.5
_MISSING = -1e30

_ROW = re.compile(r"^\[0\]\[(\d+)\],(.*)$", re.MULTILINE)


def parse_ascii(text: str) -> Grid:
    """Read the server's ASCII grid: rows south to north, the model's longitudes."""
    grid = np.full((ROWS, COLUMNS), np.nan)
    for match in _ROW.finditer(text):
        row = int(match.group(1))
        values = [float(value) for value in match.group(2).split(",")]
        if len(values) != COLUMNS or row >= ROWS:
            msg = f"row {row} has {len(values)} values, not {COLUMNS}"
            raise ValueError(msg)
        grid[row] = [value if value > _MISSING else np.nan for value in values]
    return grid


def site_layout(grid: Grid) -> Grid:
    """Turn the model's grid north up, and start it at 179.5° W like the site's other maps."""
    # The model's column j is centred on 19.5° W + j; the site's first, on 179.5° W.
    shift = round(_FIRST_LONGITUDE + 179.5) % COLUMNS
    return np.roll(grid[::-1], shift, axis=1)


def encode(grid: Grid) -> bytes:
    """Pack a grid as a greyscale PNG: arrival in thousands of years ago, 0 if never settled."""
    values = np.where(np.isnan(grid), 0, np.clip(np.rint(grid), 1, 255)).astype(np.uint8)
    buffer = io.BytesIO()
    Image.fromarray(values, mode="L").save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()


def index_file() -> dict[str, Json]:
    """Describe the images: whose, which scenarios, how to read them."""
    return {
        "schemaVersion": 1,
        "credit": CREDIT,
        "source": SOURCE,
        "license": "CC BY-NC 4.0",
        "rows": ROWS,
        "columns": COLUMNS,
        "scenarios": [
            {"id": scenario, "name": name, "file": f"arrival-{scenario}.png"}
            for scenario, name in SCENARIOS.items()
        ],
    }


LICENSE_NOTE = """The files in this folder are derived from data by Axel Timmermann and Tobias
Friedrich (Late Pleistocene climate drivers of early human migration, Nature 538, 92-95, 2016,
doi:10.1038/nature19365), shared by the IBS Center for Climate Physics climate data server
(https://climatedata.ibs.re.kr/) under a Creative Commons Attribution-NonCommercial 4.0
International licence (https://creativecommons.org/licenses/by-nc/4.0/).

They keep that licence: they may be used for non-commercial purposes only, with attribution.
Changes: two scenarios' arrival times were packed into 8-bit greyscale images and the grid was
turned north up, starting at 179.5 W. The rest of this repository is under the MIT licence;
that does not apply to these files.
"""


def fetch_dispersal(folder: Path) -> int:  # pragma: no cover - needs network access
    """Download each scenario (checked against its checksum) and write the images."""
    folder.mkdir(parents=True, exist_ok=True)
    for scenario in SCENARIOS:
        url = URL.format(scenario=scenario)
        request = urllib.request.Request(url, headers={"User-Agent": "histeclipse-pipeline"})  # noqa: S310
        with urllib.request.urlopen(request, timeout=120) as response:  # noqa: S310  # pyright: ignore[reportAny]
            body: object = response.read()  # pyright: ignore[reportAny]
        if not isinstance(body, bytes):
            msg = f"{url}: expected bytes"
            raise TypeError(msg)
        text = verified(body, SHA256[scenario], f"arrival time {scenario}").decode("ascii")
        _ = (folder / f"arrival-{scenario}.png").write_bytes(encode(site_layout(parse_ascii(text))))
    _ = (folder / "index.json").write_text(json.dumps(index_file(), indent=2) + "\n")
    _ = (folder / "LICENSE.txt").write_text(LICENSE_NOTE)
    return len(SCENARIOS)
