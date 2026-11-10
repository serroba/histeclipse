"""The passages' meanings, for search by meaning: what is embedded, and how it is written."""

from __future__ import annotations

import json
from typing import TYPE_CHECKING, cast

import numpy as np
import pytest

from histeclipse_pipeline.passage_vectors import (
    SCALE,
    passage_text,
    quantised,
    read_lock,
    unit,
    write_passage_vectors,
)

if TYPE_CHECKING:
    from collections.abc import Sequence
    from pathlib import Path

    from histeclipse_pipeline.passage_vectors import FloatArray, Lock

LOCK: Lock = {
    "name": "bge-small-en-v1.5",
    "repo": "Xenova/bge-small-en-v1.5",
    "revision": "abc",
    "licence": "MIT",
    "query": "Represent this sentence for searching relevant passages: ",
    "files": {},
}


def test_a_passage_is_embedded_as_its_title_then_its_text() -> None:
    assert passage_text({"title": "Io", "text": "Volcanic."}) == "Io. Volcanic."


def test_vectors_are_made_unit_length_and_rounded_to_eight_bits() -> None:
    # Given a vector three long and four up, and one of nothing.
    vectors = unit(np.array([[3.0, 4.0], [0.0, 0.0]], dtype=np.float32))
    # Then the first is unit length, and nothing stays nothing.
    first: list[float] = vectors[0].tolist()  # pyright: ignore[reportAny]
    nothing: list[float] = vectors[1].tolist()  # pyright: ignore[reportAny]
    assert first == pytest.approx([0.6, 0.8])
    assert nothing == [0.0, 0.0]
    # And each part is rounded to 8 bits, row after row.
    assert np.frombuffer(quantised(vectors), dtype=np.int8).tolist() == [76, 102, 0, 0]
    assert np.frombuffer(
        quantised(np.array([[1.5, -2.0]], dtype=np.float32)), np.int8
    ).tolist() == [
        SCALE,
        -SCALE,
    ]


def test_the_vectors_are_written_with_whose_they_are_and_in_what_order(tmp_path: Path) -> None:
    # Given two passages, and an embedder that measures each text by its length.
    passages = tmp_path / "passages.json"
    _ = passages.write_text(
        json.dumps(
            {
                "passages": [
                    {"id": "moon:io", "title": "Io", "text": "Volcanic."},
                    {"id": "moon:europa", "title": "Europa", "text": "Ice."},
                ]
            }
        )
    )
    seen: list[str] = []

    def embed(texts: Sequence[str]) -> FloatArray:
        seen.extend(texts)
        return np.array([[len(text), 0.0] for text in texts], dtype=np.float32)

    out = tmp_path / "data" / "passage-vectors.bin"
    count = write_passage_vectors(passages, out, embed, LOCK)
    # Then each passage is embedded as its title and text, in order.
    assert count == 2
    assert seen == ["Io. Volcanic.", "Europa. Ice."]
    assert np.frombuffer(out.read_bytes(), dtype=np.int8).tolist() == [127, 0, 127, 0]
    # And the index says whose vectors they are, of which passages file, in what order.
    index = cast("dict[str, object]", json.loads(out.with_suffix(".json").read_text()))
    assert index["model"] == "bge-small-en-v1.5"
    assert index["dims"] == 2
    assert index["scale"] == SCALE
    assert index["ids"] == ["moon:io", "moon:europa"]
    assert len(str(index["passagesSha256"])) == 64


def test_the_model_is_read_from_the_lock_the_site_shares(tmp_path: Path) -> None:
    lock = tmp_path / "models.lock.json"
    _ = lock.write_text(json.dumps({"embedding": LOCK}))
    assert read_lock(lock)["repo"] == "Xenova/bge-small-en-v1.5"
