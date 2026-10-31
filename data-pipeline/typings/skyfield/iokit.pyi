from skyfield.timelib import Timescale

class Loader:
    def timescale(self, delta_t: float | None = None, builtin: bool = True) -> Timescale: ...
