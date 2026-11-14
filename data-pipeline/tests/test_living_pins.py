from typing import TYPE_CHECKING

import pytest

from histeclipse_pipeline import temperature_records
from histeclipse_pipeline.living_pins import (
    LIVING_PINS,
    GoneError,
    LivingPin,
    PinCheck,
    check_pin,
    drifted,
    report,
)

if TYPE_CHECKING:
    from histeclipse_pipeline.living_pins import Status

PIN = LivingPin("GISTEMP v4", "temperature-records", "https://example.org/g.csv", "a" * 64)


def test_living_pins_are_the_modules_own_pins_each_listed_once() -> None:
    urls = [pin.url for pin in LIVING_PINS]
    assert len(urls) == len(set(urls))
    gistemp = next(pin for pin in LIVING_PINS if pin.name == "GISTEMP v4")
    assert gistemp.url == temperature_records.GISTEMP.url
    assert gistemp.sha256 == temperature_records.GISTEMP.sha256
    for pin in LIVING_PINS:
        assert pin.url.startswith(("https://", "http://"))
        assert len(pin.sha256) == 64
        assert pin.command


def test_the_sea_ice_index_gives_one_pin_per_series() -> None:
    seaice = [pin for pin in LIVING_PINS if pin.command == "seaice-trend"]
    assert len(seaice) == 4
    assert all("/monthly/data/" in pin.url for pin in seaice)


def test_a_file_unchanged_is_the_same() -> None:
    assert check_pin(PIN, lambda _: "a" * 64).status == "same"


def test_a_file_changed_reports_its_new_checksum() -> None:
    check = check_pin(PIN, lambda _: "b" * 64)
    assert check.status == "changed"
    assert check.detail == "b" * 64


def _gone(_: str) -> str:
    msg = "HTTP 404"
    raise GoneError(msg)


def _down(_: str) -> str:
    msg = "timed out"
    raise TimeoutError(msg)


def test_a_file_removed_is_gone_and_a_server_down_is_unreachable() -> None:
    assert check_pin(PIN, _gone).status == "gone"
    down = check_pin(PIN, _down)
    assert down.status == "unreachable"
    assert down.detail == "timed out"


def test_only_changed_and_gone_need_re_pinning() -> None:
    checks = [
        PinCheck(PIN, "same", ""),
        PinCheck(PIN, "changed", ""),
        PinCheck(PIN, "gone", ""),
        PinCheck(PIN, "unreachable", ""),
    ]
    assert [check.status for check in drifted(checks)] == ["changed", "gone"]


@pytest.mark.parametrize(
    ("statuses", "head"),
    [
        (["same", "same"], "0 of 2 living pins have drifted."),
        (["changed", "unreachable"], "1 of 2 living pins have drifted; 1 could not be reached."),
    ],
)
def test_the_report_says_how_many_drifted(statuses: list[Status], head: str) -> None:
    checks = [PinCheck(PIN, status, "b" * 64) for status in statuses]
    text = report(checks)
    assert text.startswith(head)


def test_the_report_names_the_command_to_re_run_and_the_new_checksum() -> None:
    text = report([PinCheck(PIN, "changed", "b" * 64)])
    assert "| [GISTEMP v4](https://example.org/g.csv) | changed | `temperature-records` |" in text
    assert "b" * 64 in text
    assert "Re-pin each" in text
    assert "Re-pin each" not in report([PinCheck(PIN, "same", "a" * 64)])


def test_the_report_says_why_a_file_could_not_be_reached() -> None:
    text = report([PinCheck(PIN, "unreachable", "timed out")])
    assert "| [GISTEMP v4](https://example.org/g.csv) | unreachable (timed out) |" in text


def test_a_server_that_fails_once_is_tried_again() -> None:
    calls: list[str] = []

    def flaky(url: str) -> str:
        calls.append(url)
        if len(calls) == 1:
            msg = "timed out"
            raise TimeoutError(msg)
        return "a" * 64

    assert check_pin(PIN, flaky).status == "same"
    assert len(calls) == 2
