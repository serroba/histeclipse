/**
 * The inner disc after the giant impact as a sheet (#1311): molten and partly vapour, from Earth's
 * surface out to the Roche limit, thinning as it clears, with a faint circle at the limit, named,
 * so the gap out to the Moon reads as where tides kept the debris from gathering, not as the
 * Moon's orbit. How much is seen at a moment, `innerDiscAt` in `impactModel.ts` says.
 *
 * Three.js glue for `impactLayer.ts`, which adds its group to the impact's own and updates it.
 */

import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  LineBasicMaterial,
  LineLoop,
  Mesh,
  RingGeometry,
  ShaderMaterial,
  Vector3,
} from 'three';

import type { LayerHost } from '../../globe/layerHost';
import type { Hit } from '../../deepTime/theia';
import { glowColour } from './heatColour';
import { innerDiscAt, ROCHE, type Triple } from './impactModel';
import './innerDisc.css';

/** How bright the sheet is at its densest, as a share of full. */
const SHEET_GLOW = 0.35;
/** How bright the circle at the limit is. */
const LIMIT_GLOW = 0.4;
/** Points round the circle, and of them, those tried for where its name goes. */
const SEGMENTS = 128;
const NAME_TRIES = 16;

/** A flat ring in the equator, its glow soft at both edges. */
function sheetMaterial(colour: Color): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { colour: { value: colour }, opacity: { value: 0 } },
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: AdditiveBlending,
    vertexShader: `
      varying float vR;
      void main() {
        vR = length(position.xy);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 colour;
      uniform float opacity;
      varying float vR;
      void main() {
        float edge = smoothstep(1.0, 1.4, vR) * (1.0 - smoothstep(${ROCHE.toFixed(2)} - 0.5, ${ROCHE.toFixed(2)}, vR));
        // Its strength in alpha: the canvas is see-through over the page, so an alpha of 1
        // would draw the sheet black where it is faint.
        gl_FragColor = vec4(colour, opacity * edge);
      }`,
  });
}

export interface InnerDisc {
  readonly group: Group;
  /**
   * Draw it at `seconds` since the impact, for `hit`, the Moon at `moon` (in the disc's frame) to
   * keep the name clear of; null hides it.
   */
  update(
    moment: { readonly seconds: number; readonly hit: Hit } | null,
    moon?: Triple | null,
  ): void;
  dispose(): void;
}

export function innerDisc(
  host: Pick<LayerHost, 'camera' | 'container' | 'afterRender'>,
): InnerDisc {
  const group = new Group();
  group.visible = false;
  const colour = new Color();
  const sheet = new Mesh(new RingGeometry(1, ROCHE, SEGMENTS, 8), sheetMaterial(colour));
  // The ring is made in its x–y plane; the equator is the x–z plane.
  sheet.rotation.x = -Math.PI / 2;
  const circle = Array.from({ length: SEGMENTS }, (_, index) => {
    const angle = (2 * Math.PI * index) / SEGMENTS;
    return new Vector3(ROCHE * Math.cos(angle), 0, ROCHE * Math.sin(angle));
  });
  const limit = new LineLoop(
    new BufferGeometry().setFromPoints(circle),
    new LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }),
  );
  group.add(sheet, limit);

  const name = document.createElement('span');
  name.className = 'formation-roche';
  name.dataset['testid'] = 'formation-roche';
  name.textContent = 'Roche limit';
  name.hidden = true;
  host.container.append(name);
  const point = new Vector3();
  const moonAt = new Vector3();
  let moon: Triple | null = null;

  /** Where `local`, in the disc's frame, is on screen, pixels; null behind the camera. */
  function onScreen(local: Vector3): { x: number; y: number } | null {
    const { camera, container } = host;
    group.localToWorld(local).project(camera);
    if (local.z >= 1) return null;
    return {
      x: ((local.x + 1) / 2) * container.clientWidth,
      y: ((1 - local.y) / 2) * container.clientHeight,
    };
  }

  // The name sits on the circle where it is furthest on screen from the Moon, so they never meet;
  // with no Moon yet, at the circle's top.
  host.afterRender(() => {
    if (!group.visible) return;
    const from = moon === null ? null : onScreen(moonAt.set(...moon));
    let best: { x: number; y: number; score: number } | null = null;
    for (let index = 0; index < SEGMENTS; index += SEGMENTS / NAME_TRIES) {
      const at = onScreen(point.copy(circle[index] ?? point));
      if (at === null) continue;
      const score = from === null ? -at.y : Math.hypot(at.x - from.x, at.y - from.y);
      if (best === null || score > best.score) best = { ...at, score };
    }
    if (best === null) return;
    name.style.transform = `translate(${String(best.x)}px, ${String(best.y)}px) translate(-50%, -130%)`;
  });

  return {
    group,
    update(moment, moonPlace = null) {
      moon = moonPlace;
      const seen = moment === null ? null : innerDiscAt(moment.seconds, moment.hit);
      group.visible = seen !== null;
      if (name.hidden === (seen !== null)) name.hidden = seen === null;
      if (seen === null) return;
      colour.setRGB(...glowColour(seen.heat));
      if (sheet.material.uniforms['opacity'] !== undefined)
        sheet.material.uniforms['opacity'].value = SHEET_GLOW * seen.opacity;
      limit.material.opacity = LIMIT_GLOW * seen.opacity;
      name.style.opacity = String(seen.opacity);
    },
    dispose() {
      sheet.geometry.dispose();
      sheet.material.dispose();
      limit.geometry.dispose();
      limit.material.dispose();
      name.remove();
      group.removeFromParent();
    },
  };
}
