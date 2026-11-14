"""Living files: what publishers update in place, and which pinned checksums have drifted (#560).

Every download is pinned by SHA-256 (:func:`histeclipse_pipeline.sky.verified`), so a changed
upstream file is never used unseen. Some sources are living files, updated each month, quarter
or year at the same address (or, for NOAAGlobalTemp, under a new dated name, the old one
removed). Their pins go stale, and a re-run of their command then fails its hash check.

The policy: pins stay, and are re-pinned by hand when a source is refreshed, after looking at
what changed (series should only extend; a past value that moves is noted). This module lists
the living pins, from the modules' own constants so there is one copy of each, and
``check-pins`` reports which have drifted. A scheduled workflow runs it weekly and keeps one
issue up to date, so drift is seen before a re-run fails.

Not listed: files fixed once published (dated releases, archives with a DOI, C3S's yearly
report for JRA-3Q), and IAP's gridded ocean heat (``ocean-heat-map``), whose pin is a set of
decade archives and a month manifest that its own command checks.
"""

import hashlib
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import TYPE_CHECKING, Literal

from histeclipse_pipeline import (
    cryosphere,
    holocene_temperature,
    measured_warming,
    ocean_heat,
    precipitation,
    sealevel_modern,
    temperature_records,
)

if TYPE_CHECKING:
    from collections.abc import Callable, Sequence

#: Gone: the address answers 404 or 410 (a dated file replaced by a newer one).
GONE = frozenset({404, 410})
#: Read in pieces, so a large file is hashed without holding it in memory.
CHUNK = 1 << 20


@dataclass(frozen=True)
class LivingPin:
    """A pinned file its publisher updates in place, and the command that reads it."""

    name: str
    command: str
    url: str
    sha256: str


def _seaice_pins() -> tuple[LivingPin, ...]:
    return tuple(
        LivingPin(
            f"Sea Ice Index, {label}",
            "seaice-trend",
            cryosphere.seaice_url(pole, month),
            sha256,
        )
        for _, label, pole, month, sha256 in cryosphere.SEAICE_SERIES
    )


LIVING_PINS: tuple[LivingPin, ...] = (
    LivingPin(
        "GISTEMP v4",
        "temperature-records",
        temperature_records.GISTEMP.url,
        temperature_records.GISTEMP.sha256,
    ),
    LivingPin(
        "GISTEMP v4, 95% range",
        "temperature-records",
        temperature_records.GISTEMP_CI.url,
        temperature_records.GISTEMP_CI.sha256,
    ),
    LivingPin(
        "NOAAGlobalTemp v6.1",
        "temperature-records",
        temperature_records.NOAA.url,
        temperature_records.NOAA.sha256,
    ),
    LivingPin(
        "ERA5 (Climate Pulse)",
        "temperature-records",
        temperature_records.ERA5.url,
        temperature_records.ERA5.sha256,
    ),
    LivingPin(
        "Berkeley Earth summary",
        "temperature-records",
        temperature_records.BERKELEY.url,
        temperature_records.BERKELEY.sha256,
    ),
    LivingPin(
        "HadCRUT5",
        "holocene-temperature, temperature-records",
        holocene_temperature.HADCRUT5.url,
        holocene_temperature.HADCRUT5.sha256,
    ),
    LivingPin(
        "Berkeley Earth gridded",
        "measured-warming",
        measured_warming.FILE_URL,
        measured_warming.FILE_SHA256,
    ),
    LivingPin("GPCP", "precipitation", precipitation.GPCP_URL, precipitation.GPCP_SHA256),
    LivingPin(
        "NOAA LSA global mean sea level",
        "sealevel-modern",
        sealevel_modern.NOAA_MEAN.url,
        sealevel_modern.NOAA_MEAN.sha256,
    ),
    LivingPin(
        "NOAA LSA sea-level trends",
        "sealevel-modern",
        sealevel_modern.NOAA_TRENDS.url,
        sealevel_modern.NOAA_TRENDS.sha256,
    ),
    LivingPin("IAP ocean heat", "ocean-heat", ocean_heat.IAP.url, ocean_heat.IAP.sha256),
    LivingPin(
        "NCEI ocean heat, 0-700 m",
        "ocean-heat",
        ocean_heat.NCEI_700.url,
        ocean_heat.NCEI_700.sha256,
    ),
    LivingPin(
        "NCEI ocean heat, 0-2000 m",
        "ocean-heat",
        ocean_heat.NCEI_2000.url,
        ocean_heat.NCEI_2000.sha256,
    ),
    *_seaice_pins(),
    LivingPin("Rutgers snow cover", "snow-cover", cryosphere.SNOW.url, cryosphere.SNOW.sha256),
)

Status = Literal["same", "changed", "gone", "unreachable"]


@dataclass(frozen=True)
class PinCheck:
    """What a living pin's address serves now, against its pin."""

    pin: LivingPin
    status: Status
    detail: str


class GoneError(Exception):
    """The address no longer serves the file."""


def check_pin(pin: LivingPin, digest: Callable[[str], str], attempts: int = 2) -> PinCheck:
    """Compare what ``pin``'s address serves now with its pinned SHA-256.

    A server that fails to answer is tried again, up to ``attempts`` times in all: publishers'
    servers time out now and then, and a weekly report should not cry wolf.
    """
    check = _attempt(pin, digest)
    for _ in range(attempts - 1):
        if check.status != "unreachable":
            break
        check = _attempt(pin, digest)
    return check


def _attempt(pin: LivingPin, digest: Callable[[str], str]) -> PinCheck:
    try:
        now = digest(pin.url)
    except GoneError as error:
        return PinCheck(pin, "gone", str(error))
    except OSError as error:
        return PinCheck(pin, "unreachable", str(error))
    if now == pin.sha256:
        return PinCheck(pin, "same", now)
    return PinCheck(pin, "changed", now)


def drifted(checks: Sequence[PinCheck]) -> list[PinCheck]:
    """Pick the pins that need re-pinning: changed, or gone from their address."""
    return [check for check in checks if check.status in {"changed", "gone"}]


def report(checks: Sequence[PinCheck]) -> str:
    """Write a Markdown report: what drifted, with the command to re-run, then all checked."""
    needing = drifted(checks)
    unreachable = [check for check in checks if check.status == "unreachable"]
    lines = [
        f"{len(needing)} of {len(checks)} living pins have drifted"
        + (f"; {len(unreachable)} could not be reached." if unreachable else "."),
        "",
    ]
    if needing:
        lines += [
            "Re-pin each after looking at what changed: past values should not move, only new",
            "ones be added. Then re-run the command and commit the data it writes.",
            "",
            "| File | Status | Command | Now |",
            "| --- | --- | --- | --- |",
        ]
        lines += [
            _row(_link(check), check.status, f"`{check.pin.command}`", f"`{check.detail}`")
            for check in needing
        ]
        lines.append("")
    lines += ["| File | Status |", "| --- | --- |"]
    lines += [_row(_link(check), _status(check)) for check in checks]
    return "\n".join(lines) + "\n"


def _status(check: PinCheck) -> str:
    # Why a file could not be read: a time-out is worth trying again, a refusal is not.
    return f"{check.status} ({check.detail})" if check.status == "unreachable" else check.status


def _row(*cells: str) -> str:
    return f"| {' | '.join(cells)} |"


def _link(check: PinCheck) -> str:
    return f"[{check.pin.name}]({check.pin.url})"


def url_digest(url: str) -> str:  # pragma: no cover - needs network access
    """Hash what ``url`` serves now with SHA-256, reading it in pieces."""
    request = urllib.request.Request(url, headers={"User-Agent": "histeclipse-pipeline"})  # noqa: S310
    hasher = hashlib.sha256()
    try:
        with urllib.request.urlopen(request, timeout=120) as response:  # noqa: S310  # pyright: ignore[reportAny]
            while True:
                chunk: object = response.read(CHUNK)  # pyright: ignore[reportAny]
                if not isinstance(chunk, bytes):
                    msg = f"{url}: expected bytes"
                    raise TypeError(msg)
                if not chunk:
                    break
                hasher.update(chunk)
    except urllib.error.HTTPError as error:
        if error.code in GONE:
            msg = f"HTTP {error.code}"
            raise GoneError(msg) from error
        raise
    return hasher.hexdigest()


def check_living_pins() -> list[PinCheck]:  # pragma: no cover - needs network access
    """Check every living pin against what its address serves now."""
    return [check_pin(pin, url_digest) for pin in LIVING_PINS]
