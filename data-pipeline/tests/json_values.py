"""Typed JSON parsing for tests that read files the pipeline wrote."""

import json
from typing import TYPE_CHECKING, cast

if TYPE_CHECKING:
    from pathlib import Path

type JsonValue = bool | int | float | str | list[JsonValue] | dict[str, JsonValue] | None


def read_json(path: Path) -> JsonValue:
    """Parse a JSON file and check, at runtime, that it holds only JSON values."""
    # json.loads is typed as returning Any. This is the one place we accept that; the
    # validation below checks the value, so callers get a precise type.
    decoded: object = json.loads(path.read_text())  # pyright: ignore[reportAny]
    return as_json_value(decoded)


def json_round_trip(value: object) -> JsonValue:
    """What ``value`` looks like after being written to JSON and read back."""
    decoded: object = json.loads(json.dumps(value))  # pyright: ignore[reportAny]
    return as_json_value(decoded)


def as_json_value(value: object) -> JsonValue:
    """Check that ``value`` is made only of JSON types and return it with a precise type."""
    if value is None or isinstance(value, bool | int | float | str):
        return value
    if isinstance(value, list):
        return [as_json_value(item) for item in cast("list[object]", value)]
    if isinstance(value, dict):
        items = cast("dict[object, object]", value).items()
        return {str(key): as_json_value(item) for key, item in items}
    msg = f"Not a JSON value: {type(value).__name__}"
    raise TypeError(msg)
