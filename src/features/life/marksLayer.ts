/**
 * An animal's story on the globe: a dot at each site its lineage was found at in the moment's
 * step, larger with more finds, each one a button; and round the globe, clear of it, a picture
 * of each kind (its silhouette, with its name) joined by a line to the site where it was found
 * most. The pictures are an aid to the eye: where each stands says nothing, only its line does.
 * A layer on the globe's host (#379): `globe.addLayer(lifeMarksLayer)`.
 */

import { SURFACE_PRIORITY, type LayerFactory, type SurfacePin } from '../../globe/layerHost';
import { CALLOUT, globeOnScreen, ringPlaces, type Point } from './callouts';
import type { Silhouette } from './lifePictures';
import type { Mark } from './marks';

/** What to draw; null for nothing. */
export interface LifeMarks {
  /** Changes when the marks or their pictures do. */
  readonly key: string;
  readonly marks: readonly Mark[];
  /** A kind's silhouette by its name, if it has one. */
  readonly silhouette: (name: string) => Silhouette | null;
  /** A dot, or a kind's picture, was tapped. */
  readonly pick: (mark: Mark) => void;
  /** The mark whose card is open, to show which it is. */
  readonly picked: Mark | null;
}

const SVG = 'http://www.w3.org/2000/svg';
/** The most pictures round the globe at once. */
const MOST_CALLOUTS = 16;

interface Callout {
  readonly dot: HTMLElement;
  readonly element: HTMLButtonElement;
  readonly line: SVGElement;
}

/** A site's dot: a button, larger with more finds. */
function dotOf(mark: Mark, picked: boolean, pick: () => void): SurfacePin {
  const element = document.createElement('button');
  element.type = 'button';
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
    pick();
  });
  return {
    element,
    point: { latitude: mark.latitude, longitude: mark.longitude },
    anchor: size / 2,
  };
}

/** A kind's picture: its silhouette where it has one, and its name; hidden until placed. */
function pictureOf(mark: Mark, silhouette: Silhouette | null, pick: () => void): HTMLButtonElement {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = `life-callout is-${mark.kind}${silhouette === null ? ' is-plain' : ''}`;
  element.hidden = true;
  element.title = mark.title;
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
    pick();
  });
  return element;
}

/** Where a dot's middle is in the globe's frame, if it is shown. */
function middleOf(dot: HTMLElement, frame: DOMRect): Point | null {
  if (dot.hidden !== false || !dot.isConnected) return null;
  const box = dot.getBoundingClientRect();
  if (box.width === 0) return null;
  return { x: box.left + box.width / 2 - frame.left, y: box.top + box.height / 2 - frame.top };
}

/** Stand a picture at a place and draw its line from its dot; or with no dot shown, hide both. */
function stand(callout: Callout, dot: Point | null, place: Point | undefined): void {
  const shown = dot !== null && place !== undefined;
  callout.element.hidden = !shown;
  callout.line.style.display = shown ? '' : 'none';
  if (!shown) return;
  callout.element.style.transform = `translate(${String(Math.round(place.x - CALLOUT.width / 2))}px, ${String(Math.round(place.y - CALLOUT.height / 2))}px)`;
  callout.line.setAttribute('x1', dot.x.toFixed(1));
  callout.line.setAttribute('y1', dot.y.toFixed(1));
  callout.line.setAttribute('x2', place.x.toFixed(1));
  callout.line.setAttribute('y2', place.y.toFixed(1));
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

  // After each frame: each picture outside the globe, towards its dot, and its line.
  host.afterRender(() => {
    if (callouts.length === 0) return;
    const frame = host.container.getBoundingClientRect();
    const dots = callouts.map((callout) => middleOf(callout.dot, frame));
    const seen = dots.flatMap((dot) => (dot === null ? [] : [dot]));
    const globe = globeOnScreen(
      host.camera,
      host.container.clientWidth,
      host.container.clientHeight,
    );
    const places = ringPlaces(globe, seen);
    let next = 0;
    callouts.forEach((callout, at) => {
      const dot = dots[at] ?? null;
      stand(callout, dot, dot === null ? undefined : places[next++]);
    });
  });

  /** A picture for each kind, at the site it was found at most: the first marks get the room. */
  function picture(shown: LifeMarks, dots: ReadonlyMap<Mark, HTMLElement>): void {
    for (const mark of shown.marks) {
      const dot = dots.get(mark);
      if (!mark.lead || dot === undefined || callouts.length >= MOST_CALLOUTS) continue;
      const element = pictureOf(mark, shown.silhouette(mark.node.name), () => {
        shown.pick(mark);
      });
      const line = document.createElementNS(SVG, 'line');
      line.setAttribute('class', `life-line-to is-${mark.kind}`);
      line.style.display = 'none';
      lines.append(line);
      pictures.append(element);
      callouts.push({ dot, element, line });
    }
  }

  return {
    update(shown) {
      const key = shown === null ? 'off' : shown.key;
      if (key === shownKey) return;
      shownKey = key;
      const dots = new Map<Mark, HTMLElement>();
      pins.show(
        shown?.marks.map((mark) => {
          const picked = shown.picked?.node === mark.node && shown.picked.site === mark.site;
          const pin = dotOf(mark, picked, () => {
            shown.pick(mark);
          });
          dots.set(mark, pin.element);
          return pin;
        }) ?? null,
      );
      host.container.dataset['lifeMarks'] = shown === null ? 'off' : String(shown.marks.length);
      lines.replaceChildren();
      pictures.replaceChildren();
      callouts = [];
      if (shown !== null) picture(shown, dots);
      host.requestRender();
    },
  };
};
