/**
 * The site's own small line icons, drawn inline (no font or sprite to fetch), in one style: a
 * 24-unit box, 1.7 strokes in the text's colour. Decorative: whatever carries one also carries
 * words, or an accessible name.
 */

import type { SourceKind } from '../sources/registry';

const NS = 'http://www.w3.org/2000/svg';

/** An icon from path data, `size` pixels square. */
function icon(paths: readonly string[], size = 16): SVGSVGElement {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.7');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.classList.add('icon');
  for (const d of paths) {
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}

/** An open book: "where this comes from". */
export function bookIcon(size?: number): SVGSVGElement {
  return icon(
    [
      'M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5',
      'M12 6.5c2-1.5 5-2 8.5-1.5v13c-3.5-.5-6.5 0-8.5 1.5',
      'M12 6.5v13',
    ],
    size,
  );
}

const KIND_PATHS: Readonly<Record<SourceKind, readonly string[]>> = {
  // A page with a folded corner and lines of text.
  paper: ['M6 3h8l4 4v14H6z', 'M14 3v4h4', 'M9 12h6', 'M9 15.5h6'],
  // A stack of records.
  dataset: [
    'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3z',
    'M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6',
    'M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
  ],
  // A curve over axes: something computed.
  model: ['M4 4v16h16', 'M7 15c2.5-6 5-8 7-5s3 1 5-4'],
  // A frame with a hill and a sun.
  imagery: ['M3 5h18v14H3z', 'M3 16l5-5 4 4 3-3 6 6', 'M15.5 9a1.5 1.5 0 1 0 0-.01'],
  // A list.
  catalogue: ['M9 6h11', 'M9 12h11', 'M9 18h11', 'M4.5 6h.01', 'M4.5 12h.01', 'M4.5 18h.01'],
};

/** The icon for a kind of source. */
export function kindIcon(kind: SourceKind, size?: number): SVGSVGElement {
  return icon(KIND_PATHS[kind], size);
}

/** What each kind is called, for the icon's tooltip and the bibliography's groups. */
export const KIND_NAMES: Readonly<Record<SourceKind, string>> = {
  paper: 'Paper',
  dataset: 'Dataset',
  model: 'Model',
  imagery: 'Imagery',
  catalogue: 'Catalogue',
};

/** The site's control icons, by what they stand for. */
const UI_PATHS = {
  // A globe with an arrow going round it.
  orbit: [
    'M12 7.5a4.5 4.5 0 1 0 0 9a4.5 4.5 0 1 0 0-9z',
    'M4 9.5a9 9 0 0 1 15-3.8',
    'M19 3.5v2.4h-2.4',
    'M20 14.5a9 9 0 0 1-15 3.8',
    'M5 20.5v-2.4h2.4',
  ],
  // A crescent Moon over the ground.
  moonFromEarth: ['M15.5 4a5 5 0 1 0 4.5 6.5a4 4 0 0 1-4.5-6.5z', 'M3 20h18', 'M5 20c2-3 5-4 8-2'],
  // Earth over the Moon's cratered horizon.
  earthFromMoon: [
    'M12 3.5a4.75 4.75 0 1 0 0 9.5a4.75 4.75 0 1 0 0-9.5z',
    'M12 3.5c-2 2.6-2 6.9 0 9.5',
    'M12 3.5c2 2.6 2 6.9 0 9.5',
    'M7.3 8.25h9.4',
    'M3 20c6-3 12-3 18 0',
    'M8 18.6h.01',
    'M15 18.4h.01',
  ],
  // Stars.
  sky: [
    'M8 4.5l1.2 2.6 2.8.4-2 2 .5 2.8-2.5-1.4-2.5 1.4.5-2.8-2-2 2.8-.4z',
    'M17.5 12l.8 1.7 1.9.3-1.4 1.3.3 1.9-1.6-.9-1.6.9.3-1.9-1.4-1.3 1.9-.3z',
    'M6 18h.01',
    'M13 19.5h.01',
    'M19 6h.01',
  ],
  // Waves.
  seaLevel: ['M3 9c2-2 4-2 6 0s4 2 6 0 4-2 6 0', 'M3 14c2-2 4-2 6 0s4 2 6 0 4-2 6 0', 'M3 19h18'],
  // A thermometer.
  temperature: ['M10 4a2 2 0 0 1 4 0v9.5a4 4 0 1 1-4 0z', 'M12 9v7'],
  // A globe split by a plate boundary.
  plates: ['M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z', 'M5 7l4 3-1 4 4 2 1 5', 'M13 3.2l1 4.8 4 1.5'],
  // An ammonite's coil.
  fossils: [
    'M12 20a8 8 0 1 1 8-8c0 3.5-2.7 6-6 6-2.8 0-5-2.2-5-5 0-2.2 1.8-4 4-4 1.7 0 3 1.3 3 3 0 1.1-.9 2-2 2',
  ],
  // A meteor striking.
  impacts: ['M3 3l9 9', 'M7 3l7 7', 'M3 7l7 7', 'M16 13a4 4 0 1 0 0 8a4 4 0 1 0 0-8z'],
  // Wind.
  air: ['M3 9h11a3 3 0 1 0-3-3', 'M3 14h15a3 3 0 1 1-3 3', 'M3 19h6'],
  // A person.
  humans: [
    'M12 4a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5z',
    'M8 21v-6l-2-1 2-4h8l2 4-2 1v6',
    'M12 15v6',
  ],
} as const;

export type UiIcon = keyof typeof UI_PATHS;

/** A control's icon. */
export function uiIcon(name: UiIcon, size = 18): SVGSVGElement {
  return icon(UI_PATHS[name], size);
}
