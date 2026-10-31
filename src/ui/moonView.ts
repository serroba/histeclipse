/**
 * A small picture of the Moon in Earth's shadow, for lunar eclipses: the penumbra, the umbra,
 * the Moon's path and the Moon itself, darkened where the umbra covers it and copper-red in
 * totality. North is up, east to the left, as seen from Earth.
 */

import type { MoonInShadow } from '../eclipses/moonInShadow';

const SVG = 'http://www.w3.org/2000/svg';
/** Earth radii from the shadow's axis to the edge of the picture. */
const EXTENT = 1.75;

function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attributes: Readonly<Record<string, string | number>>,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value));
  return node;
}

export interface MoonView {
  readonly root: SVGSVGElement;
  render(view: MoonInShadow | null): void;
}

export function createMoonView(): MoonView {
  const root = svg('svg', {
    class: 'moon-view',
    viewBox: `${String(-EXTENT)} ${String(-EXTENT)} ${String(2 * EXTENT)} ${String(2 * EXTENT)}`,
    role: 'img',
  });
  const clipId = 'moon-view-clip';
  const clip = svg('clipPath', { id: clipId });
  const clipDisc = svg('circle', { r: 0.2725 });
  clip.append(clipDisc);
  const defs = svg('defs', {});
  defs.append(clip);

  const penumbra = svg('circle', { class: 'moon-view-penumbra' });
  const umbra = svg('circle', { class: 'moon-view-umbra' });
  const path = svg('line', { class: 'moon-view-path' });
  const moon = svg('circle', { class: 'moon-view-moon' });
  // The shadow drawn again, clipped to the Moon's disc: that is what darkens the Moon.
  const onMoonPenumbra = svg('circle', {
    class: 'moon-view-moon-penumbra',
    'clip-path': `url(#${clipId})`,
  });
  const onMoonUmbra = svg('circle', {
    class: 'moon-view-moon-umbra',
    'clip-path': `url(#${clipId})`,
  });
  const north = svg('text', {
    class: 'moon-view-label',
    x: 0,
    y: -EXTENT + 0.22,
    'text-anchor': 'middle',
  });
  north.textContent = 'N';
  const east = svg('text', { class: 'moon-view-label', x: -EXTENT + 0.12, y: 0.07 });
  east.textContent = 'E';
  root.append(defs, penumbra, umbra, path, moon, onMoonPenumbra, onMoonUmbra, north, east);

  return {
    root,
    render(view) {
      root.toggleAttribute('hidden', view === null);
      if (view === null) return;
      // West (+x) is drawn to the right, so east is on the left as in the sky; SVG y grows
      // downwards, so north (+y) is flipped up.
      const cx = String(view.x);
      const cy = String(-view.y);
      for (const [node, radius] of [
        [penumbra, view.penumbraRadius],
        [umbra, view.umbraRadius],
        [onMoonPenumbra, view.penumbraRadius],
        [onMoonUmbra, view.umbraRadius],
      ] as const) {
        node.setAttribute('cx', '0');
        node.setAttribute('cy', '0');
        node.setAttribute('r', String(radius));
      }
      for (const node of [moon, clipDisc]) {
        node.setAttribute('cx', cx);
        node.setAttribute('cy', cy);
        node.setAttribute('r', String(view.moonRadius));
      }
      for (const [name, value] of [
        ['x1', String(-EXTENT)],
        ['x2', String(EXTENT)],
        ['y1', cy],
        ['y2', cy],
      ] as const) {
        path.setAttribute(name, value);
      }
      root.dataset['phase'] = view.phase;
      root.classList.toggle('is-total', view.phase === 'total');
      root.setAttribute(
        'aria-label',
        view.phase === 'none'
          ? 'The Moon outside Earth’s shadow'
          : view.phase === 'total'
            ? 'The Moon entirely inside Earth’s umbra, glowing copper'
            : view.phase === 'partial'
              ? 'The Moon partly inside Earth’s dark umbra'
              : 'The Moon in Earth’s faint penumbra',
      );
    },
  };
}
