/**
 * The layers' icons on the zoom rail (#474): the planets' orbits, the spacecraft, the asteroid
 * belt and "Why here?", each pressed while it is on and hidden until it is offered.
 */

import { element } from './dom';
import { bookIcon, layerIcon } from './icons';

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

/** A layer's icon on the rail: pressed while it is on, hidden until it is offered. */
function iconButton(
  name: string,
  label: string,
  title: string,
  icon: Node,
  run: () => void,
): HTMLButtonElement {
  const button = element('button', {
    type: 'button',
    class: `zoom-step zoom-${name}`,
    'aria-label': label,
    'aria-pressed': 'false',
    title,
    hidden: '',
  });
  button.append(icon);
  button.addEventListener('click', run);
  return button;
}

/** The rail's four icons, each calling its handler. */
export function railIcons(handlers: {
  onOrbits(): void;
  onSpacecraft(): void;
  onAsteroids(): void;
  onWhyHere(): void;
}): Record<'orbits' | 'spacecraft' | 'asteroids' | 'whyHere', HTMLButtonElement> {
  return {
    orbits: iconButton(
      'orbits',
      'Orbits',
      'The planets’ orbits round the Sun',
      orbitsIcon(),
      () => {
        handlers.onOrbits();
      },
    ),
    spacecraft: iconButton(
      'spacecraft',
      'Spacecraft',
      'Every craft sent beyond Earth orbit, flying as the time plays',
      layerIcon('spacecraft', 18),
      () => {
        handlers.onSpacecraft();
      },
    ),
    asteroids: iconButton(
      'asteroids',
      'Asteroids and dwarf planets',
      'The largest asteroids and the dwarf planets, around the Sun',
      layerIcon('asteroids', 18),
      () => {
        handlers.onAsteroids();
      },
    ),
    whyHere: iconButton(
      'why-here',
      'Why here?',
      'Tap the globe to see what each layer has there, and where it comes from',
      bookIcon(18),
      () => {
        handlers.onWhyHere();
      },
    ),
  };
}
