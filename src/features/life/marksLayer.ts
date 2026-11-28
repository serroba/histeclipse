/**
 * An animal's story on the globe (a prototype): a dot at each site its lineage was found at in
 * the moment's step, larger with more finds, each one a button; and round the globe, clear of
 * it, a picture of each kind (its silhouette, with its name) joined by a line to the site where
 * it was found most. The pictures are an aid to the eye: where each stands says nothing, only
 * its line does. A layer on the globe's host (#379): `globe.addLayer(lifeMarksLayer)`.
 */

import { Vector3 } from 'three';

import type { Silhouette } from '../../data/lifePictures';
import { SURFACE_PRIORITY, type LayerFactory } from '../../globe/layerHost';
import type { Mark } from './story';

/** What to draw; null for nothing. */
export interface LifeMarks {
  /** Changes when the marks or their pictures do. */
  readonly key: string;
  readonly marks: readonly Mark[];
  /** A kind's silhouette by its name, if it has one. */
  silhouette(name: string): Silhouette | null;
  /** A dot, or a kind's picture, was tapped. */
  pick(mark: Mark): void;
  /** The mark whose card is open, to show which it is. */
  readonly picked: Mark | null;
}

const SVG = 'http://www.w3.org/2000/svg';
/** The most pictures round the globe at once. */
const MOST_CALLOUTS = 16;
/** A picture's box, and how far outside the globe's edge its middle stands, pixels. */
const CALLOUT = { width: 76, height: 58, out: 52 } as const;

interface Callout {
  readonly mark: Mark;
  readonly dot: HTMLElement;
  readonly element: HTMLButtonElement;
  readonly line: SVGLineElement;
}

/** Spread angles (radians, sorted) so that neighbours are at least `least` apart. */
export function spread(angles: readonly number[], least: number): number[] {
  const out = [...angles];
  for (let pass = 0; pass < 12; pass++) {
    let moved = false;
    for (let at = 0; at < out.length; at++) {
      const next = (at + 1) % out.length;
      if (out.length < 2 || next === at) continue;
      const a = out[at] ?? 0;
      const b = (out[next] ?? 0) + (next === 0 ? 2 * Math.PI : 0);
      const short = least - (b - a);
      if (short > 1e-6) {
        out[at] = a - short / 2;
        out[next] = (out[next] ?? 0) + short / 2;
        moved = true;
      }
    }
    if (!moved) break;
  }
  return out;
}

export const lifeMarksLayer: LayerFactory<LifeMarks | null> = (host) => {
  const layer = document.createElement('div');
  layer.className = 'empire-labels life-marks';
  const lines = document.createElementNS(SVG, 'svg');
  lines.setAttribute('class', 'life-lines');
  const pictures = document.createElement('div');
  pictures.className = 'life-callouts';
  host.container.append(lines, layer, pictures);
  const pins = host.surfaceLabels(SURFACE_PRIORITY.life, layer);
  let shownKey = 'off';
  let callouts: Callout[] = [];
  const centre = new Vector3();
  const limb = new Vector3();

  /** Where the globe's middle is on screen and how wide it is, pixels in the container. */
  function globeOnScreen(): {
    x: number;
    y: number;
    radius: number;
    width: number;
    height: number;
  } {
    const { clientWidth: width, clientHeight: height } = host.container;
    const { camera } = host;
    const distance = Math.max(1.0001, camera.position.length());
    const toCamera = limb.copy(camera.position).normalize();
    const up = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    // The edge of a unit sphere as the camera sees it: its tangent point, upward.
    const edge = toCamera
      .multiplyScalar(1 / distance)
      .addScaledVector(up, Math.sqrt(1 - 1 / (distance * distance)))
      .project(camera);
    const middle = centre.set(0, 0, 0).project(camera);
    const x = ((middle.x + 1) / 2) * width;
    const y = ((1 - middle.y) / 2) * height;
    const radius = Math.hypot(((edge.x + 1) / 2) * width - x, ((1 - edge.y) / 2) * height - y);
    return { x, y, radius, width, height };
  }

  /** Each frame: stand each picture outside the globe, towards its dot, and draw its line. */
  function place(): void {
    if (callouts.length === 0) return;
    const globe = globeOnScreen();
    const frame = host.container.getBoundingClientRect();
    const seen = callouts.flatMap((callout) => {
      if (callout.dot.hidden || !callout.dot.isConnected) return [];
      const box = callout.dot.getBoundingClientRect();
      if (box.width === 0) return [];
      const x = box.left + box.width / 2 - frame.left;
      const y = box.top + box.height / 2 - frame.top;
      return [{ callout, x, y, angle: Math.atan2(y - globe.y, x - globe.x) }];
    });
    seen.sort((a, b) => a.angle - b.angle);
    const ring = globe.radius + CALLOUT.out;
    const angles = spread(
      seen.map((each) => each.angle),
      (CALLOUT.width + 6) / ring,
    );
    const shown = new Set<Callout>();
    seen.forEach((each, at) => {
      const angle = angles[at] ?? each.angle;
      // Kept on the page where the globe fills it: the picture stays in view, its line shortens.
      const x = Math.min(
        globe.width - CALLOUT.width / 2 - 4,
        Math.max(CALLOUT.width / 2 + 4, globe.x + Math.cos(angle) * ring),
      );
      const y = Math.min(
        globe.height - CALLOUT.height / 2 - 4,
        Math.max(CALLOUT.height / 2 + 4, globe.y + Math.sin(angle) * ring),
      );
      const { element, line } = each.callout;
      element.style.transform = `translate(${String(Math.round(x - CALLOUT.width / 2))}px, ${String(Math.round(y - CALLOUT.height / 2))}px)`;
      element.hidden = false;
      line.setAttribute('x1', each.x.toFixed(1));
      line.setAttribute('y1', each.y.toFixed(1));
      line.setAttribute('x2', x.toFixed(1));
      line.setAttribute('y2', y.toFixed(1));
      line.style.display = '';
      shown.add(each.callout);
    });
    for (const callout of callouts) {
      if (shown.has(callout)) continue;
      callout.element.hidden = true;
      callout.line.style.display = 'none';
    }
  }
  host.afterRender(place);

  return {
    update(shown) {
      const key = shown === null ? 'off' : shown.key;
      if (key === shownKey) return;
      shownKey = key;
      const dots = new Map<Mark, HTMLElement>();
      pins.show(
        shown?.marks.map((mark) => {
          const element = document.createElement('button');
          element.type = 'button';
          const picked =
            shown.picked !== null &&
            shown.picked.node === mark.node &&
            shown.picked.site === mark.site;
          element.className = `empire-label life-mark is-${mark.kind}${picked ? ' is-picked' : ''}`;
          element.title = mark.title;
          element.setAttribute('aria-label', mark.title);
          const size = Math.round(Math.min(26, 9 + 3.2 * Math.sqrt(mark.finds)));
          const dot = document.createElement('i');
          dot.className = 'life-dot';
          dot.style.width = `${String(size)}px`;
          dot.style.height = `${String(size)}px`;
          element.append(dot);
          element.addEventListener('click', (event) => {
            event.stopPropagation();
            shown.pick(mark);
          });
          dots.set(mark, element);
          return {
            element,
            point: { latitude: mark.latitude, longitude: mark.longitude },
            anchor: size / 2,
          };
        }) ?? null,
      );
      host.container.dataset['lifeMarks'] = shown === null ? 'off' : String(shown.marks.length);

      // A picture for each kind, at the site it was found at most: the marks come most telling
      // first, so the first of them get the room.
      lines.replaceChildren();
      pictures.replaceChildren();
      callouts = [];
      for (const mark of shown?.marks ?? []) {
        if (!mark.lead || callouts.length >= MOST_CALLOUTS) continue;
        const dot = dots.get(mark);
        if (dot === undefined) continue;
        const silhouette = shown?.silhouette(mark.node.name) ?? null;
        const element = document.createElement('button');
        element.type = 'button';
        element.className = `life-callout is-${mark.kind}`;
        element.hidden = true;
        element.title = mark.title;
        if (silhouette === null) element.classList.add('is-plain');
        if (silhouette !== null) {
          const image = document.createElement('img');
          image.className = 'life-silhouette';
          image.src = silhouette.src;
          image.alt = '';
          image.width = 34;
          image.height = 34;
          image.referrerPolicy = 'no-referrer';
          element.append(image);
        }
        const name = document.createElement('span');
        name.className = 'life-callout-name';
        name.textContent = mark.node.name;
        element.append(name);
        element.addEventListener('click', (event) => {
          event.stopPropagation();
          shown?.pick(mark);
        });
        const line = document.createElementNS(SVG, 'line');
        line.setAttribute('class', `life-line-to is-${mark.kind}`);
        line.style.display = 'none';
        lines.append(line);
        pictures.append(element);
        callouts.push({ mark, dot, element, line });
      }
      host.requestRender();
    },
  };
};
