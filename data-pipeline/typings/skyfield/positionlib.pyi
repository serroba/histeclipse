import numpy as np
import numpy.typing as npt
from skyfield.timelib import Time

class ICRF:
    center: int | None
    t: Time | None

def build_position(
    position_au: npt.NDArray[np.float64],
    velocity_au_per_d: npt.NDArray[np.float64] | None = None,
    t: Time | None = None,
    center: int | None = None,
    target: int | None = None,
) -> ICRF: ...
