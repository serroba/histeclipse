import hashlib
import io
import re
from dataclasses import replace

import pytest
from PIL import Image

from histeclipse_pipeline.telescope_pictures import (
    LARGE_WIDTH,
    TELESCOPES,
    THUMB_SIZE,
    WEBB,
    file_url,
    large,
    manifest,
    page_url,
    thumbnail,
    verified,
)


def jpeg(width: int, height: int) -> bytes:
    out = io.BytesIO()
    Image.new("RGB", (width, height), (200, 120, 40)).save(out, format="JPEG")
    return out.getvalue()


def size_of(webp: bytes) -> tuple[int, int]:
    with Image.open(io.BytesIO(webp)) as image:
        assert image.format == "WEBP"
        return image.size


def test_every_picture_is_pinned_credited_and_described() -> None:
    keys = [picture.key for telescope in TELESCOPES for picture in telescope.pictures]
    assert len(keys) == len(set(keys))
    for telescope in TELESCOPES:
        assert re.fullmatch(r"[DS]\d{5}", telescope.craft)
        assert len(telescope.pictures) >= 6
        for picture in telescope.pictures:
            assert re.fullmatch(r"[0-9a-f]{64}", picture.sha256)
            assert re.fullmatch(r"\d{4}-\d{2}-\d{2}", picture.released)
            assert picture.credit
            assert len(" ".join(picture.about)) > 80
            assert len(" ".join(picture.alt)) > 30


def test_a_picture_is_fetched_from_its_source_and_links_to_its_page() -> None:
    first = WEBB.pictures[0]
    assert page_url(WEBB, first) == "https://esawebb.org/images/weic2209a/"
    assert file_url(WEBB, first) == "https://cdn.esawebb.org/archives/images/screen/weic2209a.jpg"


def test_only_the_pinned_file_is_taken() -> None:
    data = b"a picture"
    pinned = replace(WEBB.pictures[0], sha256=hashlib.sha256(data).hexdigest())
    assert verified(data, pinned) == data
    with pytest.raises(ValueError, match="expected sha256"):
        _ = verified(b"another", pinned)


def test_the_strip_gets_the_middle_square_and_the_larger_copy_keeps_its_shape() -> None:
    assert size_of(thumbnail(jpeg(400, 200))) == (THUMB_SIZE, THUMB_SIZE)
    body, width, height = large(jpeg(2560, 1280))
    assert (width, height) == (LARGE_WIDTH, 640)
    assert size_of(body) == (LARGE_WIDTH, 640)
    # One already small enough is not enlarged.
    assert large(jpeg(600, 300))[1:] == (600, 300)


def test_the_manifest_names_each_telescope_by_its_craft_with_its_licence() -> None:
    sizes = {picture.key: (1280, 720) for telescope in TELESCOPES for picture in telescope.pictures}
    telescopes = manifest(sizes)["telescopes"]
    hubble = telescopes["S20580"]
    assert hubble["source"] == "ESA/Hubble"
    assert hubble["licence"] == "CC BY 4.0"
    assert hubble["pictures"][0]["page"] == "https://esahubble.org/images/heic0611b/"
    assert hubble["pictures"][0]["thumb"] == "pictures/hubble/heic0611b-thumb.webp"
    webb = telescopes["D01093"]
    assert webb["licence"] == "CC BY 4.0"
    assert webb["licenceUrl"] == "https://creativecommons.org/licenses/by/4.0/"
    assert len(webb["pictures"]) == len(WEBB.pictures)
    first = webb["pictures"][0]
    assert first["thumb"] == "pictures/webb/weic2209a-thumb.webp"
    assert first["large"] == "pictures/webb/weic2209a.webp"
    assert (first["width"], first["height"]) == (1280, 720)
