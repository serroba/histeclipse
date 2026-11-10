"""Historical texts quoted word for word from public-domain translations."""

from __future__ import annotations

import pytest

from histeclipse_pipeline.historical_texts import (
    BOOKS,
    EXCERPTS,
    Book,
    Excerpt,
    between,
    entry,
    flat,
    quoted,
)

#: Arrian as Chinnock's edition prints it: lines broken, a footnote marker in the text.
ARRIAN = """There he made his army rest, and while so doing, an
eclipse of the moon nearly total occurred.[384] Alexander thereupon
offered sacrifice."""


def test_lines_are_joined_and_spaces_made_single() -> None:
    assert flat("  the day\n  became\tnight ") == "the day became night"


def test_a_passage_runs_from_its_opening_to_the_end_of_its_closing() -> None:
    text = "before. The sun was eclipsed after noon. After."
    assert between(text, "The sun", "noon.") == "The sun was eclipsed after noon."
    with pytest.raises(ValueError, match="opening not found"):
        _ = between(text, "The moon", "noon.")
    with pytest.raises(ValueError, match="closing not found"):
        _ = between(text, "The sun", "midnight.")


def test_footnote_markers_are_dropped_and_the_entry_says_so() -> None:
    # Given Arrian's lunar eclipse, with the edition's footnote marker in it.
    excerpt = Excerpt("arrian", "arrian", "3.7", (("There he made", "offered sacrifice."),), ("x",))
    book = Book(46976, "", "Arrian, The Anabasis of Alexander", "E. J. Chinnock", 1884)
    # Then the words are kept, the marker gone, and the note says so.
    item = entry(excerpt, book, ARRIAN)
    assert item["text"] == (
        "There he made his army rest, and while so doing, an eclipse of the moon nearly total"
        " occurred. Alexander thereupon offered sacrifice."
    )
    assert item["note"] == "Footnote markers dropped."
    assert item["url"] == "https://www.gutenberg.org/ebooks/46976"
    assert item["licence"] == "Public domain"


def test_a_lone_footnote_number_after_a_stop_is_dropped_too() -> None:
    excerpt = Excerpt("j", "josephus", "17.6.4", (("And that", "8"),), ("x",))
    assert quoted("And that very night there was an eclipse of the moon. 8", excerpt) == (
        "And that very night there was an eclipse of the moon.",
        True,
    )


def test_two_spans_are_joined_by_an_ellipsis_and_a_mid_sentence_start_marked() -> None:
    excerpt = Excerpt(
        "s", "snorri", "238", (("The weather", "red."), ("King", "fell.")), ("x",), mid=True
    )
    words, dropped = quoted("The weather was red. Then more. King Olaf fell. After.", excerpt)
    assert words == "…The weather was red. … King Olaf fell."
    assert dropped is False
    assert "note" not in entry(excerpt, BOOKS["snorri"], "The weather red. King fell.")


def test_every_excerpt_names_a_pinned_book_and_at_least_one_eclipse() -> None:
    assert len({excerpt.id for excerpt in EXCERPTS}) == len(EXCERPTS)
    for excerpt in EXCERPTS:
        assert excerpt.book in BOOKS
        assert excerpt.eclipses
        assert len(BOOKS[excerpt.book].sha256) == 64
