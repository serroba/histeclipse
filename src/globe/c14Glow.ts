/**
 * Where cosmic rays make carbon-14 (#269): a glow in a shell over the air, by latitude, brighter
 * where more is made. Drawn about the spin axis, which the magnetic field lines up with when
 * averaged over thousands of years; today's field is tilted about 10° from it.
 *
 * Three.js glue, covered by the Playwright suite; the rates are in `data/radiocarbonProduction`.
 */

import { FrontSide, Mesh, ShaderMaterial, SphereGeometry } from 'three';

/** Latitudes in the profile: every 5° from the equator to the pole. */
export const GLOW_ROWS = 19;

const VERTEX = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec3 vLocal;
  varying vec3 vViewNormal;
  void main() {
    vLocal = position;
    vViewNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    #include <logdepthbuf_vertex>
  }
`;

const FRAGMENT = /* glsl */ `
  #include <logdepthbuf_pars_fragment>
  uniform float strength[${String(GLOW_ROWS)}];
  varying vec3 vLocal;
  varying vec3 vViewNormal;
  void main() {
    #include <logdepthbuf_fragment>
    float latitude = degrees(asin(clamp(abs(normalize(vLocal).y), 0.0, 1.0)));
    float at = latitude / 5.0;
    int row = int(floor(at));
    float low = 0.0;
    float high = 0.0;
    for (int i = 0; i < ${String(GLOW_ROWS)}; i++) {
      if (i == row) low = strength[i];
      if (i == min(row + 1, ${String(GLOW_ROWS - 1)})) high = strength[i];
    }
    float value = mix(low, high, fract(at));
    // Thicker toward the rim, as a shell of air seen edge-on.
    float rim = 0.55 + 0.45 * (1.0 - abs(dot(vViewNormal, vec3(0.0, 0.0, 1.0))));
    // A violet veil, deeper where more is made; it saturates well above today's polar rate.
    float glow = (1.0 - exp(-1.6 * value)) * rim;
    gl_FragColor = vec4(vec3(0.72, 0.48, 1.0), 0.62 * glow);
  }
`;

export interface C14Glow {
  readonly mesh: Mesh<SphereGeometry, ShaderMaterial>;
  /** Show it with each latitude's rate, 1 for today's over the poles; null hides it. */
  set(profile: readonly number[] | null): void;
  dispose(): void;
}

export function createC14Glow(): C14Glow {
  const strength = { value: Array.from({ length: GLOW_ROWS }, () => 0) };
  const mesh = new Mesh(
    // Carbon-14 is made high in the air: a shell just above the ground.
    new SphereGeometry(1.012, 96, 48),
    new ShaderMaterial({
      uniforms: { strength },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      side: FrontSide,
      transparent: true,
      depthWrite: false,
    }),
  );
  mesh.name = 'c14-glow';
  mesh.visible = false;
  return {
    mesh,
    set(profile) {
      mesh.visible = profile !== null;
      if (profile === null) return;
      strength.value = Array.from({ length: GLOW_ROWS }, (_, i) => profile[i] ?? 0);
    },
    dispose() {
      mesh.geometry.dispose();
      mesh.material.dispose();
    },
  };
}
