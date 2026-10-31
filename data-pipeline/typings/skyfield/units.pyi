import numpy as np
import numpy.typing as npt

class Angle:
    @property
    def degrees(self) -> float | npt.NDArray[np.float64]: ...
