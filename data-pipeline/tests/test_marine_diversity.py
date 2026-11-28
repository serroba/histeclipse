"""Tests for each stage's marine genera lost, from the Paleobiology Database (#1269)."""

import math

from histeclipse_pipeline.marine_diversity import (
    GROUPS,
    Occurrence,
    Stage,
    extinction_rates,
    found,
    group,
    group_losses,
    last_found,
    lost,
    occurrences_of,
    read_records,
    stage_rates,
    stages_of,
)

STAGES = """"Data License","Creative Commons CC0"
"Records:"
"interval_no","interval_name","max_ma","min_ma"
"2","Younger","20","10"
"1","Older","30","20"
"""

OCCURRENCES = """"Data Provider","The Paleobiology Database"
"occurrence_no","genus","max_ma","min_ma"
"1","Alpha","30","25"
"2","","30","25"
"3","Beta","25","15"
"""


def test_reads_the_stages_oldest_first_past_the_data_header() -> None:
    assert stages_of(read_records(STAGES)) == [
        Stage("Older", 30.0, 20.0),
        Stage("Younger", 20.0, 10.0),
    ]


def test_reads_only_occurrences_named_to_a_genus() -> None:
    assert occurrences_of(read_records(OCCURRENCES)) == [
        Occurrence("Alpha", 30.0, 25.0),
        Occurrence("Beta", 25.0, 15.0),
    ]


def test_places_an_occurrence_only_within_one_stage() -> None:
    stages = [Stage("Older", 30.0, 20.0), Stage("Younger", 20.0, 10.0)]
    occurrences = [
        Occurrence("Alpha", 30.0, 25.0),
        Occurrence("Beta", 25.0, 15.0),
        Occurrence("Gamma", 20.005, 12.0),
    ]
    assert found(occurrences, stages) == [{"Alpha"}, {"Gamma"}]


def test_counts_the_genera_last_found_of_all_whose_range_spans_a_stage() -> None:
    seen = [{"A", "B"}, {"B"}, {"A"}]
    # A spans all three, though missed in the second; B ends in the second.
    assert last_found(seen) == [(0, 2), (1, 2), (1, 1)]


def test_a_rate_is_a_share_lost() -> None:
    assert lost(0.0) == 0.0
    assert math.isclose(lost(math.log(2)), 0.5)


def test_gap_fillers_count_a_genus_found_two_stages_on_as_surviving() -> None:
    # Ten genera before stage 1 and in it: five found again next, two only two stages on.
    shared = {f"g{n}" for n in range(10)}
    next_ = {f"g{n}" for n in range(5)}
    later = next_ | {"g5", "g6"}
    seen = [shared, shared, next_, later, later]
    rates = extinction_rates(seen)
    # Two-timers 10; three-timers 5; part-timers none; gap-fillers 2: 1 - 7/10 lost.
    assert math.isclose(rates.gap_filler[1] or 0, 0.3)
    assert rates.gap_filler[0] is None
    assert rates.gap_filler[-1] is None
    assert rates.gap_filler[-2] is None


def test_three_timers_are_corrected_by_how_often_a_living_genus_is_found() -> None:
    # One part-timer in stage 2 (B: found in 1 and 3, not 2) against three-timers.
    seen = [{"A", "B", "C"}, {"A", "B", "C"}, {"A", "C"}, {"A", "B", "C"}, {"A", "B", "C"}]
    rates = extinction_rates(seen)
    assert rates.three_timer[0] is None
    # Stage 1: two-timers 3, three-timers 2; three-timers 2 + 2 + 2 over all, part-timers 1.
    sampling = 6 / 7
    assert math.isclose(rates.three_timer[1] or 0, lost(math.log(3 * sampling / 2)))
    # Where corrected losses would fall below none, none.
    assert rates.three_timer[2] == 0.0


def test_no_rate_where_nothing_survives_to_be_counted() -> None:
    seen: list[set[str]] = [{"A"}, {"A"}, set(), set(), set()]
    rates = extinction_rates(seen)
    assert rates.three_timer[1] is None
    assert rates.gap_filler[1] is None


def test_writes_each_stage_with_its_losses() -> None:
    stages = [Stage("One", 40.0, 30.0), Stage("Two", 30.0, 20.0), Stage("Three", 20.0, 10.0)]
    occurrences = [Occurrence("A", 40.0, 35.0), Occurrence("A", 25.0, 21.0)]
    rows = stage_rates(stages, occurrences)
    assert rows[0] == {
        "stage": "One",
        "base": 40.0,
        "top": 30.0,
        "genera": 1,
        "lastFound": 0.0,
        "threeTimer": None,
        "gapFiller": None,
    }
    assert rows[2]["genera"] == 0
    assert rows[2]["lastFound"] is None


def test_a_group_holds_occurrences_by_its_phylum_class_or_order() -> None:
    trilobites = group("Trilobites", "class", "Trilobita")
    brachiopods = group("Brachiopods", "phylum", "Brachiopoda")
    ammonoids = group("Ammonoids", "order", "Ceratitida", "Goniatitida")
    trilobite = Occurrence("Phacops", 390.0, 385.0, "Arthropoda", "Trilobita", "Phacopida")
    ammonoid = Occurrence("Ceratites", 240.0, 238.0, "Mollusca", "Cephalopoda", "Ceratitida")
    assert trilobites.holds(trilobite)
    assert not brachiopods.holds(trilobite)
    assert ammonoids.holds(ammonoid)
    assert not ammonoids.holds(trilobite)


def test_reads_each_occurrence_s_phylum_class_and_order() -> None:
    header = '"occurrence_no","genus","max_ma","min_ma","phylum","class","order"'
    row = '"1","Phacops","390","385","Arthropoda","Trilobita","Phacopida"'
    records = read_records(f"{header}\n{row}\n")
    assert occurrences_of(records) == [
        Occurrence("Phacops", 390.0, 385.0, "Arthropoda", "Trilobita", "Phacopida")
    ]


def test_counts_each_group_s_losses_and_the_last_stage_it_is_found_in() -> None:
    stages = [Stage("One", 30.0, 20.0), Stage("Two", 20.0, 10.0)]
    occurrences = [
        Occurrence("Phacops", 30.0, 25.0, "Arthropoda", "Trilobita", "Phacopida"),
        Occurrence("Lingula", 30.0, 25.0, "Brachiopoda", "Lingulata", "Lingulida"),
        Occurrence("Lingula", 15.0, 12.0, "Brachiopoda", "Lingulata", "Lingulida"),
    ]
    rows = {row["group"]: row for row in group_losses(stages, occurrences)}
    assert rows["Trilobites"] == {
        "group": "Trilobites",
        "lastStage": "One",
        "stages": [[1, 1], [0, 0]],
    }
    assert rows["Brachiopods"]["lastStage"] == "Two"
    assert rows["Ammonoids"]["lastStage"] is None
    assert [g.name for g in GROUPS] == list(rows)
