"""Skyfield kernels for full apparent positions, one per DE441 excerpt file.

`Ephemeris` (ephemeris.py) joins raw segments for fast searches. Apparent positions
(light time, aberration, nutation) need Skyfield's own kernel objects instead; this picks,
for each time, the excerpt file that covers it.
"""

from typing import TYPE_CHECKING, Self

from jplephem.spk import SPK
from skyfield.api import load

if TYPE_CHECKING:
    from collections.abc import Sequence
    from pathlib import Path
    from types import TracebackType

    from skyfield.jpllib import SpiceKernel


class KernelLibrary:
    """Opens each excerpt as a Skyfield kernel and finds the one covering a given time."""

    def __init__(self, paths: Sequence[Path]) -> None:
        """Open every kernel in ``paths``."""
        self._kernels: list[tuple[tuple[float, float], SpiceKernel]] = [
            (_coverage(path), load(str(path))) for path in paths
        ]

    def __enter__(self) -> Self:
        """Use as a context manager so the files get closed."""
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        """Close every kernel."""
        for _, kernel in self._kernels:
            kernel.close()

    def covering(self, start_jd_tt: float, end_jd_tt: float) -> SpiceKernel:
        """Return the kernel whose data covers all of ``[start_jd_tt, end_jd_tt]``."""
        for (start, end), kernel in self._kernels:
            if start <= start_jd_tt and end_jd_tt <= end:
                return kernel
        msg = f"No kernel covers JD {start_jd_tt}..{end_jd_tt} (TT)"
        raise ValueError(msg)


def _coverage(path: Path) -> tuple[float, float]:
    spk = SPK.open(str(path))
    try:
        return (
            max(segment.start_jd for segment in spk.segments),
            min(segment.end_jd for segment in spk.segments),
        )
    finally:
        spk.close()
