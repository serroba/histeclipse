/**
 * How far out the view is, on a rail at the side, for whichever body is in focus: the body at
 * the top, out to the planets at the bottom, with the stops named so the reader sees that
 * zooming out reaches the Solar System. A stop flies there; the slider and the + and −
 * buttons move along the rail. Away from Earth, a stop at the top takes the view back to it.
 * Below, a small icon draws the planets' orbits, offered wherever they can be seen.
 *
 * DOM glue, covered by the Playwright suite; the scale, its stops and its words are unit-tested.
 */

import { BODY_RADIUS } from '../globe/bodyRadius';
import { EARTH_RADIUS_KM } from '../globe/spaceFrame';
import { CAMERA_DISTANCE_RANGE, type Body } from '../state/viewState';
import { element } from './dom';

/** A rail for one body: its distances in its own radii, as near and as far as the camera goes. */
export interface RailScale {
  readonly body: Body;
  /** The body's radius in kilometres. */
  readonly radiusKm: number;
  readonly near: number;
  readonly far: number;
}

/** The rail for `body`, over the distances the camera allows round it (as the scene sets them). */
export function railScale(body: Body): RailScale {
  const radius = BODY_RADIUS[body];
  return {
    body,
    radiusKm: radius * EARTH_RADIUS_KM,
    near: CAMERA_DISTANCE_RANGE.min,
    // The scene caps the distance at the same number of Earth radii, whatever the body.
    far: Math.min(CAMERA_DISTANCE_RANGE.max, CAMERA_DISTANCE_RANGE.max / radius),
  };
}

const NAMES: Readonly<Record<Body, string>> = {
  earth: 'Earth',
  moon: 'Moon',
  sun: 'Sun',
  mercury: 'Mercury',
  venus: 'Venus',
  mars: 'Mars',
  jupiter: 'Jupiter',
  saturn: 'Saturn',
};

/** "from Earth", "from the Sun": how the readout says where it measures from. */
function fromWords(body: Body): string {
  return body === 'sun' || body === 'moon' ? `from the ${NAMES[body]}` : `from ${NAMES[body]}`;
}

export interface ZoomStop {
  /** Distance from the body's centre, in its radii. */
  readonly distance: number;
  readonly label: string;
  readonly title: string;
}

/**
 * Earth and the Moon's orbit together; the inner planets round the Sun; out to Saturn: round
 * numbers of Earth radii (as Earth's own rail has them), in kilometres for any body's.
 */
const MOON_ORBIT_KM = 150 * EARTH_RADIUS_KM;
const PLANETS_KM = 60_000 * EARTH_RADIUS_KM;
const SATURN_KM = 300_000 * EARTH_RADIUS_KM;

/** The stops for a rail, nearest first, each within the camera's reach. */
export function stopsFor(scale: RailScale): ZoomStop[] {
  const radii = (km: number): number => km / scale.radiusKm;
  const name = NAMES[scale.body];
  const all: ZoomStop[] = [
    { distance: 3, label: name, title: `The whole ${name}` },
    ...(scale.body === 'earth'
      ? [{ distance: radii(MOON_ORBIT_KM), label: 'Moon', title: 'Earth and the Moon’s orbit' }]
      : scale.body === 'moon'
        ? [{ distance: radii(MOON_ORBIT_KM), label: 'With Earth', title: 'The Moon and Earth' }]
        : []),
    {
      distance: radii(PLANETS_KM),
      label: 'Planets',
      title: 'The inner planets, around the Sun',
    },
    { distance: radii(SATURN_KM), label: 'Saturn', title: 'Out to Saturn' },
  ];
  // Within reach (a hair over, for rounding), and not crowding the body's own stop.
  return all.filter(
    (stop, index) => stop.distance <= scale.far * 1.01 && (index === 0 || stop.distance > 30),
  );
}

/** Where `distance` lies on the rail, from 0 (nearest) to 1 (farthest), by its logarithm. */
export function railPosition(distance: number, scale: RailScale): number {
  const near = Math.log(scale.near);
  const far = Math.log(scale.far);
  return Math.min(1, Math.max(0, (Math.log(distance) - near) / (far - near)));
}

/** The distance at `position` on the rail. */
export function distanceAt(position: number, scale: RailScale): number {
  const near = Math.log(scale.near);
  const far = Math.log(scale.far);
  return Math.exp(near + Math.min(1, Math.max(0, position)) * (far - near));
}

const AU_KM = 149_597_870.7;

/** How far from the body's centre, in words: kilometres nearby, astronomical units far out. */
export function distanceText(distance: number, scale: RailScale): string {
  const km = distance * scale.radiusKm;
  const from = fromWords(scale.body);
  if (km < 10_000_000) {
    const rounded = Number(km.toPrecision(2));
    return `${rounded.toLocaleString('en')} km ${from}`;
  }
  const au = km / AU_KM;
  return `${au < 10 ? au.toFixed(1) : String(Math.round(au))} AU ${from}`;
}

/** How near a stop, as a share of the rail, the slider settles on it. */
const SNAP = 0.06;

/** The distance at `position`, settled on a stop when it is that near one. */
export function snappedDistance(position: number, scale: RailScale): number {
  const near = stopsFor(scale).find(
    (stop) => Math.abs(railPosition(stop.distance, scale) - position) < SNAP,
  );
  return near?.distance ?? distanceAt(position, scale);
}

/** One step of + or −: a sixth of the rail. */
const STEP = 1 / 6;

export interface RailView {
  /** The body in focus, whose radii the distance is in. */
  readonly body: Body;
  readonly distance: number;
}

export interface ZoomRail {
  readonly root: HTMLElement;
  /** The view's body and distance; null hides the zoom, leaving the orbits icon. */
  render(view: RailView | null): void;
  /** Whether the orbits icon is offered, and on. */
  setOrbits(offered: boolean, on: boolean): void;
}

/** An orbit around a sun, as a small line icon. */
function orbitsIcon(): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '20');
  svg.setAttribute('aria-hidden', 'true');
  const orbit = document.createElementNS(ns, 'ellipse');
  for (const [name, value] of [
    ['cx', '12'],
    ['cy', '12'],
    ['rx', '10'],
    ['ry', '5'],
    ['transform', 'rotate(-20 12 12)'],
    ['fill', 'none'],
    ['stroke', 'currentColor'],
    ['stroke-width', '1.6'],
  ] as const) {
    orbit.setAttribute(name, value);
  }
  const sun = document.createElementNS(ns, 'circle');
  for (const [name, value] of [
    ['cx', '12'],
    ['cy', '12'],
    ['r', '2.6'],
    ['fill', 'currentColor'],
  ] as const) {
    sun.setAttribute(name, value);
  }
  const planet = document.createElementNS(ns, 'circle');
  for (const [name, value] of [
    ['cx', '20.6'],
    ['cy', '8.6'],
    ['r', '1.8'],
    ['fill', 'currentColor'],
  ] as const) {
    planet.setAttribute(name, value);
  }
  svg.append(orbit, sun, planet);
  return svg;
}

export function createZoomRail(handlers: {
  /** Glide to a distance, in the radii of the body in focus. */
  onZoom(distance: number): void;
  /** Turn the planets' orbits on or off. */
  onOrbits(): void;
  /** Centre on Earth again. */
  onEarth(): void;
}): ZoomRail {
  let scale = railScale('earth');
  let shown = 3;
  const home = element(
    'button',
    {
      type: 'button',
      class: 'zoom-home',
      'aria-label': 'Back to Earth',
      title: 'Centre on Earth again',
      hidden: '',
    },
    '↑ Earth',
  );
  home.addEventListener('click', () => {
    handlers.onEarth();
  });
  const zoomIn = element(
    'button',
    { type: 'button', class: 'zoom-step', 'aria-label': 'Zoom in' },
    '+',
  );
  const zoomOut = element(
    'button',
    { type: 'button', class: 'zoom-step', 'aria-label': 'Zoom out' },
    '−',
  );
  const slider = element('input', {
    type: 'range',
    class: 'zoom-slider',
    min: '0',
    max: '1000',
    step: '1',
    'aria-label': 'Distance',
    'aria-orientation': 'vertical',
  });
  const track = element('div', { class: 'zoom-track' }, slider);
  let stops: { readonly stop: ZoomStop; readonly button: HTMLButtonElement }[] = [];
  // The stops for the body in focus, drawn again when it changes.
  function placeStops(): void {
    for (const { button } of stops) button.remove();
    stops = stopsFor(scale).map((stop) => {
      const button = element(
        'button',
        {
          type: 'button',
          class: 'zoom-stop',
          title: stop.title,
          'aria-label': `Zoom to ${stop.title}`,
        },
        stop.label,
      );
      button.style.top = `${String(railPosition(stop.distance, scale) * 100)}%`;
      button.addEventListener('click', () => {
        handlers.onZoom(stop.distance);
      });
      track.append(button);
      return { stop, button };
    });
  }
  placeStops();
  const readout = element('span', { class: 'zoom-readout', 'data-testid': 'zoom-readout' });
  const orbits = element('button', {
    type: 'button',
    class: 'zoom-step zoom-orbits',
    'aria-label': 'Orbits',
    'aria-pressed': 'false',
    title: 'The planets’ orbits round the Sun',
    hidden: '',
  });
  orbits.append(orbitsIcon());
  orbits.addEventListener('click', () => {
    handlers.onOrbits();
  });
  const zoom = element('div', { class: 'zoom-parts' }, home, zoomIn, track, zoomOut);
  const root = element(
    'div',
    { class: 'zoom-rail', role: 'group', 'aria-label': 'Zoom', hidden: '' },
    zoom,
    orbits,
    readout,
  );
  let zooming = false;
  // Shown while either part has something to offer.
  function sync(): void {
    zoom.hidden = !zooming;
    readout.hidden = !zooming;
    root.hidden = !zooming && orbits.hidden;
  }
  zoomIn.addEventListener('click', () => {
    handlers.onZoom(distanceAt(railPosition(shown, scale) - STEP, scale));
  });
  zoomOut.addEventListener('click', () => {
    handlers.onZoom(distanceAt(railPosition(shown, scale) + STEP, scale));
  });
  slider.addEventListener('input', () => {
    handlers.onZoom(snappedDistance(Number(slider.value) / 1000, scale));
  });
  return {
    root,
    setOrbits(offered, on) {
      orbits.hidden = !offered;
      orbits.setAttribute('aria-pressed', String(on));
      sync();
    },
    render(view) {
      zooming = view !== null;
      sync();
      if (view === null) return;
      if (view.body !== scale.body) {
        scale = railScale(view.body);
        placeStops();
      }
      home.hidden = view.body === 'earth';
      shown = view.distance;
      if (document.activeElement !== slider) {
        slider.value = String(Math.round(railPosition(view.distance, scale) * 1000));
      }
      const words = distanceText(view.distance, scale);
      slider.setAttribute('aria-valuetext', words);
      readout.textContent = words.replace(` ${fromWords(view.body)}`, '');
      // The stop the view is at, or has passed on the way out.
      const reached = stops.filter(({ stop }) => view.distance >= stop.distance * 0.7).at(-1);
      for (const entry of stops) {
        entry.button.setAttribute('aria-pressed', String(entry === reached));
      }
    },
  };
}
