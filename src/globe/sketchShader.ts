/**
 * Before the elevation maps on the Earth shader: the plain globe and its grid, a second
 * reconstruction's continents (outlined for the Plates layer, or as a sketch's land, #1149), and
 * the sketch of a hypothesis: molten, or ocean with land, ice poleward of an edge. Needs srgb
 * and overlayMap defined before it.
 */
import { DataTexture, LinearFilter, RedFormat, RepeatWrapping, UnsignedByteType } from 'three';

import { LAND_NOISE_GRID, landNoise, shareAtOrAbove } from '../deepTime/landScheme';

/** The sketch's noise field as a texture, made once, wrapping east–west. */
export function sketchTexture(): { readonly texture: DataTexture; readonly shares: Float64Array } {
  const { columns, rows } = LAND_NOISE_GRID;
  const field = landNoise(columns, rows);
  const texture = new DataTexture(field, columns, rows, RedFormat, UnsignedByteType);
  texture.wrapS = RepeatWrapping;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return { texture, shares: shareAtOrAbove(field, columns, rows) };
}

export const SKETCH = /* glsl */ `
  uniform sampler2D plateYounger;
  uniform sampler2D plateOlder;
  uniform float plateMix;
  uniform float plateActive;
  uniform float plateOutline;
  uniform vec2 plateGrid;
  uniform vec2 plateTurn;
  uniform float sketchKind;
  uniform float sketchMolten;
  uniform float sketchPlates;
  uniform float sketchLevel;
  uniform float sketchIceEdge;

  // No map before the elevation maps reach: a plain globe, with a graticule every 30 degrees so
  // it still reads as a sphere turning.
  float gridLine(vec2 uv) {
    vec2 degrees = vec2(uv.x * 360.0, uv.y * 180.0);
    vec2 toLine = abs(fract(degrees / 30.0 + 0.5) - 0.5) * 30.0;
    vec2 width = fwidth(degrees) * 0.8;
    return 1.0 - min(smoothstep(0.0, width.x, toLine.x), smoothstep(0.0, width.y, toLine.y));
  }

  vec3 unchartedSurface(vec2 uv) {
    return mix(srgb(vec3(0.20, 0.25, 0.33)), srgb(vec3(0.42, 0.50, 0.62)), gridLine(uv) * 0.6);
  }

  // A second reconstruction's continents as a thin magenta line, a pixel or two wide at any
  // zoom, where its mask crosses one half. On the blank globe, before the elevation maps reach,
  // they are filled in too: the only continents drawn there.
  float plateInside(vec2 uv) {
    // Each mask turned east by its own amount: sampled that far west.
    vec2 atYounger = (vec2(fract(uv.x - plateTurn.x / 360.0), uv.y) * (plateGrid - 1.0) + 0.5) / plateGrid;
    vec2 atOlder = (vec2(fract(uv.x - plateTurn.y / 360.0), uv.y) * (plateGrid - 1.0) + 0.5) / plateGrid;
    return mix(texture2D(plateYounger, atYounger).r, texture2D(plateOlder, atOlder).r, plateMix);
  }

  vec3 withPlates(vec3 color, vec2 uv, float filled) {
    // Outlined only for the Plates layer; otherwise the masks are a sketch's land (#1149).
    if (plateActive < 0.5 || plateOutline < 0.5) return color;
    float inside = plateInside(uv);
    float blur = 1.5 * max(fwidth(inside), 1e-4);
    color = mix(color, srgb(vec3(0.55, 0.45, 0.58)), filled * 0.55 * smoothstep(0.5 - blur, 0.5 + blur, inside));
    float edge = 1.0 - smoothstep(0.0, blur, abs(inside - 0.5));
    return mix(color, srgb(vec3(1.0, 0.42, 0.84)), edge * 0.9);
  }

  // A hypothesis sketched on the plain globe: a molten surface with glowing seams, or an ocean
  // with land of invented shape cut from a noise field, and ice poleward of an edge. The grid
  // stays on top, faintly, so it reads as a sketch and not a map.
  float sketchIce(vec2 uv) {
    if (sketchKind < 0.5) return 0.0;
    float latitude = abs(uv.y - 0.5) * 180.0;
    float blur = max(fwidth(latitude), 0.3);
    return smoothstep(sketchIceEdge - blur, sketchIceEdge + blur, latitude) * (1.0 - sketchMolten);
  }

  vec3 sketchSurface(vec2 uv) {
    if (sketchKind < 0.5) return unchartedSurface(uv);
    float noise = texture2D(overlayMap, uv).r;
    // Chilled crust, darker where thicker, split by thin seams of glowing melt.
    // Held below 1, so the highest values don't wrap to a dark patch.
    float band = fract(min(noise, 0.99) * 4.0);
    float seam = abs(band - 0.5);
    float glow = 1.0 - smoothstep(0.0, 0.035 + fwidth(noise) * 4.0, seam);
    vec3 crust = mix(srgb(vec3(0.16, 0.05, 0.03)), srgb(vec3(0.42, 0.12, 0.04)), band);
    vec3 molten = mix(crust, srgb(vec3(1.0, 0.62, 0.2)), glow);
    float blur = max(fwidth(noise), 1e-3);
    float land = smoothstep(sketchLevel - blur, sketchLevel + blur, noise);
    // Bare rock: there were no plants on land.
    vec3 ocean = mix(srgb(vec3(0.12, 0.25, 0.36)), srgb(vec3(0.50, 0.45, 0.38)), land);
    // Where the plates reach, their continents, not invented land (#1149): continental crust,
    // flooded or not, so drawn as the maps draw their shallows, which they then become.
    if (sketchPlates > 0.5) {
      float inside = plateInside(uv);
      float edge = 1.5 * max(fwidth(inside), 1e-4);
      float crust = plateActive > 0.5 ? smoothstep(0.5 - edge, 0.5 + edge, inside) : 0.0;
      ocean = mix(srgb(vec3(0.12, 0.25, 0.36)), srgb(vec3(0.36, 0.64, 0.78)), crust);
    }
    // The one cross-faded into the other (#1140): the change itself is within a frame of play.
    vec3 color = mix(ocean, molten, sketchMolten);
    color = mix(color, srgb(vec3(0.92, 0.95, 0.99)), sketchIce(uv));
    return mix(color, srgb(vec3(0.42, 0.50, 0.62)), 0.35 * gridLine(uv));
  }

  // Under a sketch's ice, a reconstruction's continents keep only their outline.
  vec3 sketchedSurface(vec2 uv) {
    return withPlates(sketchSurface(uv), uv, 1.0 - sketchIce(uv));
  }
`;
