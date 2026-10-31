from collections.abc import Iterable
from typing import Protocol

import numpy as np
import numpy.typing as npt
from skyfield.timelib import Time

type _Float = float | npt.NDArray[np.float64]

class _ComputableSegment(Protocol):
    def compute(self, tdb: _Float, tdb2: _Float = ..., /) -> npt.NDArray[np.float64]: ...
    def compute_and_differentiate(
        self, tdb: _Float, tdb2: _Float = ..., /
    ) -> tuple[npt.NDArray[np.float64], npt.NDArray[np.float64]]: ...

class _EphemerisSegment(Protocol):
    @property
    def center(self) -> int: ...
    @property
    def target(self) -> int: ...
    @property
    def spk_segment(self) -> _ComputableSegment: ...

class _Ephemeris(Protocol):
    # What `lunar_eclipses` reads from an ephemeris:
    # segments for bodies 0->3, 0->10, 3->301 and 3->399.

    @property
    def segments(self) -> Iterable[_EphemerisSegment]: ...

LUNAR_ECLIPSES: list[str]

def lunar_eclipses(
    start_time: Time, end_time: Time, eph: _Ephemeris
) -> tuple[Time, npt.NDArray[np.int8], dict[str, npt.NDArray[np.float64]]]: ...
