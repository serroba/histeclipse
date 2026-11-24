"""Tests for the great extinctions' places."""

from histeclipse_pipeline.extinctions import (
    SITES,
    Site,
    extinctions_file,
    positions_then,
    steps_needed,
)

MEISHAN = Site("meishan", "end-permian-extinction", "Meishan", "record", 31.08, 119.71, 251.9)
CHICXULUB = Site("chicxulub", "k-pg-extinction", "Chicxulub", "cause", 21.4, -89.52, 66.0)


def test_each_site_is_wanted_to_the_step_past_its_time() -> None:
    assert steps_needed(CHICXULUB) == 16
    assert steps_needed(MEISHAN) == 53


def test_each_site_is_carried_back_step_by_step_until_it_is_not_wanted() -> None:
    asked: list[tuple[int, int]] = []

    def reconstruct(points: list[tuple[float, float]], ma: int) -> list[tuple[float, float] | None]:
        asked.append((ma, len(points)))
        return [None if ma == 100 else (lat - ma / 10, lon) for lat, lon in points]

    then = positions_then((MEISHAN, CHICXULUB), reconstruct)
    assert asked[0] == (5, 2)
    assert asked[14] == (75, 2)
    assert asked[15] == (80, 1)
    assert asked[-1] == (260, 1)
    assert len(then["chicxulub"]) == 16
    assert then["chicxulub"][0] == (21.4, -89.52)
    assert then["chicxulub"][1] == (21.4 - 0.5, -89.52)
    assert len(then["meishan"]) == 53
    assert then["meishan"][20] is None


def test_the_file_keeps_each_site_with_its_places_in_hundredths() -> None:
    then = {"chicxulub": [(21.4, -89.52), None, (20.123, -80.0)]}
    data = extinctions_file((CHICXULUB,), then, "2026-11-24")
    assert data["stepMa"] == 5
    assert data["scale"] == 100
    assert data["sites"] == [
        {
            "id": "chicxulub",
            "extinction": "k-pg-extinction",
            "name": "Chicxulub",
            "role": "cause",
            "then": [[2140, -8952], None, [2012, -8000]],
        }
    ]


def test_every_site_names_its_role_and_a_unique_id() -> None:
    assert {site.role for site in SITES} == {"cause", "record"}
    assert len({site.id for site in SITES}) == len(SITES)
