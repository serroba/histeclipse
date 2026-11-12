"""Shared steps for the water-cycle maps and curves (#530): trends, the 1° grid, the images.

Precipitation (``precipitation.py``), temperature and rain extremes (``extremes.py``) and
drought (``drought.py``) come from different sources on different grids. Each is brought onto
the same node-registered 1° grid as the other maps (``krapp``), one field per year, and then
measured the same way:

- a trend: the least-squares slope of each node's yearly values over a window, per decade,
  kept where the node has data in at least two thirds of the window's years;
- its significance: whether the slope differs from none at the 10% level (two-sided), with the
  sample shrunk for the residuals' lag-1 autocorrelation (Santer et al. 2000, *Statistical
  significance of trends and trend differences in layer-average atmospheric temperature time
  series*, JGR 105, 7337), as AR6's maps of observed change mark it;
- a curve: the area-weighted (cos latitude) mean over a fixed set of nodes, year by year.

Each trend map is packed as an RGBA PNG, north at the top:

- R: the trend, as a byte from ``-bound`` (0) to ``+bound`` (255), clipped;
- G: no trend (0), on the same scale (128), so the shader can show the change as R - G;
- B: 255 where the trend is significant at the 10% level;
- A: 255 where the node has a trend.
"""

import io
import math
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING

import numpy as np
import numpy.typing as npt
from PIL import Image

from histeclipse_pipeline.krapp import Grid, channels, node_latitudes, node_longitudes, regrid

if TYPE_CHECKING:
    from collections.abc import Iterable, Sequence

    from histeclipse_pipeline.sky import Json

type Mask = npt.NDArray[np.bool_]

#: The share of a window's years a node needs for a trend.
NEEDED = 2 / 3
#: Two-sided significance level of the trends.
LEVEL = 0.10
#: The standard normal's quantile for it, 1 - LEVEL / 2.
_Z = 1.6448536269514722
#: The fewest effective years a trend's significance is judged on.
_FEWEST = 3.0
#: Years in a decade: trends are given per decade.
DECADE = 10
#: The trend percentile that sets a map's colour bound; the few beyond are clipped.
CLIP_PERCENTILE = 98


@dataclass(frozen=True)
class Trend:
    """Each node's slope per decade (NaN where too few years) and whether it is significant."""

    slope: Grid
    significant: Mask


def critical_t(freedom: Grid) -> Grid:
    """Student's t at ``1 - LEVEL / 2`` for ``freedom`` degrees of freedom (Cornish-Fisher).

    Two terms of the expansion about the normal quantile: within 0.1% of the exact value from
    ten degrees of freedom up, a little low below (2.31 for 2.35 at three).
    """
    z = _Z
    first = (z**3 + z) / (4 * freedom)
    second = (5 * z**5 + 16 * z**3 + 3 * z) / (96 * freedom**2)
    return np.asarray(z + first + second, dtype=np.float64)


def trend(years: Sequence[int], fields: Grid, needed: float = NEEDED) -> Trend:
    """Fit a line through each node's years (``fields`` is years first); slope per decade.

    Where a node has data in fewer than ``needed`` of the years, its slope is NaN.
    """
    if len(years) != fields.shape[0]:
        msg = f"{len(years)} years for {fields.shape[0]} fields"
        raise ValueError(msg)
    x = np.asarray(years, dtype=np.float64).reshape((-1,) + (1,) * (fields.ndim - 1))
    valid = np.isfinite(fields)
    y = np.where(valid, fields, 0.0)
    weight = valid.astype(np.float64)
    count = weight.sum(axis=0)
    with np.errstate(invalid="ignore", divide="ignore"):
        x_mean = (weight * x).sum(axis=0) / count
        y_mean = y.sum(axis=0) / count
        dx = weight * (x - x_mean)
        sxx = (dx * dx).sum(axis=0)
        slope = (dx * (y - y_mean)).sum(axis=0) / sxx
        residual = weight * (y - y_mean - slope * (x - x_mean))
        sse = (residual * residual).sum(axis=0)
        # Lag-1 autocorrelation of the residuals, over consecutive pairs with data.
        lag = (residual[1:] * residual[:-1]).sum(axis=0) / sse
        lag = np.clip(np.nan_to_num(lag), 0.0, 0.99)
        effective = np.asarray(np.maximum(count * (1 - lag) / (1 + lag), _FEWEST), np.float64)
        error = np.asarray(np.sqrt(sse / (effective - 2) / sxx), dtype=np.float64)
        t = np.abs(slope) / error
        critical = critical_t(effective - 2)
    enough = (count >= needed * len(years)) & (sxx > 0)
    significant: Mask = enough & np.isfinite(t) & np.greater(t, critical)
    # A perfectly straight line has no error: it is as significant as a slope can be.
    significant |= enough & np.equal(sse, 0) & np.not_equal(slope, 0)
    per_decade = np.where(enough, slope * DECADE, np.nan)
    return Trend(np.asarray(per_decade, dtype=np.float64), np.asarray(significant))


def nearest(values: Grid, latitude: Grid, longitude: Grid) -> Grid:
    """Give each 1° node the value of the source cell whose centre is nearest (coarse grids).

    ``values`` is indexed (..., latitude, longitude); longitude wraps round.
    """
    rows = np.abs(node_latitudes()[:, None] - latitude[None, :]).argmin(axis=1)
    apart = np.abs((node_longitudes()[:, None] - longitude[None, :] + 180) % 360 - 180)
    columns = apart.argmin(axis=1)
    picked = values[..., rows[:, None], columns[None, :]]
    return np.asarray(picked, dtype=np.float64)


def to_nodes(values: Grid, latitude: Grid, longitude: Grid) -> Grid:
    """Bring yearly fields (years first) onto the 1° nodes.

    Grids of a degree or finer are averaged around each node (``krapp.regrid``); coarser ones
    take the nearest cell, so a node is never left empty between coarse cell centres.
    """
    steps = np.asarray(np.fabs(np.diff(latitude)), dtype=np.float64)
    spacing = float(np.percentile(steps, 100))
    if spacing > 1:
        return nearest(values, latitude, longitude)
    return np.stack([regrid(field, latitude, longitude) for field in np.unstack(values)])


def area_weights() -> Grid:
    """Each node's weight in an area mean: cos latitude, and none for the repeated meridian."""
    weights = np.broadcast_to(np.cos(np.radians(node_latitudes()))[:, None], (181, 361)).copy()
    weights[:, -1] = 0.0
    weights[weights < 0] = 0.0
    return weights


def area_mean(field: Grid, where: Mask | None = None) -> float | None:
    """Average ``field`` by area over the nodes with data (and in ``where``); None if none."""
    weights = area_weights()
    keep = np.isfinite(field) & (weights > 0)
    if where is not None:
        keep &= where
    if not keep.any():
        return None
    mean: np.float64 = np.average(field[keep], weights=weights[keep])
    return float(mean)


def area_share(flags: Mask, where: Mask) -> float | None:
    """Measure the share of the area in ``where`` that ``flags`` covers."""
    return area_mean(np.where(where, flags.astype(np.float64), np.nan))


def anomalies(years: Sequence[int], fields: Grid, base: tuple[int, int], needed: float) -> Grid:
    """Subtract each node's mean over the ``base`` years; NaN where it has too few of them."""
    first, last = base
    picked = [index for index, year in enumerate(years) if first <= year <= last]
    window = fields[picked]
    known = np.isfinite(window)
    count = known.sum(axis=0)
    total = np.where(known, window, 0.0).sum(axis=0)
    with np.errstate(invalid="ignore", divide="ignore"):
        mean = np.where(count >= needed * (last - first + 1), total / count, np.nan)
    return np.asarray(fields - mean, dtype=np.float64)


def curve(
    years: Sequence[int], fields: Grid, where: Mask, digits: int = 2
) -> tuple[list[int], list[float]]:
    """Average each year's field over ``where`` by area; years with no data are left out."""
    kept_years: list[int] = []
    values: list[float] = []
    for year, field in zip(years, np.unstack(fields), strict=True):
        mean = area_mean(field, where)
        if mean is not None:
            kept_years.append(year)
            values.append(round(mean, digits))
    return kept_years, values


def symmetric_bound(grids: Iterable[Grid], step: float) -> float:
    """Bound the colours of trends of both signs: their 98th size percentile, rounded up."""
    sizes = np.asarray(
        np.concatenate([np.fabs(grid[np.isfinite(grid)]) for grid in grids]), dtype=np.float64
    )
    if sizes.size == 0:
        msg = "no trends to bound"
        raise ValueError(msg)
    top = float(np.percentile(sizes, CLIP_PERCENTILE))
    return max(step, math.ceil(round(top / step, 9)) * step)


def encode(found: Trend, bound: float) -> npt.NDArray[np.uint8]:
    """Pack a trend into RGBA: its byte, no trend's byte, significance, coverage."""
    value, mask = channels(found.slope, -bound, bound)
    zero = np.full(value.shape, round(0.5 * 255), dtype=np.uint8)
    flagged = np.where(found.significant & np.isfinite(found.slope), 255, 0).astype(np.uint8)
    return np.stack([value, zero, flagged, mask], axis=-1)


def decode(byte: int, bound: float) -> float:
    """Undo the trend byte: 0 is ``-bound`` and 255 is ``+bound``."""
    return -bound + byte / 255 * 2 * bound


def to_png(found: Trend, bound: float) -> bytes:
    """Write a trend map as an optimised RGBA PNG (see :func:`encode`)."""
    out = io.BytesIO()
    Image.fromarray(encode(found, bound)).save(out, format="PNG", optimize=True)
    return out.getvalue()


def layer(
    name: str, found: Trend, period: tuple[int, int], bound: float, digits: int
) -> dict[str, Json]:
    """Describe a trend map for the index: its file, period, colour bound and mean trend."""
    first, last = period
    mean = area_mean(found.slope)
    significant = area_share(found.significant, np.isfinite(found.slope))
    return {
        "id": name,
        "file": f"{name}.png",
        "period": [first, last],
        "bound": bound,
        "mean": None if mean is None else round(mean, digits),
        "significantShare": None if significant is None else round(significant, 2),
    }


def text(value: object, what: str) -> str:
    """Read a text attribute, which HDF5 gives as bytes or str; raise if it is neither."""
    if isinstance(value, bytes):
        return value.decode()
    if isinstance(value, str):
        return value
    msg = f"{what}: expected text"
    raise TypeError(msg)


def month_dates(units: str, values: Iterable[float]) -> list[tuple[int, int]]:
    """Turn CF times (``"hours since 2011-1-1 00:00:00"``, or days) into (year, month)."""
    unit, _, rest = units.partition(" since ")
    scale = {"hours": timedelta(hours=1), "days": timedelta(days=1)}.get(unit.strip())
    if scale is None or not rest:
        msg = f"unsupported time units {units!r}"
        raise ValueError(msg)
    year, month, day = (int(part) for part in rest.split()[0].split("-"))
    origin = datetime(year, month, day, tzinfo=UTC)
    out: list[tuple[int, int]] = []
    for value in values:
        moment = origin + scale * value
        out.append((moment.year, moment.month))
    return out
