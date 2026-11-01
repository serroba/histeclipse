"""Helpers for crossing from Skyfield/numpy values into plain typed Python."""

import numpy as np

type FloatArray = np.typing.NDArray[np.float64]


def as_array(value: float | FloatArray) -> FloatArray:
    """Skyfield returns a float for a single time and an array for many; always use an array."""
    return np.atleast_1d(np.asarray(value, dtype=np.float64))


def as_floats(value: float | FloatArray) -> list[float]:
    """Plain Python floats from a Skyfield or numpy value, so downstream code is fully typed."""
    return list(map(float, as_array(value)))


def as_ints(value: np.typing.NDArray[np.int64]) -> list[int]:
    """Plain Python ints from a numpy integer array of any shape, flattened."""
    return list(map(int, np.ravel(value)))
