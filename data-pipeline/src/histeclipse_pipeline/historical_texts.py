"""Historical texts that tell of an eclipse, quoted from public-domain translations (#394).

Each passage is taken word for word from a Project Gutenberg file pinned by SHA-256, between an
opening and a closing phrase, never retyped: line breaks become spaces, and the translator's
footnote markers ("[384]", a lone "8") are dropped, which the passage's note says. Each is tied
to the famous eclipses it is held to describe (``public/data/famous-eclipses.json``), more than
one where its date is disputed, so the site can anchor it to their places and days.

The translations are in the public domain (all were published before 1929); Project Gutenberg's
licence asks nothing of a quotation once its own header and name are not used with it.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import TYPE_CHECKING

from histeclipse_pipeline.planet_maps import checked, download

if TYPE_CHECKING:
    from pathlib import Path

GUTENBERG = "https://www.gutenberg.org/cache/epub/{n}/pg{n}.txt"
BOOK = "https://www.gutenberg.org/ebooks/{n}"


@dataclass(frozen=True)
class Book:
    """A translation on Project Gutenberg: its number, its file's hash, and who made it."""

    ebook: int
    sha256: str
    work: str
    translator: str
    year: int


BOOKS = {
    "herodotus": Book(
        2707,
        "b4a845d38e9051690201561803d2aa83f6589a7b3f80273b97d79801981e64a3",
        "Herodotus, The Histories",
        "G. C. Macaulay",
        1890,
    ),
    "odyssey": Book(
        1727,
        "b167ce5e348bf805dfe4355dff2eae5c2e522b11cce003a6f98bb65a753bbc69",
        "Homer, The Odyssey",
        "Samuel Butler",
        1900,
    ),
    "thucydides": Book(
        7142,
        "b7df28eabde17b252e38e808c5d9c287ac69d9503e2958ba74bd316922963b14",
        "Thucydides, The History of the Peloponnesian War",
        "Richard Crawley",
        1874,
    ),
    "arrian": Book(
        46976,
        "5d12bd51a7a32a04780f72ca9fcb2f9d44cc5342a67725a175b391f715d999c7",
        "Arrian, The Anabasis of Alexander",
        "E. J. Chinnock",
        1884,
    ),
    "plutarch": Book(
        674,
        "e849186d3483c1779053a5f70c8ae477316c019907c740f878de0d2c788975f8",
        "Plutarch, Lives",
        "the Dryden translation, edited by A. H. Clough",
        1864,
    ),
    "josephus": Book(
        2848,
        "bb2e32da8ba3adc109b7694e6a8f2f11570462af2bedd55798da70b754c6e440",
        "Flavius Josephus, Antiquities of the Jews",
        "William Whiston",
        1737,
    ),
    "snorri": Book(
        598,
        "1c3850032b20ce159eba4b8dba4b8b5a2647561aede41842f67bd1eaf123af2d",
        "Snorri Sturluson, Heimskringla: Saga of Olaf Haraldson",
        "Samuel Laing",
        1844,
    ),
    "chronicle": Book(
        657,
        "f74238ff4bcf1225585157cd8152c2e62616e6f4f0e803fbf465309f5e8a9617",
        "The Anglo-Saxon Chronicle (Peterborough)",
        "James Ingram, with readings from J. A. Giles",
        1823,
    ),
}


@dataclass(frozen=True)
class Excerpt:
    """A passage of a book: where (as cited), its opening and closing phrases, and its eclipses."""

    id: str
    book: str
    where: str
    spans: tuple[tuple[str, str], ...]
    eclipses: tuple[str, ...]
    #: Starts mid-sentence, so it is shown after an ellipsis.
    mid: bool = False


EXCERPTS = (
    Excerpt(
        "herodotus-1-74",
        "herodotus",
        "1.74",
        (
            (
                "in the sixth year a battle took place",
                "much more eager both of them that peace should be made between them.",
            ),
        ),
        ("thales-585-bce",),
        mid=True,
    ),
    Excerpt(
        "odyssey-20-351",
        "odyssey",
        "20.351\u2013357",
        (("Theoclymenus saw this and said", "a blighting gloom is over all the land.”"),),
        ("odyssey-1178-bce",),
    ),
    Excerpt(
        "thucydides-2-28",
        "thucydides",
        "2.28",
        (
            (
                "The same summer, at the beginning of a new lunar month",
                "it returned to its natural shape.",
            ),
        ),
        ("athens-431-bce",),
    ),
    Excerpt(
        "thucydides-7-50",
        "thucydides",
        "7.50",
        (("All was at last ready", "waited the thrice nine days prescribed by the soothsayers."),),
        ("syracuse-413-bce",),
    ),
    Excerpt(
        "arrian-3-7",
        "arrian",
        "3.7",
        (
            (
                "There he made his army rest",
                "victory for Alexander was signified by the sacrificial victims.",
            ),
        ),
        ("gaugamela-331-bce",),
    ),
    Excerpt(
        "plutarch-alexander-31",
        "plutarch",
        "Alexander 31",
        (
            (
                "It came to pass that in the month Boedromion",
                "by torchlight took a general review of them.",
            ),
        ),
        ("gaugamela-331-bce",),
    ),
    Excerpt(
        "josephus-17-6-4",
        "josephus",
        "17.6.4",
        (("But Herod deprived this Matthias", "eclipse of the moon."),),
        ("herod-4-bce", "herod-1-bce"),
    ),
    Excerpt(
        "snorri-stiklestad",
        "snorri",
        "ch. 238 and 248 (Laing\u2019s numbering)",
        (
            (
                "The weather was beautiful, and the sun shone clear",
                "it became as dark as at night.",
            ),
            ("King Olaf fell on Wednesday", "half-past one to three also."),
        ),
        ("stiklestad-1030",),
    ),
    Excerpt(
        "chronicle-1135",
        "chronicle",
        "A.D. 1135 [for 1133]",
        (("In this year went the King Henry over sea", "the stars about him at midday."),),
        ("henry-1133",),
    ),
)

#: Footnote markers the translators' editions put in the text: "[384]", and a number standing
#: alone between words or at the end ("moon. 8").
FOOTNOTE = re.compile(r"\s*\[\d+\]|(?<=[.:;,])\s+\d{1,3}(?=\s|$)")


def flat(text: str) -> str:
    """Text with its line breaks and runs of spaces made single spaces."""
    return re.sub(r"\s+", " ", text).strip()


def between(text: str, opening: str, closing: str) -> str:
    """Cut the text from ``opening`` to the end of the ``closing`` after it; both must be there."""
    start = text.find(opening)
    if start < 0:
        msg = f"opening not found: {opening!r}"
        raise ValueError(msg)
    end = text.find(closing, start)
    if end < 0:
        msg = f"closing not found after its opening: {closing!r}"
        raise ValueError(msg)
    return text[start : end + len(closing)]


def quoted(text: str, excerpt: Excerpt) -> tuple[str, bool]:
    """Quote an excerpt from its book's text; say whether footnote markers were dropped."""
    body = flat(text)
    parts = [between(body, opening, closing) for opening, closing in excerpt.spans]
    cleaned = [FOOTNOTE.sub("", part) for part in parts]
    words = " … ".join(cleaned)
    return ("…" + words if excerpt.mid else words), cleaned != parts


def entry(excerpt: Excerpt, book: Book, text: str) -> dict[str, object]:
    """Write an excerpt as the site reads it: its words, who wrote and translated them, where."""
    words, dropped = quoted(text, excerpt)
    notes = ["Footnote markers dropped."] if dropped else []
    return {
        "id": excerpt.id,
        "work": book.work,
        "where": excerpt.where,
        "translator": book.translator,
        "year": book.year,
        "url": BOOK.format(n=book.ebook),
        "licence": "Public domain",
        "text": words,
        "eclipses": list(excerpt.eclipses),
        **({"note": " ".join(notes)} if notes else {}),
    }


def fetch_historical_texts(path: Path, cache: Path) -> int:  # pragma: no cover - network
    """Download each book once into ``cache``, check it, and write the excerpts to ``path``."""
    texts: dict[str, str] = {}
    for name, book in BOOKS.items():
        file = cache / f"pg{book.ebook}.txt"
        if not file.exists():
            download(GUTENBERG.format(n=book.ebook), file)
        texts[name] = checked(file, book.sha256).read_text(encoding="utf-8")
    data = {
        "schemaVersion": 1,
        "source": "Project Gutenberg (gutenberg.org), public-domain translations",
        "texts": [entry(e, BOOKS[e.book], texts[e.book]) for e in EXCERPTS],
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    _ = path.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return len(EXCERPTS)
