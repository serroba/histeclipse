from typing import Protocol

import numpy as np
import numpy.typing as npt
from skyfield.timelib import Time

class SearchFunction(Protocol):
    # Sampling interval in days; find_minima reads it as an attribute of the function.
    step_days: float
    def __call__(self, t: Time, /) -> npt.NDArray[np.float64]: ...

def find_minima(
    start_time: Time, end_time: Time, f: SearchFunction, epsilon: float = ..., num: int = ...
) -> tuple[Time, npt.NDArray[np.float64]]: ...
