/**
 * Where a lunar eclipse could be seen (#379): the ground where the eclipsed Moon was up, as if lit
 * by a copper Moon, the band ΔT leaves uncertain hatched, and a ring where it stood overhead. A
 * part of the Earth shader, and the layer that sets it.
 */

import { Vector3, type IUniform } from 'three';

import { EARTH_PART_ORDER, type EarthPart } from '../../globe/earthParts';
import type { Vector3Tuple } from '../../globe/geo';
import type { LayerFactory } from '../../globe/layerHost';

/** Where an eclipsed Moon was overhead, nominally and at ±1σ of ΔT. */
export interface LunarOverlay {
  readonly sublunar: Vector3Tuple;
  readonly west: Vector3Tuple;
  readonly east: Vector3Tuple;
  /** 0 to 1: fainter during the barely visible penumbral phase. */
  readonly strength: number;
}

/** Its uniforms: how strongly it shows, and where the Moon was overhead, nominally and at ±1σ. */
type LunarUniforms = Readonly<{
  lunarActive: IUniform<number>;
  moonCenter: IUniform<Vector3>;
  moonWest: IUniform<Vector3>;
  moonEast: IUniform<Vector3>;
}>;

function lunarUniforms(): LunarUniforms {
  return {
    lunarActive: { value: 0 },
    moonCenter: { value: new Vector3(1, 0, 0) },
    moonWest: { value: new Vector3(1, 0, 0) },
    moonEast: { value: new Vector3(1, 0, 0) },
  };
}

export const LUNAR_OVERLAY_PART: EarthPart<LunarUniforms> = {
  name: 'lunarOverlay',
  order: EARTH_PART_ORDER.lunarOverlay,
  uniforms: lunarUniforms,
  glsl: /* glsl */ `
  uniform float lunarActive;
  uniform vec3 moonCenter;
  uniform vec3 moonWest;
  uniform vec3 moonEast;

  // Copper, the colour of a totally eclipsed Moon.
  const vec3 ECLIPSE_TINT = vec3(1.0, 0.42, 0.22);

  // The map stays readable: where the eclipsed Moon was up, the ground is shown as if lit by
  // a copper Moon; the uncertain band is hatched; a ring marks where it stood overhead.
  vec3 lunarOverlay(vec3 color, EarthFragment f) {
    vec3 surface = f.surface;
    vec3 normal = f.normal;
    float upCenter = step(0.0, dot(normal, moonCenter));
    float upWest = step(0.0, dot(normal, moonWest));
    float upEast = step(0.0, dot(normal, moonEast));
    float certain = upWest * upEast * upCenter;
    float uncertain = max(max(upWest, upEast), upCenter) - certain;
    vec3 moonlit = surface * vec3(0.62, 0.42, 0.34) + ECLIPSE_TINT * 0.035;
    vec3 tinted = mix(color, max(color, moonlit), certain);
    float hatch = step(0.55, fract((gl_FragCoord.x + gl_FragCoord.y) / 10.0));
    tinted = mix(tinted, max(color, moonlit * 0.8), uncertain * hatch);
    float edge = 1.0 - smoothstep(0.0, 0.004, abs(dot(normal, moonCenter)));
    tinted += ECLIPSE_TINT * edge * 0.35;
    float angle = dot(normal, moonCenter);
    float ring = smoothstep(0.99925, 0.9994, angle) * (1.0 - smoothstep(0.99955, 0.9997, angle));
    float dot_ = smoothstep(0.99985, 0.99992, angle);
    tinted = mix(tinted, vec3(1.0, 0.72, 0.52), max(ring, dot_));
    return mix(color, tinted, lunarActive);
  }
`,
};

/** Where the eclipsed Moon is up now; null hides it. */
export const lunarOverlayLayer: LayerFactory<LunarOverlay | null> = (host) => {
  const uniforms = host.earthPart(LUNAR_OVERLAY_PART);
  return {
    update(overlay) {
      uniforms.lunarActive.value = overlay === null ? 0 : overlay.strength;
      if (overlay !== null) {
        uniforms.moonCenter.value.set(...overlay.sublunar).normalize();
        uniforms.moonWest.value.set(...overlay.west).normalize();
        uniforms.moonEast.value.set(...overlay.east).normalize();
      }
      host.container.dataset['lunarOverlay'] = overlay === null ? 'off' : 'on';
      host.requestRender();
    },
  };
};
