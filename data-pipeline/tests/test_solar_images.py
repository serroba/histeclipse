import io
import urllib.parse
from typing import TYPE_CHECKING

import pytest
from PIL import Image

from histeclipse_pipeline.solar_images import (
    DISK_RADIUS,
    LAYERS,
    SIZES,
    Observation,
    closest_image_url,
    file_name,
    image_scale,
    manifest,
    parse_closest_image,
    screenshot_url,
    to_webp,
)

if TYPE_CHECKING:
    from histeclipse_pipeline.sky import Json

# Helioviewer's answer for AIA 171 closest to 2024-05-08 12:00 UT.
CLOSEST: Json = {
    "id": "156546053",
    "date": "2024-05-08 12:00:09",
    "name": "AIA 171",
    "scale": 0.6057011012014786,
    "rsun": 1584.3538,
    "rotation": 0,
}


def test_reads_when_the_image_was_taken_and_the_suns_size() -> None:
    observation = parse_closest_image(CLOSEST)
    assert observation["date"] == "2024-05-08T12:00:09Z"
    # Early May: the Sun is about 959.6 arcseconds in radius.
    assert observation["radius_arcsec"] == pytest.approx(959.64, abs=0.01)


@pytest.mark.parametrize(
    ("body", "message"),
    [
        ([], "expected an object"),
        ({"scale": 1, "rsun": 1}, "missing date"),
        ({"date": "2024-05-08 12:00:09", "rsun": 1}, "missing scale or rsun"),
    ],
)
def test_rejects_answers_without_what_it_needs(body: Json, message: str) -> None:
    with pytest.raises(TypeError, match=message):
        _ = parse_closest_image(body)


def test_chooses_a_scale_that_puts_the_limb_at_the_disk_radius() -> None:
    scale = image_scale(959.64, 2048)
    assert 959.64 / scale == pytest.approx(DISK_RADIUS * 2048)


def test_builds_helioviewer_queries() -> None:
    layer = LAYERS[3]
    closest = urllib.parse.urlparse(closest_image_url(layer, "2024-05-08T12:00:00Z"))
    assert urllib.parse.parse_qs(closest.query) == {
        "date": ["2024-05-08T12:00:00Z"],
        "sourceId": [str(layer.source_id)],
    }
    shot = urllib.parse.parse_qs(
        urllib.parse.urlparse(screenshot_url(layer, "2024-05-08T12:00:00Z", 1.5, 512)).query
    )
    assert shot["layers"] == ["[SDO,AIA,AIA,171,1,100]"]
    assert shot["imageScale"] == ["1.500000"]
    assert shot["width"] == shot["height"] == ["512"]
    # Centred on the Sun, with no overlays or watermark.
    assert shot["x0"] == shot["y0"] == ["0"]
    assert shot["watermark"] == ["false"]


def test_reencodes_frames_as_webp_keeping_transparency() -> None:
    png = io.BytesIO()
    Image.new("RGBA", (8, 8), (255, 200, 0, 0)).save(png, format="PNG")
    with Image.open(io.BytesIO(to_webp(png.getvalue()))) as image:
        assert image.format == "WEBP"
        assert image.size == (8, 8)
        assert image.mode == "RGBA"


def test_lists_every_layer_and_size_in_the_manifest() -> None:
    observed: Observation = {"date": "2024-05-08T12:00:09Z", "radius_arcsec": 959.6}
    result = manifest({layer.key: observed for layer in LAYERS})
    assert result["diskRadius"] == DISK_RADIUS
    assert [entry["key"] for entry in result["layers"]] == [layer.key for layer in LAYERS]
    first = result["layers"][0]
    assert first["files"] == {
        str(size): f"textures/sun/{file_name(LAYERS[0], size)}" for size in SIZES
    }
    assert first["observed"] == "2024-05-08T12:00:09Z"
