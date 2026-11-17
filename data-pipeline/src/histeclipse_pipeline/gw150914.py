"""GW150914, the first gravitational wave heard, as LIGO measured it (#830).

The discovery paper's Figure 1 (Abbott et al. 2016, PRL 116, 061102), as the Gravitational
Wave Open Science Center (GWOSC) publishes it under CC BY 4.0: at Hanford (H1) and Livingston
(L1), the strain each measured, band-passed (35-350 Hz) and notched as in the paper, and the
numerical-relativity waveform that best fits it, as each detector would see it, from 0.25 to
0.46 s after 09:50:45 UTC on 14 September 2015, 16,384 samples a second, in units of 10⁻²¹.

The files are third-party input: each is read as two columns of finite numbers, its times
rising evenly over the window and its strains within reason, or refused. The four series are
put on one grid, 2,048 samples a second (the band stops at 350 Hz), and rounded to 10⁻²⁴.

For the ring of masses the site draws face on, it keeps the wave's two polarisations: h-plus
as the waveform at Livingston, which the wave reached first, and h-cross as the same a quarter
cycle on (its Hilbert transform). GW150914 was seen nearly face on or face off, where the two are
equal and a quarter cycle apart; the strain at a detector is a mix of the two, and these stand
for it.
"""

from __future__ import annotations

import json
import urllib.request
from typing import TYPE_CHECKING, cast

import numpy as np

if TYPE_CHECKING:
    from pathlib import Path

    from numpy.typing import NDArray

#: Where GWOSC keeps the paper's Figure 1.
FIGURE_1 = "https://gwosc.org/s/events/GW150914/P150914/"
#: The series kept: (detector, kind) and the file each comes from.
SERIES = {
    ("H1", "observed"): "fig1-observed-H.txt",
    ("L1", "observed"): "fig1-observed-L.txt",
    ("H1", "waveform"): "fig1-waveform-H.txt",
    ("L1", "waveform"): "fig1-waveform-L.txt",
}
#: The grid every series is put on: its first time (s after 09:50:45 UTC), rate and length.
START = 0.2505
RATE = 2048
COUNT = 429
#: The figure's window, s after 09:50:45 UTC, and the largest strain believed, 10⁻²¹.
WINDOW = (0.24, 0.47)
LARGEST = 5.0
#: How far apart two of a file's time steps may be, s.
EVEN = 1e-6


def parse(text: str) -> tuple[NDArray[np.float64], NDArray[np.float64]]:
    """Read a Figure 1 file's times and strains, refusing what GWOSC does not publish."""
    rows = [line.split() for line in text.splitlines() if line.strip() and not line.startswith("#")]
    if len(rows) < 1000 or any(len(row) != 2 for row in rows):  # noqa: PLR2004
        msg = "expected over a thousand rows of time and strain"
        raise ValueError(msg)
    values = np.array([[float(time), float(strain)] for time, strain in rows])
    times, strains = values[:, 0], values[:, 1]
    if not np.all(np.isfinite(values)):
        msg = "expected finite numbers"
        raise ValueError(msg)
    steps = np.diff(times)
    if np.any(steps <= 0) or np.ptp(steps) > EVEN:
        msg = "expected times rising evenly"
        raise ValueError(msg)
    if times[0] < WINDOW[0] or times[-1] > WINDOW[1]:
        msg = f"expected times within {WINDOW[0]}-{WINDOW[1]} s"
        raise ValueError(msg)
    if np.max(np.abs(strains)) > LARGEST:
        msg = f"expected strains within {LARGEST} x 10^-21"
        raise ValueError(msg)
    return times, strains


def grid() -> NDArray[np.float64]:
    """Give the times every series is put on."""
    return START + np.arange(COUNT) / RATE


def resampled(times: NDArray[np.float64], strains: NDArray[np.float64]) -> NDArray[np.float64]:
    """Put a series on the shared grid, by straight lines between its own samples."""
    at = grid()
    if at[0] < times[0] or at[-1] > times[-1]:
        msg = "the series does not cover the grid"
        raise ValueError(msg)
    return np.interp(at, times, strains)


def quarter_cycle_on(series: NDArray[np.float64]) -> NDArray[np.float64]:
    """Turn a series a quarter cycle on at every frequency: its Hilbert transform."""
    spectrum = np.fft.fft(series)
    count = len(series)
    weights = np.zeros(count)
    weights[0] = 1.0
    half = count // 2
    if count % 2 == 0:
        weights[half] = 1.0
        weights[1:half] = 2.0
    else:
        weights[1 : half + 1] = 2.0
    return np.fft.ifft(spectrum * weights).imag


def rounded(series: NDArray[np.float64]) -> list[float]:
    """Round to 10⁻²⁴ (three places in units of 10⁻²¹)."""
    values = cast("list[float]", series.tolist())
    return [round(value, 3) for value in values]


def built(texts: dict[tuple[str, str], str]) -> dict[str, object]:
    """Build the file the site reads from the four Figure 1 files' texts."""
    series = {key: resampled(*parse(text)) for key, text in texts.items()}
    plus = series["L1", "waveform"]
    peak = int(np.argmax(np.hypot(plus, quarter_cycle_on(plus))))
    return {
        "event": "GW150914",
        "utc": "2015-09-14T09:50:45Z",
        "start": START,
        "rate": RATE,
        "unit": 1e-21,
        "merger": round(START + peak / RATE, 5),
        "detectors": {
            detector: {
                "observed": rounded(series[detector, "observed"]),
                "waveform": rounded(series[detector, "waveform"]),
            }
            for detector in ("H1", "L1")
        },
        "plus": rounded(plus),
        "cross": rounded(quarter_cycle_on(plus)),
    }


def fetch_gw150914(out: Path) -> int:  # pragma: no cover - needs network access
    """Fetch Figure 1's files from GWOSC and write the event's file; returns its samples."""
    texts: dict[tuple[str, str], str] = {}
    for key, name in SERIES.items():
        with urllib.request.urlopen(FIGURE_1 + name, timeout=60) as response:  # noqa: S310  # pyright: ignore[reportAny]
            body: object = response.read()  # pyright: ignore[reportAny]
        if not isinstance(body, bytes):
            msg = "GWOSC: expected bytes"
            raise TypeError(msg)
        texts[key] = body.decode("ascii")
    data = built(texts)
    _ = out.write_text(json.dumps(data, separators=(",", ":")) + "\n")
    return COUNT
