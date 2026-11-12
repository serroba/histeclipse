"""Typed reading of the water-cycle outputs for tests: the index's parts and image pixels."""

import io
from typing import TYPE_CHECKING

import numpy as np
from PIL import Image

from tests.json_values import JsonValue, read_json

if TYPE_CHECKING:
    from pathlib import Path


def mapping(value: JsonValue) -> dict[str, JsonValue]:
    """The value, which must be a JSON object."""
    assert isinstance(value, dict)
    return value


def manifest(folder: Path) -> dict[str, JsonValue]:
    """The folder's ``index.json``."""
    return mapping(read_json(folder / "index.json"))


def by_id(value: JsonValue) -> dict[str, dict[str, JsonValue]]:
    """A list of objects with ids, by id."""
    assert isinstance(value, list)
    out: dict[str, dict[str, JsonValue]] = {}
    for item in value:
        entry = mapping(item)
        key = entry["id"]
        assert isinstance(key, str)
        out[key] = entry
    return out


def number(value: JsonValue) -> float:
    """The value, which must be a number."""
    assert isinstance(value, int | float)
    assert not isinstance(value, bool)
    return float(value)


def numbers(value: JsonValue) -> list[float]:
    """The value, which must be a list of numbers."""
    assert isinstance(value, list)
    return [number(item) for item in value]


def pixel(path: Path, at: tuple[int, int]) -> tuple[int, int, int, int]:
    """The RGBA bytes of an image's pixel, by row and column."""
    pixels = np.asarray(Image.open(io.BytesIO(path.read_bytes())), dtype=np.int64)
    row, column = at
    red, green, blue, alpha = (pixels.item(row, column, channel) for channel in range(4))
    return red, green, blue, alpha
