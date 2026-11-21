/**
 * The site's own small line icons, drawn inline (no font or sprite to fetch), in one style: a
 * 24-unit box, 1.7 strokes in the text's colour. Decorative: whatever carries one also carries
 * words, or an accessible name.
 */

import type { Span } from '../deepTime/scale';
import { layerEntry, type Layer } from '../layers/layers';
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
  // An "i" in a circle: an agency's page on a body or a mission.
  reference: ['M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z', 'M12 11v6', 'M12 7.5h.01'],
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
  reference: 'Reference',
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
  // The full Moon with Earth's shadow across it.
  lunar: ['M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16z', 'M14.5 4.4a8.5 8.5 0 0 1 0 15.2'],
  // A lens and its handle.
  search: ['M10.5 4a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13z', 'M15.3 15.3L20 20'],
  // A compass: where to go (#727).
  explore: ['M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z', 'M15.5 8.5l-2 5-5 2 2-5z'],
  // Stacked sheets.
  layers: ['M12 3l9 5-9 5-9-5z', 'M3 12.5l9 5 9-5', 'M3 16.5l9 5 9-5'],
  // The planetary boundaries (#434): Earth, its safe ring, and the wedges out from it.
  boundaries: [
    'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z',
    'M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6z',
    'M12 3v6M12 15v6M3 12h6M15 12h6',
  ],
  // Four corners pushed out.
  fullView: ['M4 9V4h5', 'M15 4h5v5', 'M20 15v5h-5', 'M9 20H4v-5'],
  // The diamond ring: the last bead of sunlight on the Moon's rim, at totality.
  famous: [
    'M11 7a6 6 0 1 0 0 12a6 6 0 1 0 0-12z',
    'M16.2 6.3a1.3 1.3 0 1 0 0 .01',
    'M16.2 2.5v1.3',
    'M20 6.3h-1.3',
    'M19 3.5l-1 1',
  ],
} as const;

export type UiIcon = keyof typeof UI_PATHS;

/** A control's icon. */
export function uiIcon(name: UiIcon, size = 18): SVGSVGElement {
  return icon(UI_PATHS[name], size);
}

/** How far back time reaches, each span by what it shows (#1068). */
const SPAN_PATHS: Readonly<Record<Span, readonly string[]>> = {
  // A calendar: the years, day by day.
  years: [
    'M4 6h16v14H4z',
    'M4 10h16',
    'M8 3.5v4',
    'M16 3.5v4',
    'M8 13.5h.01',
    'M12 13.5h.01',
    'M16 13.5h.01',
    'M8 17h.01',
    'M12 17h.01',
  ],
  // A snowflake: the ice ages.
  ice: [
    'M12 3v18',
    'M4.2 7.5l15.6 9',
    'M4.2 16.5l15.6-9',
    'M9.5 4.5L12 7l2.5-2.5',
    'M9.5 19.5L12 17l2.5 2.5',
  ],
  // A trilobite: the 540 million years since the Cambrian.
  all: [
    'M4 9c0-3.5 3.5-6 8-6s8 2.5 8 6z',
    'M4 9l-.8 4.5',
    'M20 9l.8 4.5',
    'M6.5 9v5c0 3.5 2.5 6.5 5.5 7c3-.5 5.5-3.5 5.5-7V9',
    'M10.5 9v10.5',
    'M13.5 9v10.5',
    'M6.5 12.5h4',
    'M13.5 12.5h4',
    'M6.8 16h3.7',
    'M13.5 16h3.7',
    'M9 6.3h.01',
    'M15 6.3h.01',
  ],
  // The geologic time spiral: all of Earth's history, winding out from its start.
  eons: [
    'M12 12a1.5 1.5 0 0 1 3 0a3 3 0 0 1-6 0a4.5 4.5 0 0 1 9 0a6 6 0 0 1-12 0a7.5 7.5 0 0 1 15 0',
  ],
};

/** A span's icon. */
export function spanIcon(span: Span, size = 16): SVGSVGElement {
  return icon(SPAN_PATHS[span], size);
}

/** A layer's icon, as its description in `src/layers` draws it (#904). */
export function layerIcon(layer: Layer, size = 16): SVGSVGElement {
  return icon(layerEntry(layer).icon, size);
}
