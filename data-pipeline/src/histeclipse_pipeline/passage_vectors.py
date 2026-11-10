"""The passages' meanings, for search by meaning (#393): each embedded by a small English model.

The model is BAAI's bge-small-en-v1.5 (MIT), as ONNX quantised to 8 bits (Xenova's conversion),
pinned by revision and SHA-256 in ``models.lock.json``, which the site's build reads too: the site
runs the same file in the reader's browser to embed a query, so the passages and the query are
measured alike. Each passage is embedded as its title and text; a query, after bge's instruction
for queries. A vector is the first token's last hidden state, made unit length, then rounded to
8 bits (x 127) for the site: 384 bytes a passage.

Alongside, test vectors for the site: how the reference tokenizer splits awkward texts, which the
site's own WordPiece tokenizer must match, and one query's vector, which the site's model must.
"""

from __future__ import annotations

import hashlib
import json
from typing import TYPE_CHECKING, TypedDict, cast

import numpy as np

from histeclipse_pipeline.planet_maps import checked, download

if TYPE_CHECKING:
    from collections.abc import Callable, Sequence
    from pathlib import Path

    from numpy.typing import NDArray

    FloatArray = NDArray[np.float32]

#: How far a vector's parts are stretched before rounding to 8 bits.
SCALE = 127

#: Texts the site's tokenizer must split as the reference does: accents, dashes, apostrophes,
#: numbers, words longer than the vocabulary has, Chinese, and nothing at all.
AWKWARD = (
    "The eclipse of Thales, 28 May 585 BCE.",
    "Ganymède and Churyumov\u2013Gerasimenko\u2019s comet",
    "Herodotus's 'Histories' (i.74): \"the day turned to night\"!",
    "Lunokhod-2 drove 39 km; Yutu-2 is still driving.",
    "antidisestablishmentarianism and supercalifragilistic",
    "日食 in the Chunqiu",
    "  tabs\tand\nnew lines  ",
    "",
)

#: The query whose vector the site's model must match.
QUERY = "when the Moon hid the Sun over Lydia during a battle"


class Lock(TypedDict):
    """A model as ``models.lock.json`` pins it."""

    name: str
    repo: str
    revision: str
    licence: str
    query: str
    files: dict[str, str]


def read_lock(path: Path) -> Lock:
    """Read the pinned embedding model."""
    return cast("Lock", json.loads(path.read_text(encoding="utf-8"))["embedding"])


def passage_text(passage: dict[str, object]) -> str:
    """Write a passage as it is embedded: its title, then its text."""
    return f"{passage['title']}. {passage['text']}"


def unit(vectors: FloatArray) -> FloatArray:
    """Each row made unit length."""
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    return (vectors / np.maximum(norms, 1e-12)).astype(np.float32)


def quantised(vectors: FloatArray) -> bytes:
    """Round unit vectors to 8 bits, row after row."""
    return np.clip(np.rint(vectors * SCALE), -SCALE, SCALE).astype(np.int8).tobytes()


def vectors_index(
    passages: Sequence[dict[str, object]], passages_sha256: str, lock: Lock, dims: int
) -> dict[str, object]:
    """Say what the site needs to read the vectors file: whose they are, in what order."""
    return {
        "schemaVersion": 1,
        "model": lock["name"],
        "revision": lock["revision"],
        "dims": dims,
        "scale": SCALE,
        "passagesSha256": passages_sha256,
        "ids": [str(passage["id"]) for passage in passages],
    }


def write_passage_vectors(
    passages_path: Path,
    out: Path,
    embed: Callable[[Sequence[str]], FloatArray],
    lock: Lock,
) -> int:
    """Embed every passage; write ``out`` (.bin, 8-bit rows) and its index beside it (.json)."""
    raw = passages_path.read_bytes()
    passages = cast("list[dict[str, object]]", json.loads(raw)["passages"])
    vectors = unit(embed([passage_text(passage) for passage in passages]))
    out.parent.mkdir(parents=True, exist_ok=True)
    _ = out.write_bytes(quantised(vectors))
    dims = int(vectors.shape[1])  # pyright: ignore[reportAny]
    index = vectors_index(passages, hashlib.sha256(raw).hexdigest(), lock, dims)
    _ = out.with_suffix(".json").write_text(json.dumps(index, separators=(",", ":")) + "\n")
    return len(passages)


def fetch_model(lock: Lock, folder: Path) -> Path:  # pragma: no cover - needs network access
    """Download the pinned model's files once into ``folder``, each checked against its hash."""
    base = f"https://huggingface.co/{lock['repo']}/resolve/{lock['revision']}"
    for name, sha256 in lock["files"].items():
        path = folder / name
        if not path.exists():
            download(f"{base}/{name}", path)
        _ = checked(path, sha256)
    return folder


def onnx_embedder(folder: Path) -> Callable[[Sequence[str]], FloatArray]:  # pragma: no cover
    """Embed texts with the model in ``folder``, one at a time, as the site does."""
    import onnxruntime  # noqa: PLC0415 - heavy, and only for this command
    from tokenizers import Tokenizer  # noqa: PLC0415

    tokenizer = Tokenizer.from_file(str(folder / "tokenizer.json"))
    tokenizer.enable_truncation(512)
    session = onnxruntime.InferenceSession(str(folder / "onnx/model_quantized.onnx"))

    def embed(texts: Sequence[str]) -> FloatArray:
        rows: list[FloatArray] = []
        for text in texts:
            ids = np.array([tokenizer.encode(text).ids], dtype=np.int64)
            feeds = {
                "input_ids": ids,
                "attention_mask": np.ones_like(ids),
                "token_type_ids": np.zeros_like(ids),
            }
            hidden = session.run(None, feeds)[0]
            rows.append(hidden[0, 0])  # pyright: ignore[reportAny]
        return np.array(rows, dtype=np.float32)

    return embed


def write_test_vectors(folder: Path, lock: Lock, out: Path) -> None:  # pragma: no cover
    """Write how the reference tokenizer splits awkward texts, and one query's vector."""
    from tokenizers import Tokenizer  # noqa: PLC0415

    tokenizer = Tokenizer.from_file(str(folder / "tokenizer.json"))
    query = lock["query"] + QUERY
    vector: list[float] = unit(onnx_embedder(folder)([query]))[0].tolist()  # pyright: ignore[reportAny]
    data = {
        "model": lock["name"],
        "revision": lock["revision"],
        "tokens": [{"text": text, "ids": tokenizer.encode(text).ids} for text in AWKWARD],
        "query": {"text": query, "vector": [round(x, 6) for x in vector]},
    }
    _ = out.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
