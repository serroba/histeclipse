/**
 * How far out the view is, on a rail at the side, for whichever body is in focus: the body at
 * the top, out to the planets at the bottom, with the stops named so the reader sees that
 * zooming out reaches the Solar System. A stop flies there; the slider and the + and −
 * buttons move along the rail. Away from Earth, a stop at the top takes the view back to it.
 * Below, a small icon draws the planets' orbits, offered wherever they can be seen.
 *
 * DOM glue, covered by the Playwright suite; the scale, its stops and its words are unit-tested.
 */

import { MOON_NAMES } from '../globe/moonLook';
import { BODY_RADIUS } from '../globe/bodyRadius';
import { EARTH_RADIUS_KM } from '../globe/spaceFrame';
import { CAMERA_DISTANCE_RANGE, nearestDistance, type Body } from '../state/viewState';
import { element } from './dom';
import { createZoomStops } from './zoomStops';
import { railIcons } from './zoomRailIcons';
import './zoomRail.css';

/** A rail for one body: its distances in its own radii, as near and as far as the camera goes. */
export interface RailScale {
  readonly body: Body;
  /** The body's radius in kilometres. */
  readonly radiusKm: number;
  readonly near: number;
  readonly far: number;
}

/** The rail for `body`, over the distances the camera allows round it, from `near` on this device. */
export function railScale(body: Body, near: number): RailScale {
  const radius = BODY_RADIUS[body];
  return {
    body,
    radiusKm: radius * EARTH_RADIUS_KM,
    near,
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
  ...MOON_NAMES,
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
 * Earth and the Moon's orbit together; the inner planets round the Sun; out to Saturn, and to
 * Neptune and the Kuiper belt: round numbers of Earth radii (as Earth's own rail has them), in kilometres for any body's.
 */
const MOON_ORBIT_KM = 150 * EARTH_RADIUS_KM;
const PLANETS_KM = 60_000 * EARTH_RADIUS_KM;
const SATURN_KM = 300_000 * EARTH_RADIUS_KM;
/**
 * Far enough that the Kuiper belt out to 50 AU from the Sun, and Neptune's orbit within it, fit
 * the height of the view: 3.2 times as far as they are wide, at the camera's 35°. One stop for
 * both: a stop for Neptune too would sit a label's height from this one, and on a phone's short
 * rail crowd the others off their places.
 */
const KUIPER_BELT_KM = 3_750_000 * EARTH_RADIUS_KM;

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
    {
      distance: radii(KUIPER_BELT_KM),
      label: 'Kuiper belt',
      title: 'Out to Neptune and the Kuiper belt',
    },
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
  /** The nearest the camera comes to the body on this device, in its radii. */
  readonly near: number;
  /** On a craft (#796): only the way back to the body, its stops saying nothing of metres. */
  readonly craft?: true;
}

export interface ZoomRail {
  readonly root: HTMLElement;
  /** The view's body and distance; null hides the zoom, leaving the orbits icon. */
  render(view: RailView | null): void;
  /** Whether the orbits icon is offered, and on. */
  setOrbits(offered: boolean, on: boolean): void;
  /** Whether the spacecraft icon is offered, and on. */
  setSpacecraft(offered: boolean, on: boolean): void;
  /** Whether the asteroid belt's icon is offered, and on. */
  setAsteroids(offered: boolean, on: boolean): void;
  /** Whether "Why here?" is offered, and on: a tap on the globe then says what is there. */
  setWhyHere(offered: boolean, on: boolean): void;
  /** Whether the span offers layers on the rail (#1156). */
  setLayers(offered: boolean): void;
}

export function createZoomRail(
  handlers: {
    /** Glide to a distance, in the radii of the body in focus. */
    onZoom(distance: number): void;
    /** Turn the planets' orbits on or off. */
    onOrbits(): void;
    /** Turn the craft beyond Earth orbit on or off. */
    onSpacecraft(): void;
    /** Turn the asteroid belt on or off. */
    onAsteroids(): void;
    /** Turn "Why here?" on or off. */
    onWhyHere(): void;
    /** Centre on Earth again. */
    onEarth(): void;
  },
  /** The layers the span offers (#1156), under the rail's own icons. */
  layers: HTMLElement | null = null,
): ZoomRail {
  let scale = railScale('earth', nearestDistance('earth', true));
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
  // The stops for the body in focus, drawn again when it changes, kept apart (#980).
  const stops = createZoomStops(track, (distance) => {
    handlers.onZoom(distance);
  });
  const placeStops = (): void => {
    stops.place(
      stopsFor(scale).map((stop) => ({ ...stop, at: railPosition(stop.distance, scale) })),
    );
  };
  placeStops();
  const readout = element('span', { class: 'zoom-readout', 'data-testid': 'zoom-readout' });
  const { orbits, spacecraft, asteroids, whyHere } = railIcons(handlers);
  const zoom = element('div', { class: 'zoom-parts' }, home, zoomIn, track, zoomOut);
  const root = element(
    'div',
    { class: 'zoom-rail', role: 'group', 'aria-label': 'Zoom', hidden: '' },
    zoom,
    orbits,
    spacecraft,
    asteroids,
    whyHere,
    ...(layers === null ? [] : [layers]),
    readout,
  );
  // Zooming, or on a craft (#796), with only the way back; shown while either part offers some.
  let [zooming, onCraft, layered] = [false, false, false];
  function sync(): void {
    zoom.hidden = !zooming;
    root.toggleAttribute('data-zooming', zooming);
    readout.hidden = !zooming || onCraft;
    for (const part of [zoomIn, track, zoomOut]) part.hidden = onCraft;
    root.hidden = !zooming && orbits.hidden === true && whyHere.hidden === true && !layered;
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
    setLayers(offered) {
      layered = offered;
      sync();
    },
    setWhyHere(offered, on) {
      whyHere.hidden = !offered;
      whyHere.setAttribute('aria-pressed', String(on));
      sync();
    },
    setOrbits(offered, on) {
      orbits.hidden = !offered;
      orbits.setAttribute('aria-pressed', String(on));
      sync();
    },
    setSpacecraft(offered, on) {
      spacecraft.hidden = !offered;
      spacecraft.setAttribute('aria-pressed', String(on));
      sync();
    },
    setAsteroids(offered, on) {
      asteroids.hidden = !offered;
      asteroids.setAttribute('aria-pressed', String(on));
      sync();
    },
    render(view) {
      zooming = view !== null;
      onCraft = view?.craft === true;
      sync();
      if (view === null) return;
      home.hidden = view.body === 'earth' && !onCraft;
      if (view.body !== scale.body || view.near !== scale.near) {
        scale = railScale(view.body, view.near);
        placeStops();
      }
      shown = view.distance;
      if (document.activeElement !== slider) {
        slider.value = String(Math.round(railPosition(view.distance, scale) * 1000));
      }
      const words = distanceText(view.distance, scale);
      slider.setAttribute('aria-valuetext', words);
      readout.textContent = words.replace(` ${fromWords(view.body)}`, '');
      stops.mark(view.distance);
    },
  };
}
