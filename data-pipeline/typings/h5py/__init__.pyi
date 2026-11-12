# Only what the pipeline and its tests use (h5py 3.16).
from collections.abc import Sequence
from types import TracebackType
from typing import IO, Literal, Self

import numpy as np
import numpy.typing as npt

class AsStrWrapper:
    # An object array of str at runtime; read whole and iterated.
    def __getitem__(self, key: tuple[()]) -> Sequence[str]: ...

class Dataset:
    def __getitem__(
        self,
        key: tuple[()]
        | int
        | slice[int, int, None]
        | tuple[int | slice[int | None, int | None, None], ...],
    ) -> npt.NDArray[np.float32]: ...
    def asstr(self) -> AsStrWrapper: ...

class File:
    def __init__(self, name: str | IO[bytes], mode: Literal["r", "w"] = "r") -> None: ...
    def __getitem__(self, name: str) -> Dataset: ...
    def __contains__(self, name: str) -> bool: ...
    def create_dataset(
        self,
        name: str,
        *,
        data: npt.NDArray[np.float32]
        | npt.NDArray[np.float64]
        | npt.NDArray[np.int16]
        | npt.NDArray[np.int32]
        | npt.NDArray[np.bytes_],
    ) -> Dataset: ...
    def __enter__(self) -> Self: ...
    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_value: BaseException | None,
        traceback: TracebackType | None,
    ) -> None: ...
