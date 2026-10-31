from typing import TYPE_CHECKING

import pytest

from tests.json_values import as_json_value, json_round_trip, read_json

if TYPE_CHECKING:
    from pathlib import Path


def test_reads_nested_json(tmp_path: Path) -> None:
    path = tmp_path / "value.json"
    _ = path.write_text('{"a": [1, 2.5, "x", null, true, {"b": []}]}')
    assert read_json(path) == {"a": [1, 2.5, "x", None, True, {"b": []}]}


def test_round_trip_turns_tuples_into_lists() -> None:
    assert json_round_trip({"pair": (1.0, 2.0)}) == {"pair": [1.0, 2.0]}


def test_rejects_non_json_values() -> None:
    with pytest.raises(TypeError, match="Not a JSON value: set"):
        _ = as_json_value({1, 2})
