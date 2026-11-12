/**
 * The names of the moons of the planet in view (#335), each beside its moon and a tap to fly to
 * it: those in front of the planet or beside it, on screen, clear of each other. A layer on the
 * globe's host (#379): `globe.addLayer(moonNameLayer)`, shown once the moons' orbits are in.
 */

import { Vector3 } from 'three';

import { MOONS, type MoonName } from '../../astro/moonOrbits';
import type { LayerFactory } from '../../globe/layerHost';
import { MOON_NAMES, moonsInView } from '../../globe/moonLook';
import { apparentRadiusPixels } from '../../globe/spaceFrame';
import './moonNameLayer.css';

interface Label {
  readonly name: MoonName;
  readonly element: HTMLButtonElement;
  width: number;
  height: number;
}

/** Whether the moons are placed (their orbits loaded): only then are they named. */
export const moonNameLayer: LayerFactory<boolean> = (host) => {
  const layer = document.createElement('div');
  layer.className = 'empire-labels moon-names';
  layer.dataset['testid'] = 'moon-names';
  layer.hidden = true;
  host.container.append(layer);
  const labels: Label[] = Object.values(MOONS)
    .flat()
    .map((name) => {
      const element = document.createElement('button');
      element.type = 'button';
      element.className = 'moon-name';
      element.textContent = MOON_NAMES[name];
      element.hidden = true;
      element.addEventListener('click', () => {
        host.requestBody(name);
      });
      layer.append(element);
      return { name, element, width: 0, height: 0 };
    });

  const projected = new Vector3();
  const moonWorld = new Vector3();
  host.afterRender(() => {
    if (layer.hidden === true) return;
    const { camera, container } = host;
    const focus = host.focus();
    const planet = moonsInView(focus);
    const viewWidth = container.clientWidth;
    const viewHeight = container.clientHeight;
    const frame = planet === null ? null : host.bodyFrame(planet);
    // The planet's disc on screen, to hide the moons behind it.
    let disc: { x: number; y: number; r: number; distance: number } | null = null;
    if (frame !== null) {
      projected.copy(frame.position).project(camera);
      const distance = camera.position.distanceTo(frame.position);
      disc = {
        x: ((projected.x + 1) / 2) * viewWidth,
        y: ((1 - projected.y) / 2) * viewHeight,
        r: apparentRadiusPixels({
          radius: frame.radius,
          distance,
          verticalFovDegrees: camera.fov,
          viewportHeight: viewHeight,
        }),
        distance,
      };
    }
    const planetShown = frame?.shown === true;
    const placed: { x: number; y: number; w: number; h: number }[] = [];
    let count = 0;
    for (const label of labels) {
      const { name, element } = label;
      // Not the moon in view itself: it fills the screen.
      const mine =
        planet !== null && name !== focus && (MOONS[planet] as readonly string[]).includes(name);
      let visible = mine && disc !== null && planetShown;
      let x = 0;
      let y = 0;
      if (visible && disc !== null) {
        host.moonPosition(name, moonWorld);
        const distance = camera.position.distanceTo(moonWorld);
        projected.copy(moonWorld).project(camera);
        x = ((projected.x + 1) / 2) * viewWidth;
        y = ((1 - projected.y) / 2) * viewHeight;
        const behind = distance > disc.distance && Math.hypot(x - disc.x, y - disc.y) < disc.r;
        const { width, height } = label;
        // The name starts just right of the moon.
        const box = { x, y: y - height / 2, w: width, h: height };
        visible =
          projected.z < 1 &&
          !behind &&
          box.x >= 0 &&
          box.x + width <= viewWidth &&
          box.y >= 0 &&
          box.y + height <= viewHeight &&
          placed.every(
            (other) =>
              box.x > other.x + other.w ||
              other.x > box.x + box.w ||
              box.y > other.y + other.h ||
              other.y > box.y + box.h,
          );
        if (visible) placed.push(box);
      }
      element.hidden = !visible;
      if (!visible) continue;
      count += 1;
      element.style.transform = `translate(${String(x)}px, ${String(y)}px) translate(0, -50%)`;
    }
    layer.dataset['planet'] = planet ?? '';
    layer.dataset['shown'] = String(count);
  });

  return {
    update(placedMoons) {
      layer.hidden = !placedMoons;
      if (placedMoons && labels.every(({ width }) => width === 0)) {
        // Measured once, unseen: read every size, then hide them all, one layout for the lot.
        for (const { element } of labels) {
          element.style.visibility = 'hidden';
          element.hidden = false;
        }
        for (const label of labels) {
          label.width = label.element.offsetWidth;
          label.height = label.element.offsetHeight;
        }
        for (const { element } of labels) {
          element.hidden = true;
          element.style.visibility = '';
        }
      }
      host.requestRender();
    },
  };
};
