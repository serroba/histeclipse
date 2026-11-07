import io
import urllib.parse
from typing import TYPE_CHECKING

import numpy as np
import pytest
from PIL import Image

from histeclipse_pipeline.arrays import FloatArray, as_floats
from histeclipse_pipeline.solar_images import (
    DISK_RADIUS,
    LAYERS,
    MAP_SIZES,
    SIZES,
    closest_image_url,
    decode,
    disc_name,
    encode,
    frame_dates,
    image_scale,
    manifest,
    map_name,
    parse_closest_image,
    resized,
    screenshot_url,
    shifted,
    stitch,
    to_webp,
)
from histeclipse_pipeline.sun_map import Frame, disc_radii

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


def test_spaces_four_frames_a_quarter_turn_apart_ending_on_the_date() -> None:
    assert frame_dates("2024-05-08T12:00:00Z") == [
        "2024-04-18T01:02:40Z",
        "2024-04-24T20:41:47Z",
        "2024-05-01T16:20:53Z",
        "2024-05-08T12:00:00Z",
    ]
    assert shifted("2024-05-08T12:00:00Z", -3) == "2024-05-08T09:00:00Z"


def test_decodes_and_encodes_frames() -> None:
    png = io.BytesIO()
    Image.new("RGBA", (8, 4), (255, 51, 0, 0)).save(png, format="PNG")
    pixels = decode(png.getvalue())
    assert pixels.shape == (4, 8, 3)
    assert as_floats(np.ravel(pixels[:1, :1])) == pytest.approx([1, 0.2, 0])
    image = encode(pixels)
    assert image.size == (8, 4)
    assert resized(image, 4).size == (4, 2)
    assert resized(image, 8) is image
    with Image.open(io.BytesIO(to_webp(image))) as webp:
        assert webp.format == "WEBP"
        assert webp.size == (8, 4)


def _disc(size: int, value: float) -> FloatArray:
    r = disc_radii(Frame(np.zeros((size, size, 3)), 0, DISK_RADIUS))
    return np.repeat(np.where(r < 1, value, 0.0)[..., np.newaxis], 3, axis=2)


@pytest.mark.parametrize("key", ["visible", "magnetogram"])
def test_stitches_a_whole_surface_map(key: str) -> None:
    layer = next(layer for layer in LAYERS if layer.key == key)
    frames = [(_disc(96, 0.5), moment) for moment in frame_dates()]
    surface = stitch(layer, frames, 64)
    assert surface.shape == (32, 64, 3)
    # A uniform Sun seen from every side stitches to a uniform map, poles and all.
    assert np.allclose(surface, 0.5, atol=0.02)


def test_lists_every_layer_its_frames_and_files_in_the_manifest() -> None:
    frames = ["2024-04-18T01:02:48Z", "2024-05-08T12:00:09Z"]
    result = manifest({layer.key: frames for layer in LAYERS})
    assert result["schemaVersion"] == 3
    assert result["diskRadius"] == DISK_RADIUS
    assert [entry["key"] for entry in result["layers"]] == [layer.key for layer in LAYERS]
    first = result["layers"][0]
    assert first["frames"] == frames
    assert first["map"] == {
        str(width): f"textures/sun/{map_name(LAYERS[0], width)}" for width in MAP_SIZES
    }
    assert first["disc"] == {
        str(size): f"textures/sun/{disc_name(LAYERS[0], size)}" for size in SIZES
    }
    assert first["map"]["4096"] == "textures/sun/visible-map-4096.webp"
    # Named by what each shows, the light it is beneath (#249).
    named = {entry["key"]: (entry["label"], entry["detail"]) for entry in result["layers"]}
    assert named["304"] == ("Chromosphere", "304 Å · 50,000 °C")
    assert named["visible"] == ("Surface", "visible light, 617 nm")
