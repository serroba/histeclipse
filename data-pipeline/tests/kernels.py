"""Paths to the DE441 excerpt fixtures described in fixtures/README.md."""

from pathlib import Path

FIXTURES = Path(__file__).parent / "fixtures"
ANCIENT = FIXTURES / "de441_-620_mar-may.bsp"
BEFORE_SPLIT = FIXTURES / "de441_1969_jun_before_split.bsp"
AFTER_SPLIT = FIXTURES / "de441_1969_jun_1970_mar_after_split.bsp"
MODERN = FIXTURES / "de441_2025_mar-sep.bsp"
