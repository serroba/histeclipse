from skyfield.positionlib import Barycentric
from skyfield.timelib import Time

class VectorFunction:
    def at(self, t: Time) -> Barycentric: ...
