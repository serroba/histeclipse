/**
 * The Temperature layer's part of the Earth shader: the maps either side of the moment, blended;
 * the colour scales the deep-time bar's legend draws (`ui/temperatureLegend.ts`); and, for
 * Krapp et al.'s maps on today's geography, the change from today's map (#457).
 *
 * A map's red channel is the temperature, `tempRange` °C at bytes 0 and 255; its alpha says
 * where it has any (Krapp's leave out the sea and the ice sheets). Where it has none, the
 * surface keeps its relief colours. Krapp's maps carry today's temperature too, in green, and
 * where today has any, in blue: one texture per map, as the shader has no unit to spare for a
 * third (WebGL guarantees 16, and the Earth shader uses them all).
 */

import { Vector2, type Texture } from 'three';

export const TEMPERATURE_GLSL = /* glsl */ `
  uniform sampler2D tempYounger;
  uniform sampler2D tempOlder;
  uniform float tempMix;
  uniform float tempActive;
  uniform float tempChange;
  uniform vec2 tempGrid;
  uniform vec2 tempRange;

  // Node-registered like the elevation maps, so the same half-pixel shift applies. Returns the
  // temperature then and today, °C, and how much of each map there is there (0 to 1).
  vec4 paleoTemperatureFrom(sampler2D map, vec2 uv) {
    vec2 at = (uv * (tempGrid - 1.0) + 0.5) / tempGrid;
    vec4 texel = texture2D(map, at);
    return vec4(mix(tempRange.xx, tempRange.yy, texel.rg), texel.ab);
  }

  vec4 paleoTemperature(vec2 uv) {
    return mix(paleoTemperatureFrom(tempYounger, uv), paleoTemperatureFrom(tempOlder, uv), tempMix);
  }

  // A diverging scale, blue through pale yellow to red (ColorBrewer RdYlBu), °C. The legend in
  // the deep-time bar draws the same stops.
  vec3 temperatureColour(float celsius) {
    vec3 c = srgb(vec3(0.192, 0.212, 0.584));
    c = mix(c, srgb(vec3(0.271, 0.459, 0.706)), smoothstep(-40.0, -20.0, celsius));
    c = mix(c, srgb(vec3(0.569, 0.749, 0.859)), smoothstep(-20.0, -5.0, celsius));
    c = mix(c, srgb(vec3(0.878, 0.953, 0.973)), smoothstep(-5.0, 5.0, celsius));
    c = mix(c, srgb(vec3(0.996, 0.878, 0.565)), smoothstep(5.0, 15.0, celsius));
    c = mix(c, srgb(vec3(0.992, 0.682, 0.380)), smoothstep(15.0, 22.0, celsius));
    c = mix(c, srgb(vec3(0.957, 0.427, 0.263)), smoothstep(22.0, 28.0, celsius));
    c = mix(c, srgb(vec3(0.843, 0.188, 0.153)), smoothstep(28.0, 35.0, celsius));
    return mix(c, srgb(vec3(0.647, 0.0, 0.149)), smoothstep(35.0, 45.0, celsius));
  }

  // The change from today, °C: blue colder, red warmer; near today, uncoloured (below). The
  // legend's CHANGE_STOPS draw the same.
  vec3 changeColour(float delta) {
    vec3 c = srgb(vec3(0.192, 0.212, 0.584));
    c = mix(c, srgb(vec3(0.271, 0.459, 0.706)), smoothstep(-20.0, -10.0, delta));
    c = mix(c, srgb(vec3(0.455, 0.678, 0.820)), smoothstep(-10.0, -4.0, delta));
    c = mix(c, srgb(vec3(0.671, 0.851, 0.914)), smoothstep(-4.0, -1.0, delta));
    // No pale middle: near today the layer fades out instead, so neither side reads as ice.
    c = mix(c, srgb(vec3(0.996, 0.878, 0.565)), step(0.0, delta));
    c = mix(c, srgb(vec3(0.992, 0.682, 0.380)), smoothstep(1.0, 4.0, delta));
    return mix(c, srgb(vec3(0.843, 0.188, 0.153)), smoothstep(4.0, 10.0, delta));
  }

  // The layer's colour at uv, and how much of it covers the surface there.
  vec4 temperatureLayer(vec2 uv) {
    // x then, y today, z where then has data, w where today has.
    vec4 t = paleoTemperature(uv);
    if (tempChange < 0.5) return vec4(temperatureColour(t.x), t.z);
    // Within about a degree of today the land keeps its own colours: the scale's near-white
    // middle read as ice on the Holocene's ice-free continents. The colour comes in by 1.5 °C.
    float delta = t.x - t.y;
    return vec4(changeColour(delta), min(t.z, t.w) * smoothstep(0.5, 1.5, abs(delta)));
  }
`;

/** The uniforms `TEMPERATURE_GLSL` reads, off until a surface is set. */
export function temperatureUniforms(): Record<string, { value: unknown }> {
  return {
    tempYounger: { value: null as Texture | null },
    tempOlder: { value: null as Texture | null },
    tempMix: { value: 0 },
    tempActive: { value: 0 },
    tempChange: { value: 0 },
    tempGrid: { value: new Vector2(361, 181) },
    tempRange: { value: new Vector2(-60, 60) },
  };
}
