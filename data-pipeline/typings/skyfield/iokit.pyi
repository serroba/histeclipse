from skyfield.jpllib import SpiceKernel
from skyfield.timelib import Timescale

class Loader:
    def timescale(self, delta_t: float | None = None, builtin: bool = True) -> Timescale: ...
    def __call__(
        self, filename: str, reload: bool = False, backup: bool = False, builtin: bool = False
    ) -> SpiceKernel: ...
