"""Projected change in temperature and rain at 1.5, 2, 3 and 4 °C of global warming (#523).

The IPCC's Sixth Assessment Report (AR6), Working Group I, Chapter 4 (Lee et al. 2021, *Future
Global Climate: Scenario-Based Projections and Near-Term Information*,
doi:10.1017/9781009157896.006), Figures 4.31 and 4.32: the CMIP6 multi-model mean change in
annual mean near-surface air temperature (°C) and in annual precipitation (%) at 1.5, 2, 3 and
4 °C of global warming, against 1850-1900. Each model's change is taken over the 20 years in
which it reaches the warming level, pooling the Tier-1 SSP scenarios: a warming level, not a
year. The figures' data are on the CEDA archive (Fischer 2023, v20230531, CC BY 4.0):
doi:10.5285/8fa708d0474d4a3caa5c9f645a89d282 for temperature and
doi:10.5285/0192ae3037794e0eb93b022c5140f399 for precipitation. The Interactive Atlas maps the
same kind of change by warming level from its own gridded CMIP6 archive (tens of gigabytes,
monthly, model by model); these files are already one 1° map per level, some 5 MB each.

Each file holds one panel, a 1° grid of cell centres (latitude -89.5 to 89.5, longitude 0.5 to
359.5), classic NetCDF-3 (read with ``cesm.read_netcdf3``), with:

- ``tas`` or ``pr``: the multi-model mean change;
- ``hatch``: 1 where the change is not robust: fewer than 66% of the models show a change
  larger than internal variability (the figures' diagonal lines);
- ``crosshatch``: 1 where the signals conflict: at least 66% of the models show a change larger
  than internal variability, but fewer than 80% agree on its sign (the crossed lines);
- ``model_nr``: how many model simulations the mean pools.

The maps are packed like the measured warming's (``measured_warming.py``), on the same
node-registered 1° grid (``krapp.regrid``), so the globe's shader reads them the same way and
shows the change as R - G, on the same scale:

- R: the change, °C or %, as a byte from ``low`` to ``high``;
- G: 0, no change, on the same scale;
- B, A: 255 (the projections cover the whole globe, sea included).

The robustness is a greyscale image per variable and level, a node taking the category most of
its cells have: 0 robust, 128 no robust change (hatched), 255 conflicting signals
(cross-hatched).

When each level is reached depends on the scenario: the index carries the report's Table 4.5,
the assessed 20-year period in which each level is first crossed in each SSP, with its very
likely (5-95%) range, or none where it is not crossed by 2100. Typed from the chapter.
"""

import io
import json
import math
import urllib.request
from dataclasses import dataclass
from typing import TYPE_CHECKING

import numpy as np
from PIL import Image

from histeclipse_pipeline.cesm import read_netcdf3
from histeclipse_pipeline.krapp import Grid, regrid, to_png
from histeclipse_pipeline.paleotemp import COLUMNS, ROWS
from histeclipse_pipeline.sky import Json, verified

if TYPE_CHECKING:
    from collections.abc import Callable, Mapping
    from pathlib import Path

SOURCE = "https://doi.org/10.1017/9781009157896.006"
BASE_URL = "https://dap.ceda.ac.uk/badc/ar6_wg1/data/ch_04/ch4_fig{figure}/v20230531/"
FILE_NAME = "Data_shown_in_figure_panel_{panel}.nc"
CREDIT = (
    "IPCC AR6 WGI Chapter 4 (Lee et al. 2021, Future Global Climate: Scenario-Based Projections "
    "and Near-Term Information), data for Figures 4.31 and 4.32 (Fischer 2023, CEDA, v20230531), "
    "CC BY 4.0: CMIP6 multi-model mean change at each global warming level against 1850-1900, "
    "with the report's robustness categories; averaged onto a 1° grid and packed into 8-bit "
    "images for this site"
)
LICENCE = "CC BY 4.0"
BASELINE = "1850\u20131900"
#: Global warming levels, °C above 1850-1900, and the panel of each figure that shows them.
LEVELS: tuple[tuple[float, str], ...] = ((1.5, "a"), (2.0, "b"), (3.0, "c"), (4.0, "d"))
#: Above this a value is NetCDF's fill (1e36), not data.
FILL = 1e30
#: The robustness categories' bytes.
ROBUST, NOT_ROBUST, CONFLICTING = 0, 128, 255


@dataclass(frozen=True, slots=True)
class Variable:
    """One figure's field: its name in the files, the figure, its units, the pinned files."""

    id: str
    field: str
    figure: int
    units: str
    #: Of the scale's ends, round outward to a multiple of this.
    step: float
    #: SHA-256 of panels a-d, in order.
    sha256: tuple[str, str, str, str]


TEMPERATURE = Variable(
    id="temperature",
    field="tas",
    figure=31,
    units="°C",
    step=1.0,
    sha256=(
        "29f225738fc6f6ea3defb645c8da4b1efe421160fdfe7afa1487cc50acf90b2b",
        "246f5fee5e0722fed9c1deaf194de88328bbcffa4d0ff33666bae64d371a24e5",
        "6fba1ef468901cd147d183245aee46eedac6f91a90ebb0dfcc61807e3088d09e",
        "848134d4d2f0a759337d5374885652672613653703edf76ed4b52c760681ffd6",
    ),
)
PRECIPITATION = Variable(
    id="precipitation",
    field="pr",
    figure=32,
    units="%",
    step=10.0,
    sha256=(
        "658aefbfd7da18cd67e5612f33b7ec2e9c3783a0cb49d57e1fc3c2351261831d",
        "78d500f60c4e5e3e26220559ed8ced1966302b3f1d1c6797b8ba65c36c1ce469",
        "2fed6132de60d16c79dc8937c09b2416d60c121de8af068ae8b5ca38141370f9",
        "aa32f6fe29243e5ede744f101226092626cf67ba079dc74cef785992330145eb",
    ),
)
VARIABLES = (TEMPERATURE, PRECIPITATION)

#: A period of first crossing, first and last year, or None where not crossed by 2100.
type Period = tuple[int, int] | None
#: Table 4.5: for each level and scenario, the central estimate and the very likely range's
#: early and late ends, each the 20-year period in which the level is first crossed.
CROSSING: Mapping[float, Mapping[str, tuple[Period, Period, Period]]] = {
    1.5: {
        "SSP1-1.9": ((2025, 2044), (2013, 2032), None),
        "SSP1-2.6": ((2023, 2042), (2012, 2031), None),
        "SSP2-4.5": ((2021, 2040), (2012, 2031), (2037, 2056)),
        "SSP3-7.0": ((2021, 2040), (2013, 2032), (2033, 2052)),
        "SSP5-8.5": ((2018, 2037), (2011, 2030), (2029, 2048)),
    },
    2.0: {
        "SSP1-1.9": (None, None, None),
        "SSP1-2.6": (None, (2031, 2050), None),
        "SSP2-4.5": ((2043, 2062), (2028, 2047), (2075, 2094)),
        "SSP3-7.0": ((2037, 2056), (2026, 2045), (2053, 2072)),
        "SSP5-8.5": ((2032, 2051), (2023, 2042), (2044, 2063)),
    },
    3.0: {
        "SSP1-1.9": (None, None, None),
        "SSP1-2.6": (None, None, None),
        "SSP2-4.5": (None, (2061, 2080), None),
        "SSP3-7.0": ((2066, 2085), (2050, 2069), None),
        "SSP5-8.5": ((2055, 2074), (2042, 2061), (2074, 2093)),
    },
    4.0: {
        "SSP1-1.9": (None, None, None),
        "SSP1-2.6": (None, None, None),
        "SSP2-4.5": (None, None, None),
        "SSP3-7.0": (None, (2070, 2089), None),
        "SSP5-8.5": ((2075, 2094), (2058, 2077), None),
    },
}


@dataclass(frozen=True, slots=True)
class Panel:
    """One level's map as read: the change, the two robustness flags, the simulations pooled."""

    change: Grid
    hatch: Grid
    crosshatch: Grid
    models: int
    latitude: Grid
    longitude: Grid


def _layer(values: Grid, name: str) -> Grid:
    """Drop the panel axis of a (1, lat, lon) field; fill becomes NaN."""
    if values.ndim != 3 or values.shape[0] != 1:  # noqa: PLR2004 - (panel, lat, lon)
        msg = f"{name}: expected one panel, got shape {values.shape}"
        raise ValueError(msg)
    layer: Grid = np.squeeze(values, axis=0)
    return np.asarray(np.where(np.abs(layer) > FILL, np.nan, layer), dtype=np.float64)


def read_panel(data: bytes, field: str) -> Panel:
    """Read one panel's file: the change in ``field``, its flags and the number of models."""
    variables = read_netcdf3(data)
    if field not in variables:
        msg = f"no {field} in the file (has {sorted(variables)})"
        raise ValueError(msg)
    return Panel(
        change=_layer(variables[field], field),
        hatch=_layer(variables["hatch"], "hatch"),
        crosshatch=_layer(variables["crosshatch"], "crosshatch"),
        models=round(variables["model_nr"].item(0)),
        latitude=variables["lat"],
        longitude=variables["lon"],
    )


def robustness(panel: Panel) -> Grid:
    """Categorise each node: conflicting, not robust (hatched) or robust, as most cells are.

    The bytes are 255, 128 and 0; conflicting wins where a node's cells are both.
    """
    hatch = regrid(panel.hatch, panel.latitude, panel.longitude)
    cross = regrid(panel.crosshatch, panel.latitude, panel.longitude)
    category = np.where(hatch >= 0.5, NOT_ROBUST, ROBUST)  # noqa: PLR2004 - most of its cells
    category = np.where(cross >= 0.5, CONFLICTING, category)  # noqa: PLR2004
    return np.asarray(category, dtype=np.float64)


def robustness_png(category: Grid) -> bytes:
    """Write the categories as an optimised greyscale PNG, north at the top."""
    out = io.BytesIO()
    Image.fromarray(category.astype(np.uint8), mode="L").save(out, format="PNG", optimize=True)
    return out.getvalue()


def area_mean(values: Grid, latitude: Grid) -> float:
    """Area-weighted (cos latitude) mean over the cells with data."""
    weights = np.broadcast_to(np.cos(np.radians(latitude))[:, None], values.shape)
    valid = np.isfinite(values)
    mean: np.float64 = np.average(values[valid], weights=weights[valid])
    return float(mean)


def scale(grids: list[Grid], step: float) -> tuple[float, float]:
    """Find the scale's ends over every grid, rounded outward to ``step``, with 0 between."""
    low = min(0.0, *(float(np.nanmin(grid)) for grid in grids))
    high = max(0.0, *(float(np.nanmax(grid)) for grid in grids))
    return math.floor(low / step) * step, math.ceil(high / step) * step


def file_name(variable: str, level: float, suffix: str = "") -> str:
    """Name a map by its variable and level, e.g. ``temperature-1.5.png``."""
    return f"{variable}-{level:g}{suffix}.png"


def _period(period: Period) -> Json:
    return None if period is None else [period[0], period[1]]


def crossing_of(level: float) -> list[Json]:
    """Table 4.5's row for a level: each scenario's central period and very likely range."""
    return [
        {
            "scenario": scenario,
            "central": _period(central),
            "early": _period(early),
            "late": _period(late),
        }
        for scenario, (central, early, late) in CROSSING[level].items()
    ]


def write_variable(
    variable: Variable, panels: list[tuple[float, Panel]], folder: Path
) -> dict[str, Json]:
    """Regrid and write one variable's maps and robustness images; describe them."""
    grids = [
        (level, regrid(panel.change, panel.latitude, panel.longitude)) for level, panel in panels
    ]
    low, high = scale([grid for _, grid in grids], variable.step)
    zero = np.zeros((ROWS, COLUMNS))
    levels: list[Json] = []
    for (level, grid), (_, panel) in zip(grids, panels, strict=True):
        _ = (folder / file_name(variable.id, level)).write_bytes(to_png(grid, zero, low, high))
        robust = file_name(variable.id, level, "-robustness")
        _ = (folder / robust).write_bytes(robustness_png(robustness(panel)))
        levels.append(
            {
                "level": level,
                "file": file_name(variable.id, level),
                "robustness": robust,
                "mean": round(area_mean(panel.change, panel.latitude), 2),
                "models": panel.models,
            }
        )
    return {"units": variable.units, "low": low, "high": high, "levels": levels}


def build(read: Callable[[Variable, str, str], bytes], folder: Path) -> int:
    """Write every map and the index; ``read`` gives a panel file's bytes, checked."""
    folder.mkdir(parents=True, exist_ok=True)
    variables: dict[str, Json] = {}
    count = 0
    for variable in VARIABLES:
        panels = [
            (level, read_panel(read(variable, panel, sha), variable.field))
            for (level, panel), sha in zip(LEVELS, variable.sha256, strict=True)
        ]
        variables[variable.id] = write_variable(variable, panels, folder)
        count += 2 * len(panels)
    index = index_file(variables)
    _ = (folder / "index.json").write_text(json.dumps(index, separators=(",", ":")) + "\n")
    return count


def index_file(variables: dict[str, Json]) -> dict[str, Json]:
    """Build the manifest the web app reads: credit, baseline, encoding, grid, maps, timing."""
    return {
        "schemaVersion": 1,
        "credit": CREDIT,
        "source": SOURCE,
        "data": [BASE_URL.format(figure=variable.figure) for variable in VARIABLES],
        "licence": LICENCE,
        "baseline": BASELINE,
        "statistic": "CMIP6 multi-model mean over the 20 years each model is at the level",
        "coverage": "global",
        "mean": (
            "area-weighted (cos latitude) mean of the source's 1° cells over the globe; for "
            "precipitation a mean of local % changes, not the % change of global precipitation"
        ),
        "columns": COLUMNS,
        "rows": ROWS,
        "robustness": {
            "robust": ROBUST,
            "notRobust": NOT_ROBUST,
            "conflicting": CONFLICTING,
        },
        "variables": variables,
        "crossing": {
            "note": (
                "IPCC AR6 WGI Table 4.5: the 20-year period in which the 20-year mean first "
                "exceeds each level, central estimate and very likely (5-95%) range; null where "
                "not crossed by 2100"
            ),
            "levels": [{"level": level, "scenarios": crossing_of(level)} for level, _ in LEVELS],
        },
    }


def _download(url: str) -> bytes:  # pragma: no cover - needs network access
    request = urllib.request.Request(url, headers={"User-Agent": "histeclipse-pipeline"})  # noqa: S310
    with urllib.request.urlopen(request, timeout=900) as response:  # noqa: S310  # pyright: ignore[reportAny]
        body: object = response.read()  # pyright: ignore[reportAny]
    if not isinstance(body, bytes):
        msg = f"{url}: expected bytes"
        raise TypeError(msg)
    return body


def fetch_warming_levels(folder: Path) -> int:  # pragma: no cover - needs network access
    """Download the eight panel files (checked against their pinned checksums); write maps."""

    def read(variable: Variable, panel: str, sha256: str) -> bytes:
        name = FILE_NAME.format(panel=panel)
        url = BASE_URL.format(figure=variable.figure) + name
        return verified(_download(url), sha256, f"Figure 4.{variable.figure} {name}")

    return build(read, folder)
