from skyfield.positionlib import ICRF
from skyfield.units import Angle

class GeographicPosition:
    @property
    def latitude(self) -> Angle: ...
    @property
    def longitude(self) -> Angle: ...

class Geoid:
    def subpoint_of(self, position: ICRF) -> GeographicPosition: ...
