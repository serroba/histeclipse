from typing import TYPE_CHECKING

import pytest

from histeclipse_pipeline.ephemeris import Ephemeris
from kernels import AFTER_SPLIT, BEFORE_SPLIT

if TYPE_CHECKING:
    from collections.abc import Iterator


@pytest.fixture
def across_split() -> Iterator[Ephemeris]:
    with Ephemeris([BEFORE_SPLIT, AFTER_SPLIT]) as ephemeris:
        yield ephemeris
