/**
 * Marks on and around Earth (#603): the place picked, a small pin standing on the ground; and in
 * deep time Earth's spin axis, its ends marked as the poles of the time shown.
 */

import {
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three';
import type { GeoPoint } from '../state/viewState';
import { geoToVector } from './geo';
import { labelTexture } from './labelTexture';

/** How far out the place pin floats, in Earth radii, so it shows above the ground. */
const PIN_HEIGHT = 1.004;

/** The place picked: a small pin standing on the ground, hidden until there is one. */
export class PlacePin {
  readonly mesh = new Mesh(
    new SphereGeometry(0.012, 16, 8),
    new MeshBasicMaterial({ color: new Color(1, 0.72, 0.3) }),
  );
  readonly #dataset: DOMStringMap;

  /** `dataset` is where the place is written, for the tests. */
  constructor(dataset: DOMStringMap) {
    this.#dataset = dataset;
    this.mesh.visible = false;
  }

  /** Stand on `place`, or take the pin away. */
  set(place: GeoPoint | null): void {
    this.mesh.visible = place !== null;
    if (place !== null) this.mesh.position.set(...geoToVector(place, PIN_HEIGHT));
    this.#dataset['location'] =
      place === null ? '' : `${place.latitude.toFixed(2)},${place.longitude.toFixed(2)}`;
  }

  /** Where the place is in the scene, on the ground under the pin; null with no place. */
  place(): Vector3 | null {
    return this.mesh.visible
      ? this.mesh.getWorldPosition(new Vector3()).divideScalar(PIN_HEIGHT)
      : null;
  }
}

/**
 * Earth's spin axis, hidden until deep time: the maps put the poles of their time at the top and
 * bottom, so the axis is the globe's own, and its poles are fixed by the reconstruction while
 * the continents move beneath them.
 */
export function createSpinAxis(): Group {
  const spinAxis = new Group();
  spinAxis.add(
    new Mesh(
      new CylinderGeometry(0.004, 0.004, 2.6, 8),
      new MeshBasicMaterial({ color: new Color(0.85, 0.9, 1), transparent: true, opacity: 0.7 }),
    ),
  );
  for (const [text, y] of [
    ['North pole (spin axis)', 1.42],
    ['South pole (spin axis)', -1.42],
  ] as const) {
    const label = new Sprite(
      new SpriteMaterial({ map: labelTexture(text, 768), transparent: true, depthWrite: false }),
    );
    label.scale.set(1.35, 1.35 / 6, 1);
    label.position.set(0, y, 0);
    spinAxis.add(label);
  }
  spinAxis.visible = false;
  return spinAxis;
}
