"""The strength of Earth's magnetic dipole over the last 100,000 years: GGF100k.

GGF100k (Panovska, Constable & Korte 2018) is a global model of the field built from sediment,
lava and archaeological records; its archive on EarthRef (ERDA 2382) includes the dipole moment
every 50 years, from 100 ka to the present (1950). The archive states no licence; the series is
used as the paper's published result, cited, as decided on #269. It is a smooth model: models
fitted to the excursions alone put the Laschamp low far lower (Korte et al. 2019).

The zip is pinned by checksum; the site's file keeps the last 55,000 years, the reach of the
radiocarbon calibration curves, youngest first.
"""

import datetime as dt
import io
import json
import urllib.request
import zipfile
from typing import TYPE_CHECKING

from histeclipse_pipeline.sky import verified

if TYPE_CHECKING:
    from pathlib import Path

    from histeclipse_pipeline.sky import Json

GGF100K_URL = "https://earthref.org/ERDA/download:2382/"
GGF100K_SHA256 = "b33fe63b20abf01ced3b0106e279abfb9223add86c5c5e020a383e84dd3f1293"
SERIES_MEMBER = "GGF100k_model/DM_GGF100k.dat"
#: How far back the site's file reaches, ka: the calibration curves' reach.
REACH_KA = 55.0
USER_AGENT = "histeclipse-pipeline (https://github.com/serroba/histeclipse)"


def parse_series(text: str) -> list[tuple[float, float]]:
    """Read the ``Age [ka BP]  DM [x10^22 Am^2]`` table: (ka, dipole) rows, youngest first."""
    rows: list[tuple[float, float]] = []
    for line in text.splitlines():
        parts = line.split()
        if len(parts) != 2 or not parts[0][0].isdigit():  # noqa: PLR2004
            continue
        rows.append((float(parts[0]), float(parts[1])))
    if not rows:
        msg = "no rows in the dipole series"
        raise ValueError(msg)
    rows.sort()
    if len({ka for ka, _ in rows}) != len(rows):
        msg = "an age appears twice"
        raise ValueError(msg)
    return rows


def dipole_file(rows: list[tuple[float, float]], accessed: str) -> dict[str, Json]:
    """Build the site's file: the series within reach, as columns."""
    kept = [(ka, dipole) for ka, dipole in rows if ka <= REACH_KA]
    return {
        "schemaVersion": 1,
        "accessed": accessed,
        "credit": (
            "GGF100k (Panovska, Constable & Korte 2018), dipole moment every 50 years, "
            "EarthRef ERDA 2382; no licence stated, cited as the published result"
        ),
        "source": "https://doi.org/10.1029/2018GC007966",
        "ka": [ka for ka, _ in kept],
        "dipole": [round(dipole, 4) for _, dipole in kept],
    }


def series_from_zip(data: bytes) -> str:
    """Read the dipole-moment table out of the model's zip."""
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        return archive.read(SERIES_MEMBER).decode()


def _download(url: str) -> bytes:  # pragma: no cover - needs network access
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})  # noqa: S310
    with urllib.request.urlopen(request, timeout=120) as response:  # noqa: S310  # pyright: ignore[reportAny]
        body: object = response.read()  # pyright: ignore[reportAny]
    if not isinstance(body, bytes):
        msg = f"{url}: expected bytes"
        raise TypeError(msg)
    return body


def fetch_dipole(path: Path) -> int:  # pragma: no cover - needs network access
    """Download GGF100k, check it against its pinned checksum, and write the site's file."""
    data = verified(_download(GGF100K_URL), GGF100K_SHA256, "GGF100k")
    rows = parse_series(series_from_zip(data))
    made = dt.datetime.now(tz=dt.UTC).date().isoformat()
    built = dipole_file(rows, made)
    path.parent.mkdir(parents=True, exist_ok=True)
    _ = path.write_text(json.dumps(built, separators=(",", ":")) + "\n")
    ka = built["ka"]
    return len(ka) if isinstance(ka, list) else 0
