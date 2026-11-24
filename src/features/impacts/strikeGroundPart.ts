/**
 * The strike's ground, a part of the Earth shader (#1175, #1176): round a strike watched in its
 * own time, the crater forming close up, and from middle distance the ejecta blanket over the
 * land and the tsunami's crests over the sea. The tsunami needs deep time's heights to know sea
 * from land, so it is drawn only where they are (`paleoActive`). Its uniforms are set from
 * `strikeGround` by `strikeGroundLayer.ts`.
 */

import { Vector3, type IUniform } from 'three';

import { EARTH_PART_ORDER, type EarthPart } from '../../globe/earthParts';

type StrikeGroundUniforms = Readonly<{
  strikeActive: IUniform<number>;
  /** Where it struck, a unit vector on Earth. */
  strikeCenter: IUniform<Vector3>;
  /** Cavity radius (km), depth, uplift and peak ring (0 to 1). */
  strikeCrater: IUniform<[number, number, number, number]>;
  /** Rim (0 to 1), blanket reach (radians) and strength, tsunami front (radians). */
  strikeSpread: IUniform<[number, number, number, number]>;
  strikeTsunami: IUniform<number>;
}>;

export const STRIKE_GROUND_PART: EarthPart<StrikeGroundUniforms> = {
  name: 'strikeGround',
  order: EARTH_PART_ORDER.strikeGround,
  // Watched in deep time, where the even light would wash it out.
  overEvenLight: true,
  uniforms: () => ({
    strikeActive: { value: 0 },
    strikeCenter: { value: new Vector3(1, 0, 0) },
    strikeCrater: { value: [0, 0, 0, 0] },
    strikeSpread: { value: [0, 0, 0, 0] },
    strikeTsunami: { value: 0 },
  }),
  glsl: /* glsl */ `
  uniform float strikeActive;
  uniform vec3 strikeCenter;
  uniform vec4 strikeCrater;
  uniform vec4 strikeSpread;
  uniform float strikeTsunami;

  vec3 strikeGround(vec3 color, EarthFragment f) {
    if (strikeActive <= 0.0) return color;
    float angle = acos(clamp(dot(f.normal, strikeCenter), -1.0, 1.0));
    float km = angle * 6371.0;
    // Seen from further than this, the globe shows only the strike's sky (impactShell.ts).
    float away = length(cameraPosition);
    float middle = 1.0 - smoothstep(3.0, 3.8, away);
    float close = 1.0 - smoothstep(1.3, 1.7, away);
    if (middle <= 0.0) return color;

    // The ejecta blanket: thinning as the cube of distance from the rim (McGetchin et al. 1973),
    // drawn by the logarithm of its thickness, a centimetre to a kilometre.
    float r = max(km, 100.0) / 100.0;
    float metres = 0.14 * pow(100000.0, 0.74) / (r * r * r);
    float thick = clamp((log(metres) / log(10.0) + 2.0) / 5.0, 0.0, 1.0);
    float reached = 1.0 - smoothstep(strikeSpread.y - 0.01, strikeSpread.y, angle);
    vec3 dust = vec3(0.36, 0.3, 0.24);
    color = mix(color, dust, 0.75 * thick * reached * strikeSpread.z * middle);

    // The tsunami: crests behind its front over the sea, weaker as they spread round the globe.
    if (paleoActive > 0.5 && strikeTsunami > 0.0) {
      float sea = 1.0 - smoothstep(-30.0, 0.0, paleoHeight(f.uv));
      float behind = strikeSpread.w - angle;
      // Crests a few hundred kilometres apart, drawn wider than the sea's, to be seen at all.
      float train = step(0.0, behind) * exp(-behind / 0.2);
      float crests = pow(0.5 + 0.5 * cos(6.2831853 * behind / 0.035), 4.0);
      float spread = clamp(0.25 / sqrt(max(sin(angle), 0.02)), 0.0, 1.0);
      float wave = crests * train * spread * strikeTsunami * sea * middle;
      color = mix(color, vec3(0.9, 0.97, 1.0), 0.9 * wave);
    }

    // The crater, close up: the cavity's floor in shadow, its edge lit, the uplift and the ring
    // of peaks rising from its floor, and the final rim. The peak ring's place is illustrative.
    if (close > 0.0 && strikeCrater.x > 0.0) {
      float inside = 1.0 - smoothstep(strikeCrater.x - 2.0, strikeCrater.x + 2.0, km);
      float bowl = 1.0 - pow(km / strikeCrater.x, 2.0);
      vec3 crater = mix(color, color * 0.35, clamp(bowl, 0.0, 1.0) * strikeCrater.y * inside);
      float edge = exp(-pow((km - strikeCrater.x) / 4.0, 2.0));
      crater = mix(crater, vec3(0.95, 0.82, 0.62), 0.6 * edge * max(strikeCrater.y, strikeSpread.x));
      float uplift = exp(-pow(km / 18.0, 2.0)) * strikeCrater.z;
      crater = mix(crater, vec3(1.0, 0.9, 0.7), 0.85 * uplift);
      float ring = exp(-pow((km - 45.0) / 5.0, 2.0)) * strikeCrater.w;
      crater = mix(crater, vec3(0.9, 0.78, 0.6), 0.7 * ring);
      color = mix(color, crater, close);
    }
    return color;
  }
`,
};
