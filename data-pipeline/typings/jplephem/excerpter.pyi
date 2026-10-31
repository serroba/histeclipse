from collections.abc import Sequence
from types import TracebackType
from typing import BinaryIO, Self

from jplephem.daf import Summary
from jplephem.spk import SPK

class RemoteFile:
    def __init__(self, url: str) -> None: ...
    def seek(self, offset: int, whence: int = 0, /) -> None: ...
    def read(self, size: int, /) -> bytes: ...
    def __enter__(self) -> Self: ...
    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: TracebackType | None,
    ) -> None: ...

def write_excerpt(
    input_spk: SPK,
    output_file: BinaryIO,
    start_jd: float,
    end_jd: float,
    summaries: Sequence[Summary],
) -> None: ...
