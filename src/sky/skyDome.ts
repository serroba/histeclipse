/**
 * The sky's glow and the ground (#603): the dome behind everything, lit by the Sun, and the
 * ground drawn last, over the Sun's glow below the horizon.
 */

import { BackSide, Mesh, ShaderMaterial, SphereGeometry } from 'three';
import type { ProjectionUniforms } from './skyFrame';
import { DOME_VERTEX, GROUND_FRAGMENT, SKY_FRAGMENT } from './skyShaders';
import type { SunLight } from './skySun';

export function createSkyDome(
  projection: ProjectionUniforms,
  light: SunLight,
): { readonly dome: Mesh; readonly ground: Mesh } {
  const { sunDirection, sunAltitude, sunlight } = light;
  const dome = new Mesh(
    new SphereGeometry(500, 64, 32),
    new ShaderMaterial({
      uniforms: { ...projection, sunDirection, sunAltitude, sunlight },
      vertexShader: DOME_VERTEX,
      fragmentShader: SKY_FRAGMENT,
      side: BackSide,
      depthTest: false,
      depthWrite: false,
    }),
  );
  dome.renderOrder = 0;
  const ground = new Mesh(
    new SphereGeometry(50, 64, 32),
    new ShaderMaterial({
      uniforms: { ...projection, sunAltitude, sunlight },
      vertexShader: DOME_VERTEX,
      fragmentShader: GROUND_FRAGMENT,
      side: BackSide,
      depthTest: false,
      depthWrite: false,
      // three.js draws transparent objects after opaque ones whatever their renderOrder, so the
      // ground must be "transparent" to be drawn last, over the Sun's glow below the horizon.
      transparent: true,
    }),
  );
  ground.renderOrder = 4;
  return { dome, ground };
}
