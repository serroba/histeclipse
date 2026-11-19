/**
 * The equatorial Pacific from below (#895), drawn in the El Niño panel: the month's section,
 * 120°E at the left to 80°W at the right, the surface at the top to 400 m, coloured as the sea's
 * anomaly is (blue colder, red warmer than the month's 1991–2020 mean). Each of IAP's depths is
 * drawn as deep as it reaches, so the uneven levels (every 5 m near the top, 20 m below 200 m)
 * keep the true shape: in an El Niño the warm water slides east and deepens.
 */

import { coloured } from '../../globe/packedMaps';
import { element } from '../../ui/dom';
import type { SectionView } from './sectionMaps';

/** The drawing's size, pixels. */
const WIDTH = 320;
const HEIGHT = 120;

/**
 * Where each row is drawn, top and bottom as shares of the height: from halfway to the level
 * above to halfway to the level below, the first from the surface, the last to the deepest.
 */
export function rowSpans(levels: readonly number[]): { top: number; bottom: number }[] {
  const deepest = levels.at(-1) ?? 1;
  return levels.map((depth, at) => {
    const above = at === 0 ? 0 : (depth + (levels[at - 1] ?? depth)) / 2;
    const below = at === levels.length - 1 ? deepest : (depth + (levels[at + 1] ?? depth)) / 2;
    return { top: above / deepest, bottom: below / deepest };
  });
}

export interface SectionFigure {
  readonly root: HTMLElement;
  /** Draws a month's section, or hides the figure for null. */
  draw(view: SectionView | null, caption: string): void;
}

export function sectionFigure(): SectionFigure {
  const canvas = element('canvas', {
    class: 'enso-section-canvas',
    width: String(WIDTH),
    height: String(HEIGHT),
    'aria-hidden': 'true',
  });
  const caption = element('figcaption', {});
  const root = element(
    'figure',
    { class: 'enso-section', hidden: '' },
    caption,
    canvas,
    element(
      'div',
      { class: 'enso-section-axis', 'aria-hidden': 'true' },
      element('span', {}, '120°E'),
      element('span', {}, '0–400 m'),
      element('span', {}, '80°W'),
    ),
  );
  let drawnFor: SectionView['packed'] | null = null;
  return {
    root,
    draw(view, words) {
      root.hidden = view === null;
      caption.textContent = words;
      if (view === null || view.packed === drawnFor) return;
      drawnFor = view.packed;
      const source = coloured(view.packed);
      const context = canvas.getContext('2d');
      if (source === null || context === null) return;
      context.clearRect(0, 0, WIDTH, HEIGHT);
      context.imageSmoothingEnabled = false;
      rowSpans(view.levels).forEach(({ top, bottom }, row) => {
        const y = top * HEIGHT;
        const height = Math.max(1, (bottom - top) * HEIGHT);
        context.drawImage(source, 0, row, source.width, 1, 0, y, WIDTH, height);
      });
    },
  };
}
