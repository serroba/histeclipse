/**
 * The cold and the suffocating seas on the globe (#1202, #1208): a white ice sheet at its
 * centre, reaching as far as the moment says, and patches of oxygen-poor water spreading round
 * another place, as strongly as it says (`seasModel.ts`), over the sea only, by the Earth
 * shader's part (`anoxicSeasPart.ts`). An illustration. A layer on the globe's host:
 * `globe.addLayer(seasLayer)`.
 *
 * Three.js glue, covered by the Playwright suite.
 */

import {
  CanvasTexture,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three';

import type { GeoPoint } from '../../core/geo';
import { geoToVector } from '../../globe/geo';
import type { LayerFactory } from '../../globe/layerHost';
import { ANOXIA_PATCHES, ANOXIC_SEAS_PART } from './anoxicSeasPart';
import { ventsAround } from './fumesModel';
import type { Seas } from './seasModel';

/** The seas at a moment: where the ice is centred, where the anoxia spreads, and how much. */
export interface SeasMoment {
  readonly ice: GeoPoint | null;
  readonly anoxia: GeoPoint;
  /** Degrees from `anoxia` its patches spread over. */
  readonly spread: number;
  readonly seas: Seas;
}

const UP = new Vector3(0, 1, 0);
const ICE = new Color(0.94, 0.97, 1);

/** A cap `degrees` across from its pole, its pole on +Y, made once a degree. */
function capGeometry(cache: Map<number, SphereGeometry>, degrees: number): SphereGeometry {
  const whole = Math.max(1, Math.round(degrees));
  const made =
    cache.get(whole) ??
    new SphereGeometry(1.004, 64, 12, 0, Math.PI * 2, 0, (whole * Math.PI) / 180);
  cache.set(whole, made);
  return made;
}

/**
 * How opaque a cap is from its pole to its edge: whole over its middle, fading out to its rim, so
 * it has no hard edge. Along the cap's v, 1 at the pole and 0 at the rim.
 */
function softEdge(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  if (context !== null) {
    const gradient = context.createLinearGradient(0, 0, 0, 64);
    gradient.addColorStop(0, '#fff');
    gradient.addColorStop(0.55, '#fff');
    gradient.addColorStop(1, '#000');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 1, 64);
  }
  return new CanvasTexture(canvas);
}

/** A cap mesh, softly edged. */
function cap(
  colour: Color,
  edge: CanvasTexture,
  cache: Map<number, SphereGeometry>,
): Mesh<SphereGeometry, MeshBasicMaterial> {
  return new Mesh(
    capGeometry(cache, 1),
    new MeshBasicMaterial({
      color: colour,
      alphaMap: edge,
      transparent: true,
      depthWrite: false,
      opacity: 0,
    }),
  );
}

function point(mesh: Mesh, place: GeoPoint): void {
  const to = new Vector3(...geoToVector(place, 1)).normalize();
  mesh.quaternion.copy(new Quaternion().setFromUnitVectors(UP, to));
}

export const seasLayer: LayerFactory<SeasMoment | null> = (host) => {
  const cache = new Map<number, SphereGeometry>();
  const edge = softEdge();
  const group = new Group();
  group.visible = false;
  const ice = cap(ICE, edge, cache);
  group.add(ice);
  host.onEarth.add(group);
  const anoxia = host.earthPart(ANOXIC_SEAS_PART);
  let placed = '';

  return {
    update(moment) {
      host.container.dataset['seas'] = moment === null ? 'off' : 'on';
      group.visible = moment !== null;
      if (moment === null) anoxia.anoxiaStrength.value = 0;
      if (moment !== null) {
        const key = JSON.stringify([moment.ice, moment.anoxia, moment.spread]);
        if (key !== placed) {
          placed = key;
          if (moment.ice !== null) point(ice, moment.ice);
          ventsAround(moment.anoxia, ANOXIA_PATCHES, moment.spread).forEach((place, index) => {
            // Each patch a little wider than the last, so they do not look stamped.
            const reach = ((5 + (index % 3) * 2) * Math.PI) / 180;
            const centre = new Vector3(...geoToVector(place, 1)).normalize();
            anoxia.anoxiaPatches.value[index]?.set(centre.x, centre.y, centre.z, reach);
          });
        }
        const { seas } = moment;
        ice.visible = moment.ice !== null && seas.ice > 0;
        ice.geometry = capGeometry(cache, seas.ice);
        ice.material.opacity = 0.85;
        anoxia.anoxiaStrength.value = seas.anoxia;
      }
      host.requestRender();
    },
    dispose() {
      for (const geometry of cache.values()) geometry.dispose();
      edge.dispose();
      ice.material.dispose();
      group.removeFromParent();
    },
  };
};
