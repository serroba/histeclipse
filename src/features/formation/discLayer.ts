/**
 * The disc round the growing Earth on the globe (#1219): the gas's haze in the disc's plane,
 * fading by about 4 million years, and the swarm of dust, planetesimals and embryos streaming
 * past, thinning as Earth sweeps it up. Where each piece is, `discModel.ts` says; this draws it,
 * in the plane of Earth's equator.
 *
 * The swarm streams with the time between the clock's moments, so it moves while the clock plays
 * and stands still when paused; for a reader who asks for less motion, it stands still. A layer on
 * the globe's host: `globe.addLayer(discLayer)`, given the moment and the growth model, or null.
 *
 * Three.js glue, covered by the Playwright suite.
 */

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  NormalBlending,
  Points,
  PointsMaterial,
} from 'three';

import type { GrowthModel } from '../../deepTime/growth';
import { glowTexture } from '../../globe/glowTexture';
import type { LayerFactory } from '../../globe/layerHost';
import { gasLeft, moteAt, motes, REACH, type Mote } from './discModel';

/** The disc at a moment: millions of years since the first solids, and how Earth grows. */
export interface DiscMoment {
  readonly myr: number;
  readonly growth: GrowthModel;
}

/** Pieces drawn: fewer on a phone. */
const MOTES = 700;
const PHONE_MOTES = 280;
/** The haze at its thickest, while the gas lasts. */
const HAZE = 0.25;
const KINDS = ['dust', 'planetesimal', 'embryo'] as const;

/** The gas's haze: brown, thickest at the middle, fading to nothing at the reach. */
function hazeTexture(): CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (context !== null) {
    const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(150,120,90,0.9)');
    gradient.addColorStop(0.6, 'rgba(120,95,70,0.45)');
    gradient.addColorStop(1, 'rgba(100,80,60,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  }
  return new CanvasTexture(canvas);
}

/** One kind's pieces as points: where they are and their colours, set each moment. */
interface Swarm {
  readonly motes: readonly Mote[];
  readonly points: Points<BufferGeometry, PointsMaterial>;
}

function swarm(of: readonly Mote[], map: CanvasTexture, glowing: boolean, size: number): Swarm {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(of.length * 3), 3));
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(of.length * 3), 3));
  const points = new Points(
    geometry,
    new PointsMaterial({
      size,
      map,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: glowing ? AdditiveBlending : NormalBlending,
    }),
  );
  points.frustumCulled = false;
  return { motes: of, points };
}

/** Place each of `swarm`'s pieces at the moment; those swept up out of sight. */
function place(each: Swarm, moment: DiscMoment, played: number): number {
  const positions = each.points.geometry.getAttribute('position') as BufferAttribute;
  const colours = each.points.geometry.getAttribute('color') as BufferAttribute;
  let shown = 0;
  each.motes.forEach((mote, index) => {
    const at = moteAt(mote, moment.growth, moment.myr, played);
    if (at === null) {
      positions.setXYZ(index, 0, 0, 0);
      colours.setXYZ(index, 0, 0, 0);
      return;
    }
    shown += 1;
    positions.setXYZ(index, ...at.place);
    colours.setXYZ(index, ...at.colour);
  });
  positions.needsUpdate = true;
  colours.needsUpdate = true;
  each.points.visible = shown > 0;
  return shown;
}

export const discLayer: LayerFactory<DiscMoment | null> = (host) => {
  const lessMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const phone = window.matchMedia('(pointer: coarse)').matches;
  const all = motes(phone ? PHONE_MOTES : MOTES);
  const glow = glowTexture(false);
  const hazeMap = hazeTexture();
  const group = new Group();
  group.visible = false;
  const haze = new Mesh(
    new CircleGeometry(REACH, 64),
    new MeshBasicMaterial({ map: hazeMap, transparent: true, depthWrite: false, opacity: 0 }),
  );
  // Flat in the disc's plane, the equator's.
  haze.rotation.x = -Math.PI / 2;
  const swarms = KINDS.map((kind) =>
    swarm(
      all.filter((mote) => mote.kind === kind),
      glow,
      kind === 'embryo',
      kind === 'dust' ? 0.12 : kind === 'planetesimal' ? 0.28 : 0.6,
    ),
  );
  group.add(haze, ...swarms.map((each) => each.points));
  host.spinAxis.add(group);
  let played = 0;
  let last: number | null = null;

  return {
    update(moment) {
      if (moment === null) {
        host.container.dataset['formationDisc'] = 'off';
        group.visible = false;
        last = null;
        host.requestRender();
        return;
      }
      group.visible = true;
      // The swarm streams with the time between moments, a late frame counting a fifth of a second.
      const now = performance.now();
      if (last !== null && !lessMotion.matches) played += Math.min(0.2, (now - last) / 1000);
      last = now;
      const gas = gasLeft(moment.myr);
      haze.material.opacity = HAZE * gas;
      haze.visible = gas > 0;
      const shown = swarms.reduce((sum, each) => sum + place(each, moment, played), 0);
      host.container.dataset['formationDisc'] = gas > 0 ? 'gas' : shown > 0 ? 'swarm' : 'clear';
      host.requestRender();
    },
    dispose() {
      glow.dispose();
      hazeMap.dispose();
      haze.geometry.dispose();
      haze.material.dispose();
      for (const each of swarms) {
        each.points.geometry.dispose();
        each.points.material.dispose();
      }
      group.removeFromParent();
    },
  };
};
