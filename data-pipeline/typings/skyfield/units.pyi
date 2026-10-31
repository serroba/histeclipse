import numpy as np
import numpy.typing as npt

class Angle:
    radians: float | npt.NDArray[np.float64]
    @property
    def degrees(self) -> float | npt.NDArray[np.float64]: ...

class Distance:
    km: float | npt.NDArray[np.float64]
