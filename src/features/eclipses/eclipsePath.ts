/**
 * A solar eclipse's path on the globe (#379): drawn once per eclipse into a texture from its
 * Besselian elements, for ΔT and ΔT ± σ, then laid over the ground by the eclipse path's part
 * of the Earth shader (eclipsePathPart.ts).
 */

import {
  LinearFilter,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderTarget,
} from 'three';

import type { BesselianElements } from '../../data/solarCatalog';
import { ELEMENTS_HALF_SPAN_HOURS, SIDEREAL_DEGREES_PER_SECOND } from '../../eclipses/solar';
import type { LayerFactory } from '../../globe/layerHost';
import { SOLAR_COMMON, SOLAR_PATH_FRAGMENT } from '../../globe/solarShaders';
import { ECLIPSE_PATH_PART } from './eclipsePathPart';

/** A solar eclipse's path: its elements, the ΔT to draw it for, and ΔT's uncertainty. */
export interface SolarPath {
  readonly elements: BesselianElements;
  readonly deltaTSeconds: number;
  readonly uncertaintySeconds: number;
}

// A full-screen quad: position is already in clip space.
const PATH_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const TO_RADIANS = Math.PI / 180;

/** Four coefficients of a polynomial in time, scaled. */
function coefficients(values: readonly number[], scale = 1): Vector4 {
  return new Vector4(
    (values[0] ?? 0) * scale,
    (values[1] ?? 0) * scale,
    (values[2] ?? 0) * scale,
    (values[3] ?? 0) * scale,
  );
}

/** The path for a selected solar eclipse; null hides it. */
export const eclipsePathLayer: LayerFactory<SolarPath | null> = (host) => {
  const shown = host.earthPart(ECLIPSE_PATH_PART);
  const target = new WebGLRenderTarget(1024, 512, {
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    depthBuffer: false,
  });
  const uniforms = {
    coefficientsX: { value: new Vector4() },
    coefficientsY: { value: new Vector4() },
    coefficientsD: { value: new Vector4() },
    coefficientsMu: { value: new Vector4() },
    coefficientsL1: { value: new Vector4() },
    coefficientsL2: { value: new Vector4() },
    tangents: { value: new Vector2() },
    muShifts: { value: new Vector3() },
    halfSpanHours: { value: ELEMENTS_HALF_SPAN_HOURS },
  };
  const material = new ShaderMaterial({
    uniforms,
    vertexShader: PATH_VERTEX,
    fragmentShader: `${SOLAR_COMMON}${SOLAR_PATH_FRAGMENT}`,
    depthTest: false,
  });
  const scene = new Scene();
  scene.add(new Mesh(new PlaneGeometry(2, 2), material));
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  shown.solarPath.value = target.texture;

  return {
    update(path) {
      if (path !== null) {
        const { elements } = path;
        uniforms.coefficientsX.value = coefficients(elements.x);
        uniforms.coefficientsY.value = coefficients(elements.y);
        uniforms.coefficientsD.value = coefficients(elements.d, TO_RADIANS);
        uniforms.coefficientsMu.value = coefficients(elements.mu, TO_RADIANS);
        uniforms.coefficientsL1.value = coefficients(elements.l1);
        uniforms.coefficientsL2.value = coefficients(elements.l2);
        uniforms.tangents.value = new Vector2(elements.tanF1, elements.tanF2);
        const shift = (seconds: number): number =>
          seconds * SIDEREAL_DEGREES_PER_SECOND * TO_RADIANS;
        uniforms.muShifts.value = new Vector3(
          shift(path.deltaTSeconds),
          shift(path.deltaTSeconds - path.uncertaintySeconds),
          shift(path.deltaTSeconds + path.uncertaintySeconds),
        );
        host.renderToTexture(target, scene, camera);
      }
      shown.solarPathActive.value = path === null ? 0 : 1;
      host.container.dataset['solarPath'] = path === null ? 'off' : 'on';
      host.requestRender();
    },
    dispose() {
      target.dispose();
      material.dispose();
    },
  };
};
