import numpy as np
import numpy.typing as npt
from skyfield.timelib import Time

class _Frame:
    # Rotation from the ICRS (GCRS) into this frame; shape (3, 3) or (3, 3, N) for array times.
    def rotation_at(self, t: Time) -> npt.NDArray[np.float64]: ...

ecliptic_frame: _Frame
itrs: _Frame
