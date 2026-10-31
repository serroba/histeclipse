from typing import Literal

import numpy as np
import numpy.typing as npt
from skyfield.timelib import Time
from skyfield.units import Angle, Distance
from skyfield.vectorlib import VectorFunction

class ICRF:
    center: int | None
    t: Time | None
    def radec(
        self, epoch: Time | Literal["date"] | None = None
    ) -> tuple[Angle, Angle, Distance]: ...

class Barycentric(ICRF):
    def observe(self, body: VectorFunction) -> Astrometric: ...

class Astrometric(ICRF):
    def apparent(self, deflectors: tuple[int, ...] = ...) -> Apparent: ...

class Apparent(ICRF): ...

def build_position(
    position_au: npt.NDArray[np.float64],
    velocity_au_per_d: npt.NDArray[np.float64] | None = None,
    t: Time | None = None,
    center: int | None = None,
    target: int | None = None,
) -> ICRF: ...
