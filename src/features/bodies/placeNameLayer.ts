/**
 * The IAU's names on the rocky body in view (#334), turning with it: largest first, only where
 * the Sun is up, only once the body is more than a dot, kept half a line apart. A layer on the
 * globe's host (#379): `globe.addLayer(placeNameLayer)`.
 */

import { Vector3 } from 'three';

import { largeEnough, type NamedBody, type PlaceName } from '../../data/planetNames';
import { elementAt } from '../../util/arrays';
import { geoToVector } from '../../globe/geo';
import type { LayerFactory } from '../../globe/layerHost';
import { planetRadius, polarRatio } from '../../globe/planetLook';
import {
  apparentRadiusPixels,
  EARTH_RADIUS_KM,
  MOON_RADIUS_EARTH_RADII,
} from '../../globe/spaceFrame';
import './placeNameLayer.css';

/** The body's names to show, or null for none. */
export interface PlaceNamesShown {
  readonly body: NamedBody;
  readonly names: readonly PlaceName[];
}

interface Label {
  readonly element: HTMLElement;
  /** On the body, in its own axes, in scene units. */
  readonly position: Vector3;
  readonly km: number;
  readonly width: number;
  readonly height: number;
}

export const placeNameLayer: LayerFactory<PlaceNamesShown | null> = (host) => {
  const layer = document.createElement('div');
  layer.className = 'empire-labels place-names';
  layer.dataset['testid'] = 'place-names';
  host.container.append(layer);
  let shown: { readonly body: NamedBody; readonly labels: readonly Label[] } | null = null;

  const toEye = new Vector3();
  const outward = new Vector3();
  const toLight = new Vector3();
  const projected = new Vector3();
  host.afterRender(() => {
    if (shown === null) return;
    const { body, labels } = shown;
    const { camera, container } = host;
    const { position, rotation, radius, shown: drawn } = host.bodyFrame(body);
    const viewWidth = container.clientWidth;
    const viewHeight = container.clientHeight;
    const radiusPixels = apparentRadiusPixels({
      radius,
      distance: camera.position.distanceTo(position),
      verticalFovDegrees: camera.fov,
      viewportHeight: viewHeight,
    });
    // Only on the body in view, and only once it is more than a dot.
    const near = drawn && host.focus() === body && radiusPixels > 60;
    layer.dataset['body'] = body;
    toLight.copy(host.sunPosition()).sub(position).normalize();
    const placed: { x: number; y: number; w: number; h: number }[] = [];
    let count = 0;
    // Largest first: a smaller feature's name gives way where it would come near another.
    for (const label of labels) {
      const { element, width, height } = label;
      outward.copy(label.position).applyQuaternion(rotation);
      projected.copy(outward).add(position);
      toEye.copy(camera.position).sub(projected).normalize();
      const facing = outward.normalize().dot(toEye);
      // Named only where the Sun is up: on the night side there is nothing to see.
      const lit = outward.dot(toLight) > 0;
      projected.project(camera);
      const x = ((projected.x + 1) / 2) * viewWidth;
      const y = ((1 - projected.y) / 2) * viewHeight;
      // Kept half a line apart, so the names read as a map's, not a crowd.
      const box = {
        x: x - width / 2 - height / 4,
        y: y - (3 * height) / 4,
        w: width + height / 2,
        h: (3 * height) / 2,
      };
      const visible =
        near &&
        lit &&
        facing > 0.3 &&
        // Whole names only: none cut by the edge of the view.
        x - width / 2 >= 0 &&
        x + width / 2 <= viewWidth &&
        y - height / 2 >= 0 &&
        y + height / 2 <= viewHeight &&
        projected.z < 1 &&
        largeEnough(label.km, radius * EARTH_RADIUS_KM, radiusPixels) &&
        placed.every(
          (other) =>
            box.x > other.x + other.w ||
            other.x > box.x + box.w ||
            box.y > other.y + other.h ||
            other.y > box.y + box.h,
        );
      element.hidden = !visible;
      if (!visible) continue;
      placed.push(box);
      count += 1;
      element.style.transform = `translate(${String(x)}px, ${String(y)}px) translate(-50%, -50%)`;
    }
    layer.dataset['shown'] = String(count);
  });

  return {
    update(input) {
      if (input === null) {
        if (shown === null) return;
        shown = null;
        layer.replaceChildren();
        delete layer.dataset['body'];
        delete layer.dataset['shown'];
        return;
      }
      if (shown?.body === input.body) return;
      const { body, names } = input;
      layer.replaceChildren();
      const radius = body === 'moon' ? MOON_RADIUS_EARTH_RADII : planetRadius(body);
      const squash = body === 'moon' ? 1 : polarRatio(body);
      const elements = names.map(({ name }) => {
        const element = document.createElement('span');
        element.className = 'empire-label place-name';
        element.textContent = name;
        element.style.visibility = 'hidden';
        layer.append(element);
        return element;
      });
      // Every size read, then every label hidden: one layout for the lot.
      const sizes = elements.map((element) => ({
        width: element.offsetWidth,
        height: element.offsetHeight,
      }));
      for (const element of elements) {
        element.hidden = true;
        element.style.visibility = '';
      }
      shown = {
        body,
        labels: elements.map((element, index) => {
          const { point, km } = elementAt(names, index);
          const [x, y, z] = geoToVector(point, radius);
          const { width, height } = elementAt(sizes, index);
          return { element, position: new Vector3(x, y * squash, z), km, width, height };
        }),
      };
      host.requestRender();
    },
  };
};
