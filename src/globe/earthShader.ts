/**
 * The Earth's shaders (#379): the ground in historical and deep time, the light, and the drawings
 * over it, with the features' parts called in order (see earthParts.ts). The globe builds the
 * fragment shader once, from the parts it is given.
 */

import { EARTH_FRAGMENT_STRUCT, type AssembledParts } from './earthParts';
import { SEA_ICE } from './seaIceShader';
import { TEMPERATURE_GLSL } from './temperatureShader';

// Custom shaders include three.js's logarithmic-depth chunks: the scene spans from metres above
// the ground to beyond the Sun, which a linear depth buffer cannot resolve.
export const EARTH_VERTEX = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec2 vUv;
  varying vec3 vNormal;
  void main() {
    vUv = uv;
    vNormal = normal;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    #include <logdepthbuf_vertex>
  }
`;

// Day side lit by the Sun, a twilight band down to about −6° (civil twilight), a dim blue night
// side (no city lights: they would be anachronistic for most of history), and a faint warm glow
// along the terminator. The parts features bring (#379) are called over the lit ground, in order.
const EARTH_HEAD = /* glsl */ `
  #include <logdepthbuf_pars_fragment>
  uniform sampler2D dayMap;
  // Where the day map lies on the globe's map, and how opaque: a tile's part of it (#568).
  uniform vec4 dayRect;
  uniform float dayAlpha;
  // Deep time: two elevation maps (bytes 0–127 sea floor, 128–255 land) and the blend between.
  uniform sampler2D paleoYounger;
  uniform sampler2D paleoOlder;
  uniform float paleoMix;
  uniform float paleoActive;
  uniform float evenLight;
  uniform sampler2D shelfMap;
  uniform float shelfActive;
  uniform vec2 shelfGrid;
  uniform vec2 shelfRange;
  uniform float seaLevel;
  uniform sampler2D iceYounger;
  uniform sampler2D iceOlder;
  uniform float iceMix;
  uniform float iceActive;
  uniform vec2 iceGrid;
  uniform float iceStep;
  uniform sampler2D plateYounger;
  uniform sampler2D plateOlder;
  uniform float plateMix;
  uniform float plateActive;
  uniform vec2 plateGrid;
  uniform vec2 plateTurn;
  uniform float uncharted;
  uniform float sketchKind;
  uniform float sketchLevel;
  uniform float sketchIceEdge;
  uniform vec2 paleoGrid;
  uniform float seaDepth;
  uniform float landHeight;
  // Shared by the empires map (historical time) and the sketch's noise (deep time), which never
  // show together: a seventeenth texture would pass the 16 that many GPUs allow a shader.
  uniform sampler2D overlayMap;
  uniform float empiresActive;
  uniform float iceOutlinesActive;
  // The Moon and Sun in the scene, for the Moon's shadow at any moment.
  uniform vec3 moonPosition;
  uniform float moonRadius;
  uniform vec3 sunPosition;
  uniform float sunRadius;
  uniform vec3 sunDirection;
  varying vec2 vUv;
  varying vec3 vNormal;
`;

// The ground, the light, and the drawings before the parts, up to where they are called.
const EARTH_BODY = /* glsl */ `
  // The elevation maps are node-registered (the first and last columns are both 180°), so a
  // texture coordinate is moved half a pixel to land on the nodes.
  float paleoElevation(sampler2D map, vec2 uv) {
    vec2 at = (uv * (paleoGrid - 1.0) + 0.5) / paleoGrid;
    float byte = texture2D(map, at).r * 255.0;
    // Sea level falls between bytes 127 and 128, so blended bytes cross it smoothly there.
    return byte >= 127.5
      ? (byte - 127.5) / 127.5 * landHeight
      : -(127.5 - byte) / 127.5 * seaDepth;
  }

  vec3 srgb(vec3 c) { return pow(c, vec3(2.2)); }
  ${SEA_ICE}

  const float PI = 3.141592653589793;
  const float EARTH_RADIUS_M = 6371000.0;

  float paleoHeight(vec2 uv) {
    return mix(paleoElevation(paleoYounger, uv), paleoElevation(paleoOlder, uv), paleoMix);
  }

  // Hypsometric colours: deep blue sea floor to pale shallows; green lowlands, ochre uplands,
  // brown mountains, white peaks. No ice or vegetation: the maps give only height.
  vec3 seaColour(float height) {
    float depth = clamp(-height / 6000.0, 0.0, 1.0);
    vec3 shelf = mix(srgb(vec3(0.36, 0.64, 0.78)), srgb(vec3(0.13, 0.34, 0.58)), smoothstep(0.0, 0.08, depth));
    return mix(shelf, srgb(vec3(0.04, 0.12, 0.30)), smoothstep(0.08, 1.0, depth));
  }

  vec3 landColour(float height) {
    vec3 color = mix(srgb(vec3(0.33, 0.50, 0.26)), srgb(vec3(0.66, 0.60, 0.40)), smoothstep(0.0, 1200.0, height));
    color = mix(color, srgb(vec3(0.52, 0.40, 0.29)), smoothstep(1200.0, 2800.0, height));
    return mix(color, srgb(vec3(0.92, 0.92, 0.90)), smoothstep(3500.0, 5000.0, height));
  }

  ${TEMPERATURE_GLSL}

  // Node-registered like the other deep-time maps; a byte per iceStep metres, 0 for no ice.
  float iceFrom(sampler2D map, vec2 uv) {
    vec2 at = (uv * (iceGrid - 1.0) + 0.5) / iceGrid;
    return texture2D(map, at).r * 255.0 * iceStep;
  }

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
  vec3 withPlates(vec3 color, vec2 uv, float filled) {
    if (plateActive < 0.5) return color;
    // Each mask turned east by its own amount: sampled that far west.
    vec2 atYounger = (vec2(fract(uv.x - plateTurn.x / 360.0), uv.y) * (plateGrid - 1.0) + 0.5) / plateGrid;
    vec2 atOlder = (vec2(fract(uv.x - plateTurn.y / 360.0), uv.y) * (plateGrid - 1.0) + 0.5) / plateGrid;
    float inside = mix(texture2D(plateYounger, atYounger).r, texture2D(plateOlder, atOlder).r, plateMix);
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
    return smoothstep(sketchIceEdge - blur, sketchIceEdge + blur, latitude);
  }

  vec3 sketchSurface(vec2 uv) {
    if (sketchKind < 0.5) return unchartedSurface(uv);
    float noise = texture2D(overlayMap, uv).r;
    vec3 color;
    if (sketchKind < 1.5) {
      // Chilled crust, darker where thicker, split by thin seams of glowing melt.
      // Held below 1, so the highest values don't wrap to a dark patch.
      float band = fract(min(noise, 0.99) * 4.0);
      float seam = abs(band - 0.5);
      float glow = 1.0 - smoothstep(0.0, 0.035 + fwidth(noise) * 4.0, seam);
      vec3 crust = mix(srgb(vec3(0.16, 0.05, 0.03)), srgb(vec3(0.42, 0.12, 0.04)), band);
      color = mix(crust, srgb(vec3(1.0, 0.62, 0.2)), glow);
    } else {
      float blur = max(fwidth(noise), 1e-3);
      float land = smoothstep(sketchLevel - blur, sketchLevel + blur, noise);
      // Bare rock: there were no plants on land.
      color = mix(srgb(vec3(0.12, 0.25, 0.36)), srgb(vec3(0.50, 0.45, 0.38)), land);
    }
    color = mix(color, srgb(vec3(0.92, 0.95, 0.99)), sketchIce(uv));
    return mix(color, srgb(vec3(0.42, 0.50, 0.62)), 0.35 * gridLine(uv));
  }

  vec3 paleoSurface(vec2 uv) {
    // Under a sketch's ice, a reconstruction's continents keep only their outline.
    if (uncharted > 0.5) return withPlates(sketchSurface(uv), uv, 1.0 - sketchIce(uv));
    float height = paleoHeight(uv);
    // Where the coast runs comes from heights averaged over about half a degree (a tent of
    // nine samples): some source grids draw coasts in 0.5–1° steps, and this rounds them off.
    // Colours and shading keep the full detail.
    vec2 reach = 2.5 / (paleoGrid - 1.0);
    float coast = 0.0;
    for (int i = -1; i <= 1; i++) {
      for (int j = -1; j <= 1; j++) {
        float weight = (2.0 - abs(float(i))) * (2.0 - abs(float(j)));
        coast += weight * paleoHeight(uv + vec2(float(i), float(j)) * reach);
      }
    }
    coast = mix(height, coast / 16.0, 0.85);
    // The coast blends over about a screen pixel, so it is smooth at any zoom.
    float blur = max(fwidth(coast), 1.0);
    vec3 color = mix(seaColour(min(height, -1.0)), landColour(max(height, 0.0)), smoothstep(-blur, blur, coast));
    if (shelfActive > 0.5) {
      // Ice ages: today's land and sea floor, cut at the sea level of the moment. Within the
      // shelf map's band (-200 to +55 m) its finer 0.1° heights decide; beyond, the map's.
      vec2 at = (uv * (shelfGrid - 1.0) + 0.5) / shelfGrid;
      float shelf = mix(shelfRange.x, shelfRange.y, texture2D(shelfMap, at).r);
      float inBand = step(shelfRange.x + 0.5, shelf) * step(shelf, shelfRange.y - 0.5);
      coast = mix(height, shelf, inBand) - seaLevel;
      blur = max(fwidth(coast), 1.0);
      // Shelf below today's sea level, laid bare: land, in a sandier tint so it stands out.
      float bared = (1.0 - step(0.0, shelf)) * inBand;
      vec3 land = mix(landColour(max(height, 0.0)), srgb(vec3(0.72, 0.68, 0.46)), bared);
      float depth = min(mix(height, shelf, inBand) - seaLevel, -1.0);
      color = mix(seaColour(depth), land, smoothstep(-blur, blur, coast));
    }
    // Hill shading, lit from the north-west as maps are: slopes from the neighbouring nodes,
    // ten times steeper than they are so ranges show from orbit.
    vec2 step_ = 1.0 / (paleoGrid - 1.0);
    float east = paleoHeight(uv + vec2(step_.x, 0.0)) - paleoHeight(uv - vec2(step_.x, 0.0));
    float north = paleoHeight(uv + vec2(0.0, step_.y)) - paleoHeight(uv - vec2(0.0, step_.y));
    // Two nodes apart, in metres: rows span half a circumference, columns a whole one,
    // narrowing with latitude.
    float latitude = (uv.y - 0.5) * PI;
    float southNorth = 2.0 * PI * EARTH_RADIUS_M * step_.y;
    float westEast = 2.0 * 2.0 * PI * EARTH_RADIUS_M * step_.x * max(cos(latitude), 0.05);
    vec3 normal = normalize(vec3(-10.0 * east / westEast, -10.0 * north / southNorth, 1.0));
    vec3 light = normalize(vec3(-1.0, 1.0, 1.4));
    float shade = dot(normal, light) / light.z;
    if (tempActive > 0.5) {
      // Temperature over the relief: the sea darker and the coast drawn as a thin dark line,
      // so the continents still read where land and sea are the same temperature. Where the
      // maps have none (Krapp's sea and ice sheets), the relief shows.
      float sea = 1.0 - smoothstep(-blur, blur, coast);
      float shore = 1.0 - smoothstep(blur, 3.0 * blur, abs(coast));
      // A land-only map's 1° cells reach the coast drawn here (its edge values carry over into
      // the empty cells), but colour the sea only where a map has data in full: a land map's
      // blend into its empty sea cells is not the sea's (#587).
      float data;
      vec4 temp = temperatureLayer(uv, sea, data);
      float cover = smoothstep(0.0, 0.2, temp.a) * mix(1.0, step(0.999, data), sea);
      color = mix(color, temp.rgb * (1.0 - 0.3 * sea) * (1.0 - 0.55 * shore), cover);
    }
    color = seaIceOver(color, uv, 1.0 - smoothstep(-blur, blur, coast));
    if (iceActive > 0.5) {
      // Ice sheets: white, a little blue where thin; the edge blends over about a pixel.
      float thickness = mix(iceFrom(iceYounger, uv), iceFrom(iceOlder, uv), iceMix);
      float iceBlur = max(fwidth(thickness), 1.0);
      float covered = smoothstep(8.0 - iceBlur, 8.0 + iceBlur, thickness);
      vec3 ice = mix(srgb(vec3(0.78, 0.87, 0.95)), srgb(vec3(0.97, 0.98, 1.0)), smoothstep(0.0, 2000.0, thickness));
      color = mix(color, ice, covered);
    }
    color *= clamp(mix(1.0, shade, 0.7), 0.45, 1.35);
    return withPlates(color, uv, 0.0);
  }

  // Travelling through the Holocene: today's Earth, with the shelf a lower sea left bare (in
  // the sand tint the ice ages use) and the ice sheets that still lay on the land.
  vec3 holoceneSurface(vec2 uv) {
    vec3 color = texture2D(dayMap, (uv - dayRect.xy) / dayRect.zw).rgb;
    float sea = 1.0;
    if (shelfActive > 0.5) {
      vec2 at = (uv * (shelfGrid - 1.0) + 0.5) / shelfGrid;
      float shelf = mix(shelfRange.x, shelfRange.y, texture2D(shelfMap, at).r);
      // Above the sea of the year and below today's: land then, sea now.
      float coast = shelf - seaLevel;
      float blur = max(fwidth(coast), 1.0);
      float bared = smoothstep(-blur, blur, coast) * (1.0 - smoothstep(-blur, blur, shelf));
      color = mix(color, srgb(vec3(0.72, 0.68, 0.46)), bared);
      sea = 1.0 - smoothstep(-blur, blur, coast);
    }
    // The sea-ice maps are empty over today's land; the shelf, where loaded, masks the bared.
    color = seaIceOver(color, uv, sea);
    if (iceActive > 0.5) {
      float thickness = mix(iceFrom(iceYounger, uv), iceFrom(iceOlder, uv), iceMix);
      float iceBlur = max(fwidth(thickness), 1.0);
      float covered = smoothstep(8.0 - iceBlur, 8.0 + iceBlur, thickness);
      vec3 ice = mix(srgb(vec3(0.78, 0.87, 0.95)), srgb(vec3(0.97, 0.98, 1.0)), smoothstep(0.0, 2000.0, thickness));
      color = mix(color, ice, covered);
    }
    return color;
  }

  // Past states and empires, painted on a map in the ground texture's layout. Each keeps its
  // colour by night too, a little dimmer, so borders read on both sides.
  vec3 empiresLayer(vec3 color, float daylight) {
    vec4 painted = texture2D(overlayMap, vUv);
    vec3 tinted = mix(color, painted.rgb * (0.45 + 0.55 * daylight), painted.a * 0.85);
    return mix(color, tinted, empiresActive);
  }

  // Deep time's ice-sheet outlines, on the same map as the states (never shown together), drawn
  // over deep time's even light.
  vec3 iceOutlinesLayer(vec3 color) {
    vec4 painted = texture2D(overlayMap, vUv);
    return mix(color, mix(color, painted.rgb, painted.a), iceOutlinesActive);
  }

  void main() {
    #include <logdepthbuf_fragment>
    vec3 normal = normalize(vNormal);
    float sunAltitude = dot(normal, sunDirection);
    vec3 surface = paleoActive > 0.5 ? paleoSurface(vUv) : holoceneSurface(vUv);
    float daylight = smoothstep(-0.105, 0.035, sunAltitude);
    vec3 lit = surface * (0.45 + 0.75 * clamp(sunAltitude, 0.0, 1.0));
    vec3 night = surface * vec3(0.035, 0.05, 0.09) + vec3(0.004, 0.008, 0.02);
    vec3 color = mix(night, lit, daylight);
    float terminator = exp(-pow(sunAltitude / 0.05, 2.0));
    color += vec3(1.0, 0.5, 0.18) * terminator * 0.12;
    color = empiresLayer(color, daylight);
    float latitude = asin(clamp(normal.y, -1.0, 1.0));
    float longitude = atan(-normal.z, normal.x);
    EarthFragment f = EarthFragment(surface, night, normal, vUv, daylight, latitude, longitude);
`;

// After the parts: deep time's even light, and what goes over it.
const EARTH_TAIL = /* glsl */ `    // Deep time: no one can say what hour it was, and days were shorter, so there is no night
    // side. A soft light from the viewer keeps the globe round.
    float facing = max(dot(normal, normalize(cameraPosition)), 0.0);
    color = mix(color, surface * (0.6 + 0.45 * facing), evenLight);
    // The Holocene's track lights evenly too: its states, ways of life and rocks go back over
    // the evenly lit ground (in deep time none of them is on).
    color = mix(color, empiresLayer(color, 1.0), evenLight);
    color = iceOutlinesLayer(color);
    gl_FragColor = vec4(color, dayAlpha);
    #include <colorspace_fragment>
  }
`;

export function earthFragment(parts: Pick<AssembledParts, 'glsl' | 'calls'>): string {
  return `${EARTH_HEAD}${EARTH_FRAGMENT_STRUCT}\n${parts.glsl}\n${EARTH_BODY}    ${parts.calls}\n${EARTH_TAIL}`;
}
