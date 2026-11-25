/**
 * The oxygen-poor seas, a part of the Earth shader (#1208): water without oxygen spreading in
 * patches round a place, drawn only over the sea of the moment, as deep time's heights say, and
 * darkest over the shallow shelves where the black shales were laid down. Where the heights are
 * not drawn (`paleoActive`), nothing is. Its uniforms are set by `seasLayer.ts`.
 */

import { Vector4, type IUniform } from 'three';

import { EARTH_PART_ORDER, type EarthPart } from '../../globe/earthParts';

/** How many patches the water spreads in. */
export const ANOXIA_PATCHES = 9;

type AnoxicSeasUniforms = Readonly<{
  anoxiaStrength: IUniform<number>;
  /** Each patch: its centre, a unit vector on Earth, and its reach, radians. */
  anoxiaPatches: IUniform<Vector4[]>;
}>;

export const ANOXIC_SEAS_PART: EarthPart<AnoxicSeasUniforms> = {
  name: 'anoxicSeas',
  order: EARTH_PART_ORDER.anoxicSeas,
  // Watched in deep time, where the even light would wash it out.
  overEvenLight: true,
  uniforms: () => ({
    anoxiaStrength: { value: 0 },
    anoxiaPatches: {
      value: Array.from({ length: ANOXIA_PATCHES }, () => new Vector4(1, 0, 0, 0)),
    },
  }),
  glsl: /* glsl */ `
  uniform float anoxiaStrength;
  uniform vec4 anoxiaPatches[${String(ANOXIA_PATCHES)}];

  vec3 anoxicSeas(vec3 color, EarthFragment f) {
    if (anoxiaStrength <= 0.0 || paleoActive < 0.5) return color;
    float height = paleoHeight(f.uv);
    float sea = 1.0 - smoothstep(-20.0, 0.0, height);
    if (sea <= 0.0) return color;
    float cover = 0.0;
    for (int i = 0; i < ${String(ANOXIA_PATCHES)}; i++) {
      vec4 patch_ = anoxiaPatches[i];
      if (patch_.w <= 0.0) continue;
      float angle = acos(clamp(dot(f.normal, patch_.xyz), -1.0, 1.0));
      cover = max(cover, 1.0 - smoothstep(0.5 * patch_.w, patch_.w, angle));
    }
    // Darkest over the shelves, where the black shales were laid; fainter over the deep sea.
    float shelf = mix(0.55, 1.0, smoothstep(-2000.0, -200.0, height));
    // A murky olive, the sulfidic water's, set apart from the sea's blues (#1226).
    return mix(color, vec3(0.22, 0.21, 0.07), 0.85 * anoxiaStrength * cover * sea * shelf);
  }
`,
};
