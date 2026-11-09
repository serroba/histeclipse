"""Saturn's rings as they are (#336): how much light gets through each, and their colour.

Two public-domain records, one texture a row across the rings, from the C ring to the F ring:

- **How opaque, at each radius:** Voyager 2's photopolarimeter watched the star delta Scorpii
  pass behind the rings in 1981 and measured their normal optical depth (tau) every 10 km,
  72,000 to 142,500 km from Saturn's centre (PDS Ring-Moon Systems Node, VG_2801,
  PS1P01.TAB). The rings let through exp(-tau) of the light from behind: drawn opaque in
  1 - exp(-tau). Where the B ring hid the star altogether the record flags tau as 99: opaque.
- **Their colour:** Cassini's natural-colour "Panoramic Rings" (2004, NASA Photojournal
  PIA06175), its lit side from the C ring to the A ring's edge. Along a row through its middle
  the radius rises from left to right; the row is tied to radius at the edges every map of the
  rings shows: the B ring's inner and outer edges, the A ring's inner and outer edges (as the
  site places them), and its own left edge, its caption's 74,565 km. Between them, a straight
  share. Beyond the A ring (the F ring) the A ring's colour carries on.

Both are pinned by checksum. The texture is RGBA, the rings' radius across it.
"""

from __future__ import annotations

import io
from typing import TYPE_CHECKING

import numpy as np
from PIL import Image

from histeclipse_pipeline.arrays import as_floats
from histeclipse_pipeline.planet_maps import checked, download

if TYPE_CHECKING:
    from pathlib import Path

    from histeclipse_pipeline.arrays import FloatArray

PROFILE = "https://pds-rings.seti.org/holdings/volumes/VG_28xx/VG_2801/EASYDATA/KM010/PS1P01.TAB"
PROFILE_SHA256 = "0f917e554786b81a103d125afaa40120e36b00089f7417069de138c1443e705d"
PANORAMA = (
    "https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia06/"
    "pia06175/PIA06175.jpg"
)
PANORAMA_SHA256 = "c24b81b30b617dbb82690886434f711293b414ec05da837bb971d698b067e025"
#: The radii the texture spans, km: the C ring's inner edge to beyond the F ring.
INNER_KM = 74_500.0
OUTER_KM = 140_600.0
WIDTH = 4096
#: Optical depth drawn as quite opaque; the record's 99 means the star was hidden.
OPAQUE_TAU = 5.0
#: The panorama's row through the rings, and the rows about it averaged, pixels.
ROW = 443
ROWS = 3
#: Radii of the edges the panorama is tied at, km: its left edge (its caption), the B ring's
#: inner and outer edges, the A ring's inner and outer edges.
LEFT_KM = 74_565.0
B_INNER_KM = 92_000.0
B_OUTER_KM = 117_580.0
A_INNER_KM = 122_170.0
A_OUTER_KM = 136_775.0
#: Brightness (0-255) that marks a ring as begun: the B ring's inner edge, the A ring's.
BRIGHT = 120.0
DIM = 60.0
#: Pixels the row's brightness is smoothed over before its edges are sought.
SMOOTH = 25


def profile(text: str) -> tuple[FloatArray, FloatArray]:
    """Read the occultation profile: radius (km) and normal optical depth, flags made opaque."""
    rows = [line.split(",") for line in text.splitlines() if line.strip()]
    radius = np.array([float(row[0]) for row in rows])
    tau = np.array([float(row[3]) for row in rows])
    tau = np.where(tau >= OPAQUE_TAU, OPAQUE_TAU, np.maximum(tau, 0.0))
    return radius, tau


def edges(brightness: FloatArray) -> tuple[int, int, int, int]:
    """Find the B ring's inner and outer edges and the A ring's along the row, in pixels.

    The brightness is smoothed over SMOOTH pixels first, so the C ring's narrow bright ringlets
    and the B ring's dark ones are not taken for edges; the Cassini Division is sought well
    past the B ring's inner edge (a fifth of the row).
    """
    smooth = as_floats(np.convolve(brightness, np.ones(SMOOTH) / SMOOTH, mode="same"))
    width = len(smooth)
    b_inner = next(x for x in range(width // 8, width) if smooth[x] >= BRIGHT)
    gap = next(x for x in range(b_inner + width // 5, width) if smooth[x] < DIM)
    b_outer = max(x for x in range(b_inner, gap) if smooth[x] >= BRIGHT)
    a_inner = next(x for x in range(gap, width) if smooth[x] >= BRIGHT * 0.8)
    a_outer = max(x for x in range(a_inner, width) if smooth[x] >= DIM)
    return b_inner, b_outer, a_inner, a_outer


def ring_texture(tau_profile: tuple[FloatArray, FloatArray], panorama: FloatArray) -> FloatArray:
    """Make the rings' texture: one RGBA pixel a step of radius, from INNER_KM to OUTER_KM."""
    radius, tau = tau_profile
    row: FloatArray = panorama[ROW - ROWS : ROW + ROWS + 1].mean(axis=0)
    brightness: FloatArray = row.mean(axis=1)
    b_inner, b_outer, a_inner, a_outer = edges(brightness)
    pixels = [0.0, float(b_inner), float(b_outer), float(a_inner), float(a_outer)]
    kms = [LEFT_KM, B_INNER_KM, B_OUTER_KM, A_INNER_KM, A_OUTER_KM]
    across: FloatArray = np.linspace(INNER_KM, OUTER_KM, WIDTH)
    at: FloatArray = np.clip(np.interp(across, kms, pixels), 0, a_outer)
    index = np.round(at).astype(int)
    colour: FloatArray = row[index] / 255.0
    opacity: FloatArray = 1.0 - np.exp(-np.interp(across, radius, tau))
    return np.concatenate([colour, opacity[:, None]], axis=1)


def png(texture: FloatArray) -> bytes:
    """Write the texture as a one-row RGBA PNG."""
    data = np.clip(np.round(texture * 255), 0, 255).astype(np.uint8)[None, :, :]
    out = io.BytesIO()
    Image.fromarray(data, mode="RGBA").save(out, format="PNG", optimize=True)
    return out.getvalue()


def fetch_saturn_rings(path: Path, cache: Path) -> int:  # pragma: no cover - needs network access
    """Download the profile and the panorama once into ``cache``; write the texture."""
    table = cache / "PS1P01.TAB"
    if not table.exists():
        download(PROFILE, table)
    picture = cache / "PIA06175.jpg"
    if not picture.exists():
        download(PANORAMA, picture)
    tau_profile = profile(checked(table, PROFILE_SHA256).read_text())
    with Image.open(checked(picture, PANORAMA_SHA256)) as image:
        panorama: FloatArray = np.asarray(image.convert("RGB"), dtype=np.float64)
    path.parent.mkdir(parents=True, exist_ok=True)
    _ = path.write_bytes(png(ring_texture(tau_profile, panorama)))
    return WIDTH
