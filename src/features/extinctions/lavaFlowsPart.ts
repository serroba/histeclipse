/**
 * The flood lavas, a part of the Earth shader (#1212): round each vent of a volcanic province,
 * lava spreading over the land as far as the province has erupted by then, glowing orange where it
 * is still flowing, at its fronts and by the vents, and cooling to dark basalt behind. The fronts
 * are lobed, as flows are, and the glow flickers as the clock plays. Over the sea of the moment,
 * where deep time's heights say so, nothing is drawn. An illustration. Its uniforms are set by
 * `fumesLayer.ts`.
 */

import { Vector4, type IUniform } from 'three';

import { EARTH_PART_ORDER, type EarthPart } from '../../globe/earthParts';

/** How many vents the lava flows from: the fumes' vents. */
export const LAVA_VENTS = 18;

type LavaFlowsUniforms = Readonly<{
  /** How much of the province has flowed, 0 to 1: how far the lava reaches. */
  lavaCover: IUniform<number>;
  /** How strongly it is erupting now, 0 to 1: how much of it glows. */
  lavaHeat: IUniform<number>;
  /** Time played, seconds, for the flicker. */
  lavaTime: IUniform<number>;
  /** Each vent: a unit vector on Earth, and how far its lava can reach, radians. */
  lavaVents: IUniform<Vector4[]>;
}>;

export const LAVA_FLOWS_PART: EarthPart<LavaFlowsUniforms> = {
  name: 'lavaFlows',
  order: EARTH_PART_ORDER.lavaFlows,
  // Watched in deep time, where the even light would wash it out.
  overEvenLight: true,
  uniforms: () => ({
    lavaCover: { value: 0 },
    lavaHeat: { value: 0 },
    lavaTime: { value: 0 },
    lavaVents: { value: Array.from({ length: LAVA_VENTS }, () => new Vector4(1, 0, 0, 0)) },
  }),
  glsl: /* glsl */ `
  uniform float lavaCover;
  uniform float lavaHeat;
  uniform float lavaTime;
  uniform vec4 lavaVents[${String(LAVA_VENTS)}];

  vec3 lavaFlows(vec3 color, EarthFragment f) {
    if (lavaCover <= 0.0) return color;
    float land = 1.0;
    if (paleoActive > 0.5) land = smoothstep(-20.0, 0.0, paleoHeight(f.uv));
    if (land <= 0.0) return color;
    float flow = 0.0;
    float deep = 0.0;
    float front = 0.0;
    float source = 0.0;
    for (int i = 0; i < ${String(LAVA_VENTS)}; i++) {
      vec4 vent = lavaVents[i];
      if (vent.w <= 0.0) continue;
      float angle = acos(clamp(dot(f.normal, vent.xyz), -1.0, 1.0));
      // Lobed, uneven fronts (#1226): the reach wavers round the vent on three scales,
      // differently for each, so the flood's edge is ragged rather than a ring of scallops.
      vec3 side = normalize(f.normal - vent.xyz * dot(f.normal, vent.xyz) + 1e-6);
      float seed = float(i) * 1.7;
      float lobes = 0.8
        + 0.12 * sin(3.0 * side.x + 5.0 * side.y + 2.0 * side.z + seed)
        + 0.06 * sin(11.0 * side.y - 7.0 * side.z + 6.0 * side.x + 2.3 * seed)
        + 0.03 * sin(29.0 * side.z + 23.0 * side.x - 17.0 * side.y + 4.1 * seed);
      float reach = vent.w * sqrt(lavaCover) * lobes;
      float inside = 1.0 - smoothstep(0.85 * reach, reach, angle);
      flow = max(flow, inside);
      // Well inside this flow: another's front there is under it, not glowing.
      deep = max(deep, 1.0 - smoothstep(0.7 * reach, 0.8 * reach, angle));
      front = max(front, inside * exp(-pow((angle - 0.95 * reach) / (0.04 * vent.w + 1e-4), 2.0)));
      source = max(source, exp(-pow(angle / (0.12 * vent.w + 1e-4), 2.0)));
    }
    // Hot at the flood's outer front, still moving, and by the vents.
    float hot = max(front * (1.0 - deep), source);
    // Basalt, a little uneven from flow to flow, as fresh and older lavas are.
    float grain = 0.5 + 0.5 * sin(f.normal.x * 83.0 + f.normal.y * 61.0 - f.normal.z * 47.0);
    vec3 basalt = mix(vec3(0.08, 0.075, 0.07), vec3(0.15, 0.13, 0.12), grain);
    color = mix(color, basalt, 0.85 * flow * land);
    float flicker = 0.8 + 0.2 * sin(lavaTime * 9.0 + f.normal.x * 40.0 + f.normal.z * 31.0);
    // A dull red where it crusts, orange only where hottest.
    vec3 glow = mix(vec3(0.6, 0.1, 0.03), vec3(0.95, 0.5, 0.12), hot * hot);
    return mix(color, glow, clamp(0.75 * hot * lavaHeat * flicker * land, 0.0, 1.0));
  }
`,
};
