/** Which body's cycle the bar's time follows (#447), worked out from the view alone. */

import type { PlanetName } from '../../astro/planets';
import { isMoonBody, moonPlanet } from '../../globe/moonLook';
import { awayFromEarth, type ViewState } from '../../state/viewState';

/** The body whose cycle the bar shows: a planet or the Sun, in the years, no eclipse open. */
export function cycleBody(state: ViewState): PlanetName | 'sun' | null {
  const { focus } = state;
  if (!awayFromEarth(state) || state.selection !== null) return null;
  // A planet's moon goes by its planet's cycle.
  if (isMoonBody(focus)) return moonPlanet(focus);
  return focus === 'earth' || focus === 'moon' ? null : focus;
}
