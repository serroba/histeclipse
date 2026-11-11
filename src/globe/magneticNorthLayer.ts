/**
 * Where a compass pointed in deep time: magnetic north at the north pole, or the south when the
 * field was reversed; when it reversed too often to say, a note at the north pole instead. Labels
 * on the spin axis, shown with it. A layer on the globe's host (#379).
 */

import { Sprite, SpriteMaterial } from 'three';

import type { MagneticNorth } from '../deepTime/earthState';
import type { LayerFactory } from './layerHost';
import { labelTexture } from './labelTexture';

const LABELS = {
  north: ['Magnetic north', 1.62],
  south: ['Magnetic north', -1.62],
  either: ['Magnetic north: either pole, reversing often', 1.62],
} as const;

/** The pole a compass pointed to; null when not known (or not in deep time). */
export const magneticNorthLayer: LayerFactory<MagneticNorth | null> = (host) => {
  const labels = new Map(
    Object.entries(LABELS).map(([where, [text, y]]) => {
      const label = new Sprite(
        new SpriteMaterial({
          map: labelTexture(text, 1280, 'rgba(255, 150, 120, 0.95)'),
          transparent: true,
          depthWrite: false,
        }),
      );
      label.scale.set(2.25, 2.25 / 10, 1);
      label.position.set(0, y, 0);
      label.visible = false;
      host.spinAxis.add(label);
      return [where, label] as const;
    }),
  );
  return {
    update(where) {
      for (const [key, label] of labels) label.visible = key === where;
      host.container.dataset['magneticNorth'] = where ?? 'unknown';
      host.requestRender();
    },
  };
};
