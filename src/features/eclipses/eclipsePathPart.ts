/**
 * The eclipse path's part of the Earth shader (#379): its uniforms and its GLSL, and nothing
 * else, as it is loaded with the globe. The path is drawn into a texture beforehand (in
 * eclipsePath.ts, the layer that sets this); the shader lays it over the ground: the path of
 * totality or annularity for ΔT, the band ΔT's uncertainty leaves hatched, and the partial
 * eclipse's limits as a dashed line.
 */

import type { IUniform, Texture } from 'three';

import { EARTH_PART_ORDER, type EarthPart } from '../../globe/earthParts';

type EclipsePathUniforms = Readonly<{
  /** R, G, B: in the path for ΔT, ΔT − σ, ΔT + σ. A: the deepest partial eclipse. */
  solarPath: IUniform<Texture | null>;
  solarPathActive: IUniform<number>;
}>;

export const ECLIPSE_PATH_PART: EarthPart<EclipsePathUniforms> = {
  name: 'eclipsePath',
  order: EARTH_PART_ORDER.eclipsePath,
  uniforms: () => ({ solarPath: { value: null }, solarPathActive: { value: 0 } }),
  glsl: /* glsl */ `
  uniform sampler2D solarPath;
  uniform float solarPathActive;

  vec3 eclipsePath(vec3 color, EarthFragment f) {
    // Off: nothing to work out (every pixel takes the same way, so the test costs nothing).
    if (solarPathActive <= 0.0) return color;
    vec4 path = texture2D(solarPath, f.uv);
    float certain = path.r * path.g * path.b;
    float possible = max(max(path.r, path.g), path.b);
    float uncertain = possible - certain;
    float hatch = step(0.55, fract((gl_FragCoord.x - gl_FragCoord.y) / 10.0));
    vec3 tint = vec3(0.98, 0.83, 0.42);
    vec3 painted = mix(color, color * 0.75 + tint * 0.25, certain * 0.6);
    painted = mix(painted, color * 0.75 + tint * 0.22, uncertain * hatch * 0.85);
    // The limits of the partial eclipse: a thin, dashed, pale-blue line, so it can't be mistaken
    // for the path of totality.
    float limit = smoothstep(0.0, 0.002, path.a) * (1.0 - smoothstep(0.004, 0.008, path.a));
    float dash = step(0.5, fract((gl_FragCoord.x + gl_FragCoord.y) / 14.0));
    painted = mix(painted, vec3(0.62, 0.78, 1.0), limit * dash * 0.7);
    return mix(color, painted, solarPathActive);
  }
`,
};
