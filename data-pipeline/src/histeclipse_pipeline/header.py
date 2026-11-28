"""The header every data file opens with (#1318): where it comes from and on what terms.

One shape for all of them, so the site's catalogue (``data/catalog.json``) and anyone reading a
file alone find the same fields: the registry ids of its sources (``src/sources/sources.json``),
the credit in words, the licence as its maker states it (or "none stated"), the day the source
was fetched, and what this site did to it, as CC BY asks. Units follow where the file's numbers
have them: one text, or one for each column.
"""

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from histeclipse_pipeline.sky import Json


def header(  # noqa: PLR0913 - one argument for each field of the header
    *,
    version: int,
    sources: list[str],
    credit: str,
    licence: str,
    accessed: str,
    changes: str,
    units: str | dict[str, str] | None = None,
) -> dict[str, Json]:
    """Build the fields a data file starts with, in their order; the file's own follow."""
    if not sources:
        message = "a data file names at least one source"
        raise ValueError(message)
    made: dict[str, Json] = {
        "schemaVersion": version,
        "sources": list(sources),
        "credit": credit,
        "licence": licence,
        "accessed": accessed,
        "changes": changes,
    }
    if units is not None:
        made["units"] = dict(units) if isinstance(units, dict) else units
    return made
