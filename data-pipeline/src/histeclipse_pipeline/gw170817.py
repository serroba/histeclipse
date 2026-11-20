"""GW170817 as LIGO and Virgo recorded it: a time-frequency map from each detector (#1000).

GWOSC publishes the strain each detector recorded around the event under CC BY 4.0: 32 s at
4,096 samples a second from GPS 1187008867, for LIGO Hanford (H1), LIGO Livingston (L1) and Virgo
(V1). Unlike GW150914's, this chirp cannot be seen in the strain itself: it is under the noise,
and was found by matching it against waveforms. Drawn as the discovery paper's Figure 1 draws it
(Abbott et al. 2017, PRL 119, 161101), as time against frequency, its rising track shows.

Each detector's strain is whitened (divided by its noise at each frequency, from the median of
4 s Hann-windowed spectra) and band-passed to 20-1,500 Hz; then, at 48 frequencies from 30 to
500 Hz, the energy in a band a 24th of that frequency wide, through time (a Q-transform's tiles,
with Q = 24), each normalised so the noise's median is ln 2, as white noise's is. Kept: 8 s
before the merger to 0.5 s after, 64 columns a second; the energy from 1 to 12 is stored as a byte.

Livingston recorded a loud, brief glitch 1.1 s before the merger. The paper subtracted a model of
it; here, as LIGO did for its first sky map, its raw strain is zeroed within 0.05 s of the glitch's
peak, with 0.1 s ramps either side, before whitening. The file says where.

The files are third-party input: each is read as 131,072 finite strains of a sensible size, from
the GPS second expected, or refused.
"""

from __future__ import annotations

import base64
import json
import math
import urllib.request
from typing import TYPE_CHECKING, cast

import h5py
import numpy as np

if TYPE_CHECKING:
    from pathlib import Path

    from numpy.typing import NDArray

#: Where GWOSC keeps the event's strain, and each detector's file.
STRAIN = "https://gwosc.org/eventapi/json/GWTC-1-confident/GW170817/v3/"
FILES = {
    "H1": "H-H1_GWOSC_4KHZ_R1-1187008867-32.hdf5",
    "L1": "L-L1_GWOSC_4KHZ_R1-1187008867-32.hdf5",
    "V1": "V-V1_GWOSC_4KHZ_R1-1187008867-32.hdf5",
}
#: The files' first GPS second, length and rate; the merger, GPS s at Earth's middle.
GPS_START = 1187008867
SECONDS = 32
RATE = 4096
MERGER = 1187008882.43 - GPS_START
#: The largest strain believed (the glitch reached about 10⁻¹⁷).
LARGEST = 1e-15
#: The map: its frequencies, Hz; its tiles' Q; its window, s from the merger; its columns a second.
FREQUENCIES = np.geomspace(30, 500, 48)
Q = 24
FROM, TO = -8.0, 0.5
COLUMNS = 64
#: The energies kept: 1 (noise) to 12 (bright), as 0 to 255.
FLOOR, TOP = 1.0, 12.0
#: Where Livingston's glitch is sought, s from the merger, and how it is zeroed, s.
GLITCH_NEAR = -1.1
GATE_HALF, GATE_RAMP = 0.05, 0.1


def checked(strain: NDArray[np.float64], gps: int) -> NDArray[np.float64]:
    """Refuse a file that is not what GWOSC publishes for the event."""
    if gps != GPS_START:
        msg = f"expected the strain to start at GPS {GPS_START}"
        raise ValueError(msg)
    if strain.shape != (SECONDS * RATE,):
        msg = f"expected {SECONDS * RATE} samples"
        raise ValueError(msg)
    if not np.all(np.isfinite(strain)):
        msg = "expected finite strains"
        raise ValueError(msg)
    if np.max(np.abs(strain)) > LARGEST:
        msg = f"expected strains within {LARGEST}"
        raise ValueError(msg)
    return strain


def read(path: Path) -> NDArray[np.float64]:
    """Read a GWOSC HDF5 file's strain, checked."""
    with h5py.File(str(path), "r") as file:
        strain = np.asarray(file["strain/Strain"][()], dtype=np.float64)
        gps = int(np.asarray(file["meta/GPSstart"][()], dtype=np.int64))
    return checked(strain, gps)


def gated(strain: NDArray[np.float64], centre: float) -> NDArray[np.float64]:
    """Zero the strain within `GATE_HALF` s of `centre` (s from the start), with Hann ramps."""
    away = np.abs(np.arange(len(strain)) / RATE - centre)
    gate = np.ones(len(strain))
    gate[away < GATE_HALF] = 0.0
    ramp = (away >= GATE_HALF) & (away < GATE_HALF + GATE_RAMP)
    gate[ramp] = 0.5 - 0.5 * np.cos(np.pi * (away[ramp] - GATE_HALF) / GATE_RAMP)
    level = float(np.mean(strain))
    return (strain - level) * gate


def glitch_at(strain: NDArray[np.float64]) -> float:
    """Where the loudest sample within 0.5 s of where the glitch is sought is, s from the start."""
    times = np.arange(len(strain)) / RATE
    near = np.abs(times - (MERGER + GLITCH_NEAR)) < 0.5  # noqa: PLR2004
    loudness = np.where(near, np.abs(strain - float(np.median(strain))), 0.0)
    loudest = int(np.argmax(loudness))
    return loudest / RATE


def whitened(strain: NDArray[np.float64]) -> NDArray[np.float64]:
    """Divide the strain by its noise at each frequency, and keep 20-1,500 Hz."""
    size = 4 * RATE
    window = np.hanning(size)
    pieces = [strain[at : at + size] * window for at in range(0, len(strain) - size + 1, size // 2)]
    noise = np.median([np.abs(np.fft.rfft(piece)) ** 2 for piece in pieces], axis=0)
    noise_at = np.fft.rfftfreq(size, 1 / RATE)
    taper = np.ones(len(strain))
    edge = np.hanning(2 * RATE)
    taper[:RATE] = edge[:RATE]
    taper[-RATE:] = edge[RATE:]
    spectrum = np.fft.rfft(strain * taper)
    frequencies = np.fft.rfftfreq(len(strain), 1 / RATE)
    spectrum = spectrum / np.sqrt(np.interp(frequencies, noise_at, noise))
    spectrum[(frequencies < 20) | (frequencies > 1500)] = 0  # noqa: PLR2004
    return np.fft.irfft(spectrum, len(strain))


def energy_map(series: NDArray[np.float64]) -> NDArray[np.float64]:
    """Give the energy at each of `FREQUENCIES` through time, the noise's median made ln 2."""
    spectrum = np.fft.rfft(series)
    frequencies = np.fft.rfftfreq(len(series), 1 / RATE)
    rows: list[NDArray[np.float64]] = []
    for centre in FREQUENCIES:
        band = np.exp(-0.5 * ((frequencies - centre) / (centre / Q)) ** 2)
        padding = np.zeros(len(series) - len(spectrum))
        analytic = np.fft.ifft(np.concatenate([2 * spectrum * band, padding]))
        rows.append(np.abs(analytic) ** 2)
    energy = np.array(rows)
    times = np.arange(len(series)) / RATE - MERGER
    quiet = (times > -14) & (times < -4)  # noqa: PLR2004
    ordered = np.sort(energy[:, quiet], axis=1)
    middle = int(np.count_nonzero(quiet)) // 2
    noise = ordered[:, middle : middle + 1]
    return energy * (math.log(2) / noise)


def kept(energy: NDArray[np.float64]) -> NDArray[np.uint8]:
    """Keep the window, `COLUMNS` a second, as bytes from `FLOOR` to `TOP`."""
    first = round((MERGER + FROM) * RATE)
    last = round((MERGER + TO) * RATE)
    window = energy[:, first : last : RATE // COLUMNS]
    scaled = np.clip((window - FLOOR) / (TOP - FLOOR), 0, 1)
    return np.round(scaled * 255).astype(np.uint8)


def built(strains: dict[str, NDArray[np.float64]]) -> dict[str, object]:
    """Build the file the site reads from the three detectors' strain."""
    glitch = glitch_at(strains["L1"])
    maps: dict[str, str] = {}
    for detector in ("H1", "L1", "V1"):
        strain = strains[detector]
        if detector == "L1":
            strain = gated(strain, glitch)
        tiles = kept(energy_map(whitened(strain)))
        maps[detector] = base64.b64encode(tiles.tobytes()).decode("ascii")
    columns = round((TO - FROM) * COLUMNS)
    return {
        "event": "GW170817",
        "utc": "2017-08-17T12:41:04.43Z",
        "from": FROM,
        "rate": COLUMNS,
        "columns": columns,
        "frequencies": [round(value, 2) for value in FREQUENCIES.tolist()],
        "energy": {"floor": FLOOR, "top": TOP},
        "gated": {
            "detector": "L1",
            "from": round(glitch - MERGER - GATE_HALF - GATE_RAMP, 3),
            "to": round(glitch - MERGER + GATE_HALF + GATE_RAMP, 3),
        },
        "detectors": maps,
    }


def fetch_gw170817(out: Path, cache: Path) -> int:  # pragma: no cover - needs network access
    """Fetch the three detectors' strain from GWOSC (kept in `cache`) and write the maps."""
    cache.mkdir(parents=True, exist_ok=True)
    strains: dict[str, NDArray[np.float64]] = {}
    for detector, name in FILES.items():
        path = cache / name
        if not path.exists():
            with urllib.request.urlopen(STRAIN + name, timeout=120) as response:  # noqa: S310  # pyright: ignore[reportAny]
                body: object = response.read()  # pyright: ignore[reportAny]
            if not isinstance(body, bytes):
                msg = "GWOSC: expected bytes"
                raise TypeError(msg)
            _ = path.write_bytes(body)
        strains[detector] = read(path)
    data = built(strains)
    _ = out.write_text(json.dumps(data, separators=(",", ":")) + "\n")
    return len(FREQUENCIES) * cast("int", data["columns"])
