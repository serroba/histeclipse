/**
 * A volcanic province fuming (#1192, #1201), on the globe: a plume over each vent, its puffs rising,
 * widening and drifting east, pale over the flood lavas and dark with the sills' gas, and a thin
 * haze over the whole globe; how strongly, the crisis clock's moment says (`fumesModel.ts`).
 * The puffs move on with the time that passes between the clock's moments, so they rise while
 * it plays and stand still when it is paused; for a reader who asks for less motion, they stand
 * still. A layer on the globe's host: `globe.addLayer(fumesLayer)`.
 *
 * Three.js glue, covered by the Playwright suite.
 */

import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three';

import type { GeoPoint } from '../../core/geo';
import { geoToVector } from '../../globe/geo';
import { glowTexture } from '../../globe/glowTexture';
import type { LayerFactory } from '../../globe/layerHost';
import { puffAt, ventsAround, type Fuming } from './fumesModel';

/** A province fuming at a moment: its centre then, how far it spreads, and how strongly. */
export interface FumesMoment {
  readonly center: GeoPoint;
  /** Degrees from its centre its vents spread over. */
  readonly spread: number;
  readonly fuming: Fuming;
}

const VENTS = 18;
const PUFFS = 9;
/** Plume cycles a second of play: each puff takes about two seconds to rise. */
const CYCLES_PER_SECOND = 0.5;
const PALE = new Color(0.8, 0.77, 0.72);
const DARK = new Color(0.16, 0.13, 0.11);
/** The lava's glow at a vent, at its brightest, Earth radii across. */
const GLOW_SIZE = 0.014;
const LAVA = new Color(1, 0.42, 0.12);

/** A soft round puff of smoke: a grey radial gradient on a small canvas. */
function puffTexture(): CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (context !== null) {
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,255,255,0.9)');
    gradient.addColorStop(0.5, 'rgba(255,255,255,0.45)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  }
  return new CanvasTexture(canvas);
}

/** A vent's place: where it is, its up and its east, in Earth radii. */
interface VentFrame {
  readonly base: Vector3;
  readonly up: Vector3;
  readonly east: Vector3;
}

function ventFrame(point: GeoPoint): VentFrame {
  const base = new Vector3(...geoToVector(point, 1));
  const up = base.clone().normalize();
  const east = new Vector3(0, 1, 0).cross(up).normalize();
  return { base, up, east };
}

/** The plumes' parts: a puff sprite each, the lava's glow at each vent, and the haze. */
interface Plumes {
  readonly group: Group;
  readonly sprites: readonly Sprite[];
  readonly glows: readonly Sprite[];
  readonly haze: Mesh<SphereGeometry, MeshBasicMaterial>;
  readonly dispose: () => void;
}

function sprites(count: number, material: () => SpriteMaterial, group: Group): Sprite[] {
  return Array.from({ length: count }, () => {
    const sprite = new Sprite(material());
    group.add(sprite);
    return sprite;
  });
}

function makePlumes(): Plumes {
  const texture = puffTexture();
  const glowMap = glowTexture(false);
  const group = new Group();
  group.visible = false;
  const puffs = sprites(
    VENTS * PUFFS,
    () => new SpriteMaterial({ map: texture, transparent: true, depthWrite: false, opacity: 0 }),
    group,
  );
  const glows = sprites(
    VENTS,
    () =>
      new SpriteMaterial({
        map: glowMap,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        color: LAVA,
        opacity: 0,
      }),
    group,
  );
  const haze = new Mesh(
    new SphereGeometry(1.012, 48, 32),
    new MeshBasicMaterial({
      color: new Color(0.62, 0.5, 0.3),
      transparent: true,
      depthWrite: false,
      opacity: 0,
    }),
  );
  group.add(haze);
  return {
    group,
    sprites: puffs,
    glows,
    haze,
    dispose() {
      texture.dispose();
      glowMap.dispose();
      for (const sprite of [...puffs, ...glows]) sprite.material.dispose();
      haze.geometry.dispose();
      haze.material.dispose();
      group.removeFromParent();
    },
  };
}

export const fumesLayer: LayerFactory<FumesMoment | null> = (host) => {
  const lessMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const plumes = makePlumes();
  const { group, sprites: puffs, glows, haze } = plumes;
  host.onEarth.add(group);
  let frames: readonly VentFrame[] = [];
  let centerKey = '';
  let cycle = 0;
  let last: number | null = null;
  const at = new Vector3();
  const colour = new Color();

  return {
    update(moment) {
      host.container.dataset['fumes'] = moment === null ? 'off' : 'on';
      if (moment === null) {
        group.visible = false;
        last = null;
        host.requestRender();
        return;
      }
      const { center, spread, fuming } = moment;
      const key = `${String(center.latitude)},${String(center.longitude)},${String(spread)}`;
      if (key !== centerKey) {
        centerKey = key;
        frames = ventsAround(center, VENTS, spread).map(ventFrame);
      }
      // The puffs rise with the time between moments, a late frame counting a fifth of a second.
      const now = performance.now();
      if (last !== null && !lessMotion.matches)
        cycle += CYCLES_PER_SECOND * Math.min(0.2, (now - last) / 1000);
      last = now;
      const strength = Math.max(fuming.lava, fuming.gas);
      colour.copy(PALE).lerp(DARK, fuming.gas);
      frames.forEach((frame, vent) => {
        const glow = glows[vent];
        if (glow !== undefined) {
          glow.position.copy(frame.base).addScaledVector(frame.up, 0.003);
          glow.scale.setScalar(GLOW_SIZE * (0.6 + 0.4 * fuming.lava));
          glow.material.opacity = 0.8 * fuming.lava;
        }
        for (let index = 0; index < PUFFS; index += 1) {
          const sprite = puffs[vent * PUFFS + index];
          if (sprite === undefined) continue;
          // Each vent a little out of step with the next, so they do not puff together.
          const puff = puffAt(index, PUFFS, cycle + vent * 0.37, strength);
          at.copy(frame.base)
            .addScaledVector(frame.up, puff.height)
            .addScaledVector(frame.east, puff.east);
          sprite.position.copy(at);
          sprite.scale.setScalar(puff.size);
          sprite.material.opacity = puff.opacity;
          sprite.material.color.copy(colour);
        }
      });
      haze.material.opacity = 0.35 * fuming.haze;
      group.visible = strength > 0 || fuming.haze > 0;
      host.requestRender();
    },
    dispose: plumes.dispose,
  };
};
