/**
 * The Moon's shadow on the ground, a part of the Earth shader (#379): its uniforms and its GLSL,
 * and nothing else, as it is loaded with the globe. The layer that sets it is moonShadow.ts.
 *
 * One drawing, two sources. A selected solar eclipse's shadow comes from the catalog's Besselian
 * elements, which match its path exactly; otherwise the shadow comes straight from where the Sun
 * and Moon are, which the globe keeps in its shared uniforms (see EARTH_SHARED_UNIFORMS).
 */

import { Vector4, type IUniform } from 'three';

import { EARTH_PART_ORDER, type EarthPart } from '../../globe/earthParts';
import { OCCULTATION, SOLAR_COMMON } from '../../globe/solarShaders';

type MoonShadowUniforms = Readonly<{
  /** 1 while a selected eclipse's shadow is drawn from the catalog, else 0. */
  solarActive: IUniform<number>;
  /** x, y, d (radians), mu (radians, ΔT applied). */
  shadowAxis: IUniform<Vector4>;
  /** l1, l2, tan f1, tan f2. */
  shadowCones: IUniform<Vector4>;
}>;

export const MOON_SHADOW_PART: EarthPart<MoonShadowUniforms> = {
  name: 'moonShadow',
  order: EARTH_PART_ORDER.moonShadow,
  uniforms: () => ({
    solarActive: { value: 0 },
    shadowAxis: { value: new Vector4() },
    shadowCones: { value: new Vector4() },
  }),
  glsl: /* glsl */ `
  ${SOLAR_COMMON}
  ${OCCULTATION}
  uniform float solarActive;
  uniform vec4 shadowAxis;   // x, y, d (radians), mu (radians, ΔT applied)
  uniform vec4 shadowCones;  // l1, l2, tan f1, tan f2

  // The Moon's shadow uses the night side's own palette, so it reads as "night in daytime":
  // the umbra is fully night-dark, and the penumbra deepens toward it as more of the Sun is
  // covered.
  vec3 catalogShadow(vec3 color, vec3 night, float latitude, float longitude) {
    vec3 observer = observerInPlane(latitude, longitude, shadowAxis.z, shadowAxis.w);
    if (observer.z <= 0.0) return color;
    float penumbra = shadowCones.x - observer.z * shadowCones.z;
    float umbra = shadowCones.y - observer.z * shadowCones.w;
    float axisDistance = length(shadowAxis.xy - observer.xy);
    float magnitude = clamp((penumbra - axisDistance) / (penumbra + umbra), 0.0, 1.0);
    // Exaggerated on purpose, so the shadow reads as night in daytime. The brightness is
    // chosen perceptually and then linearised (gamma 2.2): the output is sRGB-encoded, so a
    // linear dimming that looks dark on paper looks faint on screen.
    float perceived = 1.0 - 0.9 * pow(magnitude, 0.6);
    vec3 shaded = max(color * pow(perceived, 2.2), night);
    // The umbra itself is full night.
    float core = 1.0 - smoothstep(abs(umbra) * 0.6, abs(umbra) * 1.15, axisDistance);
    return mix(shaded, night, core);
  }

  vec3 moonShadow(vec3 color, EarthFragment f) {
    // A selected solar eclipse draws its shadow from the catalog's Besselian elements, which
    // match its path exactly; otherwise the Moon's shadow comes straight from the geometry.
    if (solarActive > 0.5) return catalogShadow(color, f.night, f.latitude, f.longitude);
    // Before the Moon is placed, there is no shadow to cast.
    if (moonRadius <= 0.0) return color;
    // On the unit sphere, the surface point is its normal.
    float sunlight = sunlightAt(f.normal, sunPosition, sunRadius, moonPosition, moonRadius);
    float perceived = 1.0 - 0.9 * pow(1.0 - sunlight, 0.6);
    vec3 shaded = max(color * pow(perceived, 2.2), f.night);
    return mix(shaded, f.night, step(sunlight, 0.0));
  }
`,
};
