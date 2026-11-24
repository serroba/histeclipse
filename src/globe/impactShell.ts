/**
 * A worldwide impact's shell over the whole globe (#1167): a front of hot ejecta running from the
 * crater to the far side, the sky glowing red behind it as the ejecta fall back in, then a veil
 * of dust and soot that slowly clears. `shellAt` says what the short illustration shows at
 * each moment (the hours and years compressed into seconds), the strike clock says it from real
 * time (`impactLook.ts`), and `createImpactShell` draws either.
 */

import { Color, Mesh, ShaderMaterial, SphereGeometry, type Vector3 } from 'three';

import { clamp01 } from '../util/timing';

/** Milliseconds the ejecta's front takes from the crater to the far side. */
export const FRONT_MS = 3600;
/** Milliseconds the veil takes to clear, at the end. */
const CLEARING_MS = 2400;

/** What the shell shows at a moment: its front's reach, radians, and how bright each part is. */
export interface ShellMoment {
  readonly visible: boolean;
  readonly front: number;
  readonly frontGlow: number;
  readonly ember: number;
  readonly veil: number;
}

/**
 * The shell `since` ms after the strike, its play ending at `until`, for an impact reaching
 * `worldwide` (0 to 1) of the way round: nothing before the strike; the front out, slowing as it
 * goes; the glow, then the veil, darkening as the front goes and clearing at the end.
 */
export function shellAt(since: number, until: number, worldwide: number): ShellMoment {
  if (since < 0) return { visible: false, front: 0, frontGlow: 0, ember: 0, veil: 0 };
  const out = clamp01(since / FRONT_MS);
  const clearing = clamp01((since - (until - CLEARING_MS)) / CLEARING_MS);
  return {
    visible: true,
    front: Math.PI * worldwide * (1 - (1 - out) ** 2),
    frontGlow: out < 1 ? worldwide * (1 - 0.5 * out) : 0,
    ember: clamp01(since / 500) * (1 - clamp01((since - FRONT_MS * 0.6) / 2000)),
    veil: 0.72 * worldwide * out * (1 - clearing),
  };
}

const SHELL_VERTEX = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec3 vLocal;
  void main() {
    vLocal = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    #include <logdepthbuf_vertex>
  }
`;

/**
 * The shell over the whole globe: a bright front `front` radians from the crater, the sky behind
 * it glowing (`ember`) and then veiled (`veil`), as dust and soot spread round the Earth.
 */
const SHELL_FRAGMENT = /* glsl */ `
  #include <logdepthbuf_pars_fragment>
  uniform vec3 center;
  uniform float front;
  uniform float width;
  uniform float frontGlow;
  uniform float ember;
  uniform float veil;
  uniform vec3 frontColor;
  uniform vec3 emberColor;
  uniform vec3 sootColor;
  varying vec3 vLocal;
  void main() {
    #include <logdepthbuf_fragment>
    float angle = acos(clamp(dot(normalize(vLocal), center), -1.0, 1.0));
    float band = (angle - front) / width;
    float bright = frontGlow * exp(-band * band);
    // Behind the front, and a little thicker nearer the crater.
    float behind = smoothstep(front + width, front - width, angle);
    float near = 1.0 - 0.35 * angle / 3.14159;
    float sky = behind * near;
    vec3 tint = mix(sootColor, emberColor, ember);
    float skyAlpha = sky * max(veil, 0.55 * ember);
    float alpha = clamp(bright + skyAlpha * (1.0 - bright), 0.0, 1.0);
    vec3 color = mix(tint, frontColor, bright / max(alpha, 0.0001));
    gl_FragColor = vec4(color, alpha);
  }
`;

/** The worldwide shell's colours: its front, its glowing sky and its veil. */
const FIERY = [new Color(1, 0.78, 0.45), new Color(0.95, 0.32, 0.08), new Color(0.1, 0.08, 0.07)];
const ICY = [new Color(0.75, 0.9, 1), new Color(0.45, 0.7, 1), new Color(0.55, 0.6, 0.66)];

export interface ImpactShell {
  readonly mesh: Mesh<SphereGeometry, ShaderMaterial>;
  /** Show it as `moment` has it. */
  show(moment: ShellMoment): void;
  dispose(): void;
}

/** The shell for an impact at `center` (a unit vector, Earth-fixed), fiery or icy. */
export function createImpactShell(center: Vector3, icy: boolean): ImpactShell {
  const [frontColor, emberColor, sootColor] = icy ? ICY : FIERY;
  const uniforms = {
    center: { value: center.clone().normalize() },
    front: { value: 0 },
    width: { value: 0.16 },
    frontGlow: { value: 0 },
    ember: { value: 0 },
    veil: { value: 0 },
    frontColor: { value: frontColor },
    emberColor: { value: emberColor },
    sootColor: { value: sootColor },
  };
  const mesh = new Mesh(
    new SphereGeometry(1.006, 96, 48),
    new ShaderMaterial({
      uniforms,
      vertexShader: SHELL_VERTEX,
      fragmentShader: SHELL_FRAGMENT,
      transparent: true,
      depthWrite: false,
    }),
  );
  mesh.name = 'impact-worldwide';
  mesh.visible = false;
  return {
    mesh,
    show(moment) {
      mesh.visible = moment.visible;
      uniforms.front.value = moment.front;
      uniforms.frontGlow.value = moment.frontGlow;
      uniforms.ember.value = moment.ember;
      uniforms.veil.value = moment.veil;
    },
    dispose() {
      mesh.geometry.dispose();
      mesh.material.dispose();
    },
  };
}
