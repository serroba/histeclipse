/** The colours of the giant impact's hot debris and young Moon (#180), by how hot they are. */

import type { Triple } from './impactModel';

/** The colour of something as hot as `heat` (0 to 1): white-hot, to orange, to dull red. */
export function glowColour(heat: number): Triple {
  const h = Math.min(1, Math.max(0, heat));
  return [0.45 + 0.55 * Math.min(1, h * 1.6), 0.12 + 0.8 * h ** 1.5, 0.05 + 0.6 * h ** 3];
}

/** The Moon's colour at `heat`: molten orange, cooling to grey rock. */
export function moonColour(heat: number): Triple {
  const h = Math.min(1, Math.max(0, heat));
  return [0.55 + 0.45 * h, 0.55 - 0.13 * h, 0.55 - 0.42 * h];
}
