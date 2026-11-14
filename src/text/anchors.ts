/**
 * Anchors in words and as links (#391, #392): where and when one is, and the view it opens from
 * the one the reader has.
 */

import { MOON_NAMES } from '../globe/moonLook';
import { PLANET_NAMES } from '../globe/planetLook';
import { astronomicalYear, formatYear } from '../time/year';
import type { Anchor } from './passages';

const BODY_NAMES: Readonly<Record<string, string>> = {
  earth: 'Earth',
  moon: 'the Moon',
  sun: 'the Sun',
  ...PLANET_NAMES,
  ...MOON_NAMES,
};

/** A latitude and longitude in words: "35.6°N 35.8°E". */
function place([lat, lon]: readonly [number, number]): string {
  const ns = lat < 0 ? 'S' : 'N';
  const ew = lon < 0 ? 'W' : 'E';
  return `${Math.abs(lat).toFixed(1)}°${ns} ${Math.abs(lon).toFixed(1)}°${ew}`;
}

/** Where and when an anchor is, in words: "Earth · 35.6°N 35.8°E · 1223 BCE". */
export function anchorLabel(anchor: Anchor): string {
  const body = BODY_NAMES[anchor.body] ?? anchor.body;
  const where = anchor.at === undefined ? [] : [place(anchor.at)];
  const [from, to] = anchor.when ?? [];
  const when =
    from === undefined || to === undefined
      ? []
      : [
          from === to
            ? formatYear(astronomicalYear(from))
            : `${formatYear(astronomicalYear(from))} – ${formatYear(astronomicalYear(to))}`,
        ];
  return [body.charAt(0).toUpperCase() + body.slice(1), ...where, ...when].join(' · ');
}

/** What the reader is looking at stays; where they look, and what is open, the anchor says. */
const PLACED = [
  'mode',
  'focus',
  'cam',
  'view',
  'loc',
  'look',
  'sel',
  // The mission followed (#712): another passage's place leaves it.
  'mission',
  'ma',
  'scale',
  'why',
  'tree',
  'craters',
  'lineages',
  'light',
  'borders',
];

/**
 * The link an anchor opens from the view the reader has: the reader's view less where it looks
 * and what it has open, with the anchor's laid over it; the anchor's layers added to theirs.
 */
export function anchorQuery(anchor: Anchor, current: string): string {
  const params = new URLSearchParams(current);
  const anchored = new URLSearchParams(anchor.view);
  for (const key of PLACED) params.delete(key);
  // A moment of the anchor's own replaces the reader's; deep time has none.
  if (anchored.has('t') || anchored.has('ma')) params.delete('t');
  if (anchored.has('t')) params.delete('cal');
  for (const [key, value] of anchored) {
    if (key === 'layers') {
      const layers = new Set([...(params.get('layers') ?? '').split(','), ...value.split(',')]);
      layers.delete('');
      params.set('layers', [...layers].join(','));
    } else {
      params.set(key, value);
    }
  }
  return params.toString().replaceAll('%2C', ',').replaceAll('%3A', ':');
}
