"""Local excerpts of the JPL DE441 planetary ephemeris.

DE441 is a 3.3 GB file covering -13200 to +17191. We only need the Sun, Earth and
Moon, so we download just those segments for the years we need, using HTTP range
requests.

DE441 stores every body as two segments split at 1969-06-28, while Skyfield's search
routines use a single segment per body. `Ephemeris` joins the pieces back together:
each body is exposed as one `RoutedSegment` that sends every date to the piece that
covers it, so searches run straight across the split.
"""

import itertools
from collections import defaultdict
from dataclasses import dataclass
from typing import TYPE_CHECKING, Self

import numpy as np
from jplephem.daf import DAF
from jplephem.excerpter import RemoteFile, write_excerpt
from jplephem.spk import SPK, BaseSegment, Segment, Type9Segment

if TYPE_CHECKING:
    from collections.abc import Iterable, Sequence
    from pathlib import Path
    from types import TracebackType

    from jplephem.daf import ReadableFile

DE441_URL = "https://ssd.jpl.nasa.gov/ftp/eph/planets/bsp/de441.bsp"

# Julian Day (TDB) where DE441's two segment sets meet: 1969-06-28.
DE441_SPLIT_JD = 2_440_432.5

# NAIF ids: Earth-Moon barycenter, Sun, Moon, Earth.
TARGETS = frozenset({3, 10, 301, 399})

type FloatArray = np.typing.NDArray[np.float64]


@dataclass(frozen=True, slots=True)
class Kernel:
    """An excerpt file that is valid for Julian Days in ``[start_jd, end_jd)``."""

    path: Path
    start_jd: float
    end_jd: float


def excerpt(source: ReadableFile, directory: Path, start_jd: float, end_jd: float) -> list[Kernel]:
    """Write excerpts of ``source`` covering ``[start_jd, end_jd)`` into ``directory``.

    Produces one file for each side of the DE441 split that the range touches.
    """
    if start_jd >= end_jd:
        msg = f"Empty range [{start_jd}, {end_jd})"
        raise ValueError(msg)
    spk = SPK(DAF(source))
    pairs = list(zip(spk.daf.summaries(), spk.segments, strict=True))
    kernels: list[Kernel] = []
    for low, high in (
        (start_jd, min(end_jd, DE441_SPLIT_JD)),
        (max(start_jd, DE441_SPLIT_JD), end_jd),
    ):
        if low >= high:
            continue
        chosen = [
            (summary, segment)
            for summary, segment in pairs
            if segment.target in TARGETS and segment.start_jd < high and segment.end_jd > low
        ]
        if sorted(segment.target for _, segment in chosen) != sorted(TARGETS):
            msg = f"Source must hold exactly one segment per target in [{low}, {high})"
            raise ValueError(msg)
        path = directory / f"de441_{low:.1f}_{high:.1f}.bsp"
        with path.open("w+b") as output:
            write_excerpt(spk, output, low, high, [summary for summary, _ in chosen])
        kernels.append(Kernel(path=path, start_jd=low, end_jd=high))
    return kernels


def fetch_de441(
    directory: Path, start_jd: float, end_jd: float
) -> list[Kernel]:  # pragma: no cover
    """Download DE441 excerpts from JPL. Needs network access, so it is run by hand, not in CI."""
    directory.mkdir(parents=True, exist_ok=True)
    with RemoteFile(DE441_URL) as remote:
        return excerpt(remote, directory, start_jd, end_jd)


@dataclass(frozen=True, slots=True)
class RoutedSegment:
    """Consecutive segments of one body, presented as a single jplephem-style segment."""

    center: int
    target: int
    pieces: tuple[Segment, ...]

    @property
    def start_jd(self) -> float:
        """First Julian Day covered."""
        return self.pieces[0].start_jd

    @property
    def end_jd(self) -> float:
        """Last Julian Day covered."""
        return self.pieces[-1].end_jd

    @property
    def spk_segment(self) -> Self:
        """Lets Skyfield's search routines use this object directly as an SPK segment."""
        return self

    def compute(self, tdb: FloatArray | float, tdb2: FloatArray | float = 0.0) -> FloatArray:
        """Position in km, taken from whichever piece covers each date."""
        return self._route(tdb, tdb2, differentiate=False)[0]

    def compute_and_differentiate(
        self, tdb: FloatArray | float, tdb2: FloatArray | float = 0.0
    ) -> tuple[FloatArray, FloatArray]:
        """Position in km and velocity in km/day."""
        return self._route(tdb, tdb2, differentiate=True)

    def _route(
        self, tdb: FloatArray | float, tdb2: FloatArray | float, *, differentiate: bool
    ) -> tuple[FloatArray, FloatArray]:
        whole = np.atleast_1d(np.asarray(tdb, dtype=np.float64))
        fraction = np.broadcast_to(np.asarray(tdb2, dtype=np.float64), whole.shape)
        jd = whole + fraction
        position = np.full((3, *whole.shape), np.nan)
        velocity = np.full((3, *whole.shape), np.nan)
        for index, piece in enumerate(self.pieces):
            is_last = index == len(self.pieces) - 1
            mask = (jd >= piece.start_jd) & (
                (jd <= piece.end_jd) if is_last else (jd < piece.end_jd)
            )
            if not mask.any():
                continue
            if differentiate:
                position[:, mask], velocity[:, mask] = piece.compute_and_differentiate(
                    whole[mask], fraction[mask]
                )
            else:
                position[:, mask] = piece.compute(whole[mask], fraction[mask])
        if np.isnan(position).any():
            msg = (
                f"Dates outside ephemeris coverage [{self.start_jd}, {self.end_jd}] "
                f"for target {self.target}"
            )
            raise ValueError(msg)
        if np.ndim(tdb) == 0:
            return position[:, 0], velocity[:, 0]
        return position, velocity


class Ephemeris:
    """Sun, Earth and Moon positions from one or more DE441 excerpt kernels."""

    def __init__(self, paths: Iterable[Path]) -> None:
        """Open the kernels and join each body's segments into one continuous segment."""
        self._spks: list[SPK] = []
        try:
            for path in paths:
                self._spks.append(SPK.open(str(path)))
            grouped: defaultdict[tuple[int, int], list[Segment]] = defaultdict(list)
            for spk in self._spks:
                for segment in map(require_chebyshev, spk.segments):
                    grouped[segment.center, segment.target].append(segment)
            self.segments: Sequence[RoutedSegment] = [
                RoutedSegment(center, target, _contiguous(pieces))
                for (center, target), pieces in sorted(grouped.items())
            ]
        except BaseException:
            self.close()
            raise

    def __enter__(self) -> Self:
        """Use as a context manager so the kernel files get closed."""
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        """Close the kernel files."""
        self.close()

    def close(self) -> None:
        """Close the kernel files."""
        for spk in self._spks:
            spk.close()

    def segment(self, center: int, target: int) -> RoutedSegment:
        """Return the joined segment for ``target`` relative to ``center``."""
        for segment in self.segments:
            if (segment.center, segment.target) == (center, target):
                return segment
        msg = f"No segment for target {target} relative to {center}"
        raise KeyError(msg)

    @property
    def start_jd(self) -> float:
        """First Julian Day every body covers."""
        return max(segment.start_jd for segment in self.segments)

    @property
    def end_jd(self) -> float:
        """Last Julian Day every body covers."""
        return min(segment.end_jd for segment in self.segments)


def require_chebyshev(segment: Segment | Type9Segment | BaseSegment) -> Segment:
    """Accept only Chebyshev position segments, the kind DE441 uses for every body."""
    if not isinstance(segment, Segment):
        msg = f"Unsupported SPK segment type {segment.data_type} for target {segment.target}"
        raise TypeError(msg)
    return segment


def _contiguous(pieces: list[Segment]) -> tuple[Segment, ...]:
    ordered = tuple(sorted(pieces, key=lambda piece: piece.start_jd))
    for before, after in itertools.pairwise(ordered):
        if before.end_jd != after.start_jd:
            msg = f"Segments for target {before.target} leave a gap or overlap at {before.end_jd}"
            raise ValueError(msg)
    return ordered
