import numpy as np
import numpy.typing as npt
from jplephem.daf import DAF

type _Float = float | npt.NDArray[np.float64]

type Descriptor = tuple[float, float, int, int, int, int, int, int]

class BaseSegment:
    def __init__(self, daf: DAF, source: bytes, descriptor: Descriptor) -> None: ...
    center: int
    target: int
    frame: int
    data_type: int
    start_jd: float
    end_jd: float

class Segment(BaseSegment):
    # Chebyshev position segment (SPK types 2 and 3), which DE441 uses for every body.

    def compute(self, tdb: _Float, tdb2: _Float = 0.0) -> npt.NDArray[np.float64]: ...
    def compute_and_differentiate(
        self, tdb: _Float, tdb2: _Float = 0.0
    ) -> tuple[npt.NDArray[np.float64], npt.NDArray[np.float64]]: ...

class Type9Segment(BaseSegment): ...

class SPK:
    daf: DAF
    segments: list[Segment | Type9Segment | BaseSegment]
    def __init__(self, daf: DAF) -> None: ...
    @classmethod
    def open(cls, path: str) -> SPK: ...
    def close(self) -> None: ...
