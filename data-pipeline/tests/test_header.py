"""The header every data file opens with."""

import pytest

from histeclipse_pipeline.header import header


def test_the_fields_come_in_their_order_and_units_only_when_given() -> None:
    made = header(
        version=2,
        sources=["holvol"],
        credit="HolVol",
        licence="CC BY 4.0",
        accessed="2026-11-07",
        changes="kept the year",
    )
    assert list(made) == ["schemaVersion", "sources", "credit", "licence", "accessed", "changes"]
    assert made["schemaVersion"] == 2
    assert made["sources"] == ["holvol"]


def test_units_are_one_text_or_one_for_each_column() -> None:
    def units(given: str | dict[str, str]) -> object:
        return header(
            version=1,
            sources=["holvol"],
            credit="HolVol",
            licence="CC BY 4.0",
            accessed="2026-11-07",
            changes="kept the year",
            units=given,
        )["units"]

    assert units("Tg S") == "Tg S"
    assert units({"sulfur": "Tg S"}) == {"sulfur": "Tg S"}


def test_a_file_without_a_source_is_refused() -> None:
    with pytest.raises(ValueError, match="at least one source"):
        _ = header(
            version=1, sources=[], credit="x", licence="x", accessed="2026-11-07", changes="x"
        )
