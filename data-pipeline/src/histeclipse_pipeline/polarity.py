"""The geomagnetic polarity time scale of GTS 2020 (Ogg 2020): every reversal of the last 83 Ma.

PmagPy (Tauxe et al. 2016, BSD-3-Clause), the paleomagnetists' own toolkit, carries the scale
as a literal list in ``pmag.get_ts("gts20")``: the ages of the reversals from today back to the
start of the Cretaceous Normal Superchron, and the chrons' names. The file is fetched at a pinned
commit, checked by checksum, and the two lists are read from its syntax tree; nothing in it is
run. Today's field is normal, and each reversal swaps it.
"""

import ast
import datetime as dt
import json
import urllib.request
from dataclasses import dataclass
from typing import TYPE_CHECKING, cast

from histeclipse_pipeline.sky import verified

if TYPE_CHECKING:
    from pathlib import Path

    from histeclipse_pipeline.sky import Json

PMAGPY_COMMIT = "da2051757f7d7f6d8fada0f552c5fa4e0bb3e7f7"
PMAG_URL = f"https://raw.githubusercontent.com/PmagPy/PmagPy/{PMAGPY_COMMIT}/pmagpy/pmag.py"
PMAG_SHA256 = "4f2ea9750e6107b83a83c713687d7b7e67f21310a6277a597ac8648dd0eaa7a7"
SCALE = "gts20"


@dataclass(frozen=True)
class PolarityScale:
    """Reversal ages, Ma, youngest first from 0, and each chron's name and young edge."""

    boundaries: tuple[float, ...]
    chrons: tuple[tuple[str, float], ...]


def _literal(node: ast.expr) -> object:
    return cast("object", ast.literal_eval(node))


def read_scale(source: str, scale: str = SCALE) -> PolarityScale:
    """Read a scale's lists from ``get_ts`` in PmagPy's source, by its syntax tree alone."""
    tree = ast.parse(source)
    get_ts = next(
        (node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == "get_ts"),
        None,
    )
    if get_ts is None:
        msg = "no get_ts in the source"
        raise ValueError(msg)
    for node in get_ts.body:
        if not (isinstance(node, ast.If) and isinstance(node.test, ast.Compare)):
            continue
        [compared] = node.test.comparators
        if not (isinstance(compared, ast.Constant) and compared.value == scale):
            continue
        found: dict[str, object] = {}
        for statement in node.body:
            if isinstance(statement, ast.Assign) and isinstance(statement.targets[0], ast.Name):
                found[statement.targets[0].id] = _literal(statement.value)
        return checked(found.get("TS"), found.get("Labels"))
    msg = f"no {scale} scale in get_ts"
    raise ValueError(msg)


def checked(ages: object, labels: object) -> PolarityScale:
    """Check the lists: ages from 0, rising; each chron a name and an age."""
    if not isinstance(ages, list) or not isinstance(labels, list):
        msg = "the scale's ages and labels are lists"
        raise TypeError(msg)
    boundaries = tuple(float(cast("float", age)) for age in cast("list[object]", ages))
    if not boundaries or boundaries[0] != 0 or list(boundaries) != sorted(set(boundaries)):
        msg = "reversal ages start at 0 and rise"
        raise ValueError(msg)
    chrons: list[tuple[str, float]] = []
    for label in cast("list[object]", labels):
        name, young = cast("list[object]", label)
        if not isinstance(name, str) or not isinstance(young, int | float):
            msg = f"a chron is a name and an age: {label!r}"
            raise TypeError(msg)
        chrons.append((name, float(young)))
    return PolarityScale(boundaries, tuple(chrons))


def polarity_file(scale: PolarityScale, accessed: str) -> dict[str, Json]:
    """Build the site's file: the reversal ages and the chrons."""
    return {
        "schemaVersion": 1,
        "credit": "Geomagnetic polarity time scale of GTS 2020 (Ogg 2020), as carried by PmagPy",
        "source": f"https://github.com/PmagPy/PmagPy/blob/{PMAGPY_COMMIT}/pmagpy/pmag.py",
        "accessed": accessed,
        "boundaries": list(scale.boundaries),
        "chrons": [{"name": name, "young": young} for name, young in scale.chrons],
    }


def _download(url: str) -> bytes:  # pragma: no cover - needs network access
    with urllib.request.urlopen(url, timeout=60) as response:  # noqa: S310  # pyright: ignore[reportAny]
        body: object = response.read()  # pyright: ignore[reportAny]
    if not isinstance(body, bytes):
        msg = f"{url}: expected bytes"
        raise TypeError(msg)
    return body


def fetch_polarity(path: Path) -> int:  # pragma: no cover - needs network access
    """Download PmagPy's source at the pinned commit, check it, and write the scale."""
    source = verified(_download(PMAG_URL), PMAG_SHA256, "PmagPy pmag.py").decode()
    scale = read_scale(source)
    path.parent.mkdir(parents=True, exist_ok=True)
    made = dt.datetime.now(tz=dt.UTC).date().isoformat()
    _ = path.write_text(json.dumps(polarity_file(scale, made), separators=(",", ":")) + "\n")
    return len(scale.boundaries) - 1
