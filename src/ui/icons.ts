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
