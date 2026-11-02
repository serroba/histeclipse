"""A map of the whole Sun's surface, stitched from full-disk frames taken days apart.

SDO only ever sees the half of the Sun that faces Earth. The Sun turns once in about 27 days as
seen from Earth, so frames a week apart see four different faces. Each frame is laid onto a map
in heliographic coordinates: latitude from the Sun's equator and longitude from the central
meridian seen from Earth at the newest frame (Stonyhurst longitude at that moment), growing
toward the west limb. Features drift with the Sun's differential rotation between frames, so
each frame's longitudes are carried forward to the newest frame's moment.

Where frames overlap, each pixel is weighted by μ, the cosine between the surface and the line
of sight of the frame that saw it, so a face-on view wins over a squeezed one near the limb, and
seams blend over tens of degrees. The poles are never seen well (the Sun's axis tilts at most
7.25° toward Earth); there the map fades into a smooth fill spread from the nearest data.

Geometry from Meeus, *Astronomical Algorithms* (2nd ed.), chapters 25 and 29; differential
rotation from Snodgrass & Ulrich (1990, ApJ 351, 309).
"""

import math
from dataclasses import dataclass
from datetime import datetime

import numpy as np

from histeclipse_pipeline.arrays import FloatArray, as_floats, as_ints, dims

#: The Carrington frame's sidereal rotation, degrees a day (one turn in 25.38 days).
CARRINGTON_RATE = 360 / 25.38
#: Snodgrass & Ulrich's sidereal rotation of surface magnetic features: A + B sin²φ + C sin⁴φ.
ROTATION = (14.713, -2.396, -1.787)
#: The brightest channel of a frame's inner disc is at least this, or the frame is blank.
BLANK_LEVEL = 0.02
#: Rings across the disc in which a frame's brightness toward the limb is measured.
PROFILE_BINS = 256
#: A frame's weight grows as μ to this power, so the most face-on frame dominates.
WEIGHT_POWER = 4.0
#: Pixels closer to the limb than these μ fade out of a frame entirely: they are smeared.
FRAME_EDGE = (0.04, 0.12)
#: How well the best frame must have seen a point (its μ) for the map to trust it fully.
TRUSTED = (0.2, 0.45)
#: Spreads for the fill over the poorly seen poles, degrees: fine near the data, broad beyond.
FILL_SPREADS = (24.0, 12.0, 6.0, 3.0)
#: The fill's texture: its cells' size in degrees, and its strength as a share of the seen
#: surface's small-scale detail (less, since it is a guess).
NOISE_SPREAD = 1.5
NOISE_SHARE = 0.4

_RADIANS = math.pi / 180
_SRGB_KNEE = 0.04045
_UNIX_EPOCH_JD = 2440587.5


def julian_day(moment: str) -> float:
    """Julian day of an ISO 8601 UTC moment such as ``2024-05-08T12:00:00Z``."""
    seconds = datetime.fromisoformat(moment).timestamp()
    return _UNIX_EPOCH_JD + seconds / 86400


def solar_longitude(jd: float) -> float:
    """Find the Sun's apparent geocentric ecliptic longitude, degrees (Meeus ch. 25, ~0.01°)."""
    t = (jd - 2451545) / 36525
    mean = 280.46646 + 36000.76983 * t + 0.0003032 * t * t
    anomaly = (357.52911 + 35999.05029 * t - 0.0001537 * t * t) * _RADIANS
    centre = (
        (1.914602 - 0.004817 * t - 0.000014 * t * t) * math.sin(anomaly)
        + (0.019993 - 0.000101 * t) * math.sin(2 * anomaly)
        + 0.000289 * math.sin(3 * anomaly)
    )
    node = (125.04 - 1934.136 * t) * _RADIANS
    return (mean + centre - 0.00569 - 0.00478 * math.sin(node)) % 360


@dataclass(frozen=True)
class DiskCentre:
    """Heliographic coordinates of the centre of the disc seen from Earth, degrees."""

    #: B₀: latitude, positive when the north pole tilts toward Earth.
    latitude: float
    #: L₀: Carrington longitude.
    longitude: float


def disk_centre(jd: float) -> DiskCentre:
    """B₀ and L₀ at a Julian day (Meeus ch. 29)."""
    inclination = 7.25 * _RADIANS
    node = 73.6667 + 1.3958333 * (jd - 2396758) / 36525
    turned = (jd - 2398220) * CARRINGTON_RATE
    offset = (solar_longitude(jd) - node) * _RADIANS
    latitude = math.asin(math.sin(offset) * math.sin(inclination))
    eta = math.atan2(-math.sin(offset) * math.cos(inclination), -math.cos(offset))
    return DiskCentre(latitude / _RADIANS, (eta / _RADIANS - turned) % 360)


def drift(latitude: FloatArray, days: float) -> FloatArray:
    """How far features at ``latitude`` (radians) move in Carrington longitude, degrees."""
    a, b, c = ROTATION
    sin2: FloatArray = np.sin(latitude) ** 2
    rate: FloatArray = a + b * sin2 + c * sin2 * sin2 - CARRINGTON_RATE
    return rate * days


def grid(width: int) -> tuple[FloatArray, FloatArray]:
    """Longitudes and latitudes (radians) of the pixel centres of a 2:1 map, north at the top.

    Longitude runs from -180° at the left edge to +180° at the right, 0° in the middle.
    """
    height = width // 2
    longitudes = (np.arange(width, dtype=np.float64) + 0.5) / width * 2 * math.pi - math.pi
    latitudes = math.pi / 2 - (np.arange(height, dtype=np.float64) + 0.5) / height * math.pi
    lon, lat = np.meshgrid(longitudes, latitudes)
    return lon, lat


@dataclass(frozen=True)
class Frame:
    """A full-disk frame: solar north up, west right, the limb at ``disk_radius`` of its width.

    ``pixels`` is height x width x channels in linear light, 0..1.
    """

    pixels: FloatArray
    jd: float
    disk_radius: float


@dataclass(frozen=True)
class Projected:
    """Where map points fall in one frame: pixel coordinates and μ (negative behind the limb)."""

    x: FloatArray
    y: FloatArray
    mu: FloatArray


def project(lon: FloatArray, lat: FloatArray, frame: Frame, reference_jd: float) -> Projected:
    """Where points of the map (at ``reference_jd``) were on ``frame``.

    The points' longitudes are Stonyhurst longitudes at ``reference_jd``; each is carried back
    to the frame's moment through the Sun's differential rotation.
    """
    then, now = disk_centre(frame.jd), disk_centre(reference_jd)
    days = reference_jd - frame.jd
    carrington = now.longitude * _RADIANS + lon
    seen = carrington - drift(lat, days) * _RADIANS - then.longitude * _RADIANS
    b0 = then.latitude * _RADIANS
    cos_lat = np.cos(lat)
    west = cos_lat * np.sin(seen)
    north = np.sin(lat) * math.cos(b0) - cos_lat * np.cos(seen) * math.sin(b0)
    mu = np.sin(lat) * math.sin(b0) + cos_lat * np.cos(seen) * math.cos(b0)
    height, size = dims(frame.pixels)[:2]
    radius = frame.disk_radius * size
    return Projected(size / 2 + radius * west, height / 2 - radius * north, mu)


def sample(pixels: FloatArray, x: FloatArray, y: FloatArray) -> FloatArray:
    """Bilinear samples of ``pixels`` (height x width x channels) at pixel coordinates.

    Coordinates are continuous, with pixel ``i`` covering ``[i, i + 1)``; outside the image
    the nearest edge pixel is used.
    """
    height, width = dims(pixels)[:2]
    fx = np.clip(x - 0.5, 0, width - 1)
    fy = np.clip(y - 0.5, 0, height - 1)
    x0 = np.minimum(np.floor(fx).astype(np.int64), width - 2)
    y0 = np.minimum(np.floor(fy).astype(np.int64), height - 2)
    tx = (fx - x0)[..., np.newaxis]
    ty = (fy - y0)[..., np.newaxis]
    top: FloatArray = pixels[y0, x0] * (1 - tx) + pixels[y0, x0 + 1] * tx
    bottom: FloatArray = pixels[y0 + 1, x0] * (1 - tx) + pixels[y0 + 1, x0 + 1] * tx
    result: FloatArray = top * (1 - ty) + bottom * ty
    return result


def smoothstep(edge0: float, edge1: float, value: FloatArray) -> FloatArray:
    """0 below ``edge0``, 1 above ``edge1``, a smooth S between."""
    t = np.clip((value - edge0) / (edge1 - edge0), 0, 1)
    return t * t * (3 - 2 * t)


@dataclass(frozen=True)
class Composite:
    """A stitched map (height x width x channels) and how well each point was seen (0..1)."""

    pixels: FloatArray
    trust: FloatArray


def composite(frames: list[Frame], lon: FloatArray, lat: FloatArray) -> Composite:
    """Stitch ``frames`` onto map points, as of the newest frame."""
    reference = max(frame.jd for frame in frames)
    channels = dims(frames[0].pixels)[2]
    total = np.zeros((*lon.shape, channels), dtype=np.float64)
    weights = np.zeros(lon.shape, dtype=np.float64)
    best = np.zeros(lon.shape, dtype=np.float64)
    for frame in frames:
        where = project(lon, lat, frame, reference)
        weight = np.clip(where.mu, 0, 1) ** WEIGHT_POWER * smoothstep(*FRAME_EDGE, where.mu)
        total += sample(frame.pixels, where.x, where.y) * weight[..., np.newaxis]
        weights += weight
        best = np.maximum(best, where.mu)
    pixels = total / np.maximum(weights, 1e-12)[..., np.newaxis]
    return Composite(pixels, smoothstep(*TRUSTED, best))


def _box_rows(values: FloatArray, widths: list[int]) -> FloatArray:
    """Average each row over a centred, wrapping window of that row's width (in pixels)."""
    out = np.empty_like(values)
    count = dims(values)[1]
    for row, width in enumerate(widths):
        # A one-row slice keeps numpy's types, where indexing a row would not.
        line = values[row : row + 1]
        if width >= count:
            out[row : row + 1] = np.mean(line, axis=1, keepdims=True)
            continue
        half = width // 2
        padded = np.concatenate([line[:, count - half :], line, line[:, : width - half]], axis=1)
        summed = np.concatenate([np.zeros_like(line[:, :1]), np.cumsum(padded, axis=1)], axis=1)
        out[row : row + 1] = (summed[:, width:] - summed[:, :-width])[:, :count] / width
    return out


def _box_columns(values: FloatArray, width: int) -> FloatArray:
    """Average down each column over a centred window, holding the edge rows beyond the poles."""
    count = dims(values)[0]
    half = width // 2
    padded = np.concatenate(
        [np.repeat(values[:1], half, axis=0), values, np.repeat(values[-1:], width - half, axis=0)],
        axis=0,
    )
    summed = np.concatenate([np.zeros_like(values[:1]), np.cumsum(padded, axis=0)], axis=0)
    result: FloatArray = (summed[width:] - summed[:-width])[:count] / width
    return result


def blur(values: FloatArray, spread: float) -> FloatArray:
    """Blur a 2:1 map on the sphere, near-Gaussian and ``spread`` degrees wide.

    Three box passes each way. Along a row the window widens toward the poles, where a degree
    of longitude covers less ground, until near a pole it takes in the whole ring.
    """
    height, width = dims(values)[:2]
    # Odd windows, so each is centred on its pixel.
    rows = 2 * round(spread * height / 360) + 1
    latitudes = math.pi / 2 - (np.arange(height, dtype=np.float64) + 0.5) / height * math.pi
    stretch = as_floats(1 / np.maximum(np.cos(latitudes), 1e-6))
    widths = [min(width, 2 * round(rows * s / 2) + 1) for s in stretch]
    out = values
    for _ in range(3):
        out = _box_columns(_box_rows(out, widths), rows)
    return out


def fill_unseen(stitched: Composite, *, mottled: bool = True) -> FloatArray:
    """Fill the map's poorly seen parts smoothly from the nearest good data.

    A normalised convolution at several spreads: a broad one reaches the poles from far off, and
    each finer one takes over where enough data is close by, so the fill follows nearby detail
    and has no edges. Where the data is trusted it shows as it is. A ``mottled`` fill gets a
    random texture as strong as the seen surface's small-scale detail, so it does not look like
    glass; a magnetogram's is left smooth, as random field would be made up.
    """
    trust = stitched.trust
    weighted = stitched.pixels * trust[..., np.newaxis]
    broadest, *finer = FILL_SPREADS
    fill = blur(weighted, broadest) / np.maximum(blur(trust[..., np.newaxis], broadest), 1e-9)
    for spread in finer:
        weights = blur(trust[..., np.newaxis], spread)
        estimate = blur(weighted, spread) / np.maximum(weights, 1e-9)
        enough = smoothstep(0.05, 0.3, weights)
        fill = estimate * enough + fill * (1 - enough)
    if mottled:
        lon, lat = grid(dims(trust)[1])
        fill *= (1 + detail_strength(stitched) * sphere_noise(lon, lat))[..., np.newaxis]
    blend = trust[..., np.newaxis]
    return stitched.pixels * blend + fill * (1 - blend)


def detail_strength(stitched: Composite) -> float:
    """How much brightness varies at small scales where the surface is well seen, relatively."""
    brightness = stitched.pixels.sum(axis=2)
    smooth = blur(brightness[..., np.newaxis], NOISE_SPREAD)[..., 0]
    relative = brightness / np.maximum(smooth, 1e-9) - 1
    weights = stitched.trust**4
    variance = float(np.sum(relative * relative * weights) / max(float(np.sum(weights)), 1e-9))
    return math.sqrt(variance) * NOISE_SHARE


def sphere_noise(lon: FloatArray, lat: FloatArray, seed: int = 2024) -> FloatArray:
    """Smooth random values with unit spread on the sphere, without seams or polar pinching.

    Value noise on a 3D lattice, sampled on the unit sphere, in two octaves; its cells are
    about ``NOISE_SPREAD`` degrees across.
    """
    rng = np.random.default_rng(seed)
    cos_lat = np.cos(lat)
    points = np.stack([cos_lat * np.cos(lon), cos_lat * np.sin(lon), np.sin(lat)], axis=-1)
    total = np.zeros(lon.shape, dtype=np.float64)
    for scale, share in ((1.0, 0.7), (3.0, 0.3)):
        cells = round(scale * 2 / (NOISE_SPREAD * _RADIANS))
        lattice = rng.standard_normal((cells + 2, cells + 2, cells + 2))
        total += share * _lattice_sample(lattice, (points + 1) / 2 * cells)
    return total / max(float(np.std(total)), 1e-9)


def _lattice_sample(lattice: FloatArray, position: FloatArray) -> FloatArray:
    """Smoothly interpolated values of ``lattice`` at fractional 3D ``position``s."""
    corner = np.floor(position).astype(np.int64)
    f = position - corner
    f = f * f * (3 - 2 * f)
    out = np.zeros(position.shape[:-1], dtype=np.float64)
    for dx in (0, 1):
        for dy in (0, 1):
            for dz in (0, 1):
                share = (
                    (f[..., 0] if dx else 1 - f[..., 0])
                    * (f[..., 1] if dy else 1 - f[..., 1])
                    * (f[..., 2] if dz else 1 - f[..., 2])
                )
                values: FloatArray = lattice[
                    corner[..., 0] + dx, corner[..., 1] + dy, corner[..., 2] + dz
                ]
                out += share * values
    return out


def disc_radii(frame: Frame) -> FloatArray:
    """Each pixel's distance from the disc's centre, in solar radii."""
    height, width = dims(frame.pixels)[:2]
    radius = frame.disk_radius * width
    x = (np.arange(width, dtype=np.float64) + 0.5 - width / 2) / radius
    y = (np.arange(height, dtype=np.float64) + 0.5 - height / 2) / radius
    result: FloatArray = np.hypot(x[np.newaxis, :], y[:, np.newaxis])
    return result


def radial_profile(frame: Frame) -> FloatArray:
    """Measure the median brightness in ``PROFILE_BINS`` rings from the disc's centre out.

    Brightness is all channels summed.

    It is how the frame brightens or darkens toward the limb (limb darkening in visible light,
    the corona's limb brightening in the ultraviolet, and the rendering's own scaling), which
    active regions, being few, barely move.
    """
    rings = np.minimum((disc_radii(frame) * PROFILE_BINS).astype(np.int64), PROFILE_BINS)
    flat_rings = np.ravel(rings)
    order = np.argsort(flat_rings, kind="stable")
    # One brightness for all channels, so dividing by it keeps each pixel's colour.
    pixels = np.ravel(frame.pixels.sum(axis=2))[order]
    edges = np.searchsorted(flat_rings[order], np.arange(PROFILE_BINS + 1))
    bounds = list(zip(as_ints(edges[:-1]), as_ints(edges[1:]), strict=True))
    filled = [ring for ring, (start, end) in enumerate(bounds) if end > start]
    medians = [float(np.median(pixels[bounds[ring][0] : bounds[ring][1]])) for ring in filled]
    # A small frame leaves the innermost rings without a pixel; they take their neighbours'.
    return np.interp(np.arange(PROFILE_BINS, dtype=np.float64), filled, medians)


def flatten(frame: Frame, level: float) -> Frame:
    """``frame`` as if every part of the disc were seen face-on, at the brightness ``level``.

    Dividing by the frame's radial profile takes out how it changes toward the limb, and also
    evens out frames whose overall brightness differs, so seams between them do not show.
    """
    profile = radial_profile(frame)
    centres = (np.arange(PROFILE_BINS, dtype=np.float64) + 0.5) / PROFILE_BINS
    r = np.clip(disc_radii(frame), 0.5 / PROFILE_BINS, 1 - 0.5 / PROFILE_BINS)
    expected = np.interp(r, centres, profile)[..., np.newaxis]
    return Frame(frame.pixels / np.maximum(expected, 1e-4) * level, frame.jd, frame.disk_radius)


def flatten_all(frames: list[Frame]) -> list[Frame]:
    """Flatten every frame to the typical brightness of the inner half of the newest disc."""
    newest = max(frames, key=lambda frame: frame.jd)
    # The inner half of the disc, not its very centre, which may be an active region.
    level = float(np.median(radial_profile(newest)[: PROFILE_BINS // 2]))
    return [flatten(frame, level) for frame in frames]


def linear_from_srgb(values: FloatArray) -> FloatArray:
    """sRGB-encoded 0..1 to linear light."""
    return np.where(values <= _SRGB_KNEE, values / 12.92, ((values + 0.055) / 1.055) ** 2.4)


def srgb_from_linear(values: FloatArray) -> FloatArray:
    """Linear light to sRGB-encoded 0..1, clipped."""
    v = np.clip(values, 0, 1)
    return np.where(v <= _SRGB_KNEE / 12.92, v * 12.92, 1.055 * v ** (1 / 2.4) - 0.055)


def usable(pixels: FloatArray, disk_radius: float) -> bool:
    """Whether a frame shows the Sun: some frames are blank (calibrations, data gaps)."""
    level = radial_profile(Frame(pixels, 0, disk_radius))
    return float(np.median(level[: PROFILE_BINS // 2])) > BLANK_LEVEL
