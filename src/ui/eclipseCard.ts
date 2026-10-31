/** Details of the selected eclipse: what, when, where the Moon was overhead, and how sure. */

import type { LunarEclipse } from '../data/lunarCatalog';
import { describeLunarEclipse, eclipseMoment } from '../eclipses/lunar';
import { longitudeUncertainty, moonVisibility } from '../eclipses/visibility';
import type { GeoPoint } from '../state/viewState';
import { formatDate, formatDuration, formatTimeOfDay } from '../time/format';
import { element } from './dom';

export interface EclipseCard {
  readonly root: HTMLElement;
  render(
    eclipse: LunarEclipse | undefined,
    uncertaintySeconds: number,
    observer: GeoPoint | null,
  ): void;
}

function formatPoint({ latitude, longitude }: GeoPoint): string {
  const lat = `${Math.abs(latitude).toFixed(1)}°${latitude >= 0 ? 'N' : 'S'}`;
  const lon = `${Math.abs(longitude).toFixed(1)}°${longitude >= 0 ? 'E' : 'W'}`;
  return `${lat} ${lon}`;
}

const OBSERVER_TEXT = {
  visible: 'The Moon was above the horizon here.',
  hidden: 'The Moon was below the horizon here.',
  uncertain: 'The Moon was near the horizon here; ΔT uncertainty decides whether it was up.',
} as const;

export function createEclipseCard(): EclipseCard {
  const root = element('section', { class: 'eclipse-card', 'aria-live': 'polite', hidden: '' });
  return {
    root,
    render(eclipse, uncertaintySeconds, observer) {
      if (eclipse === undefined) {
        root.hidden = true;
        root.replaceChildren();
        return;
      }
      const { title, depth } = describeLunarEclipse(eclipse);
      const moment = eclipseMoment(eclipse);
      const [latitude, longitude] = eclipse.sublunar;
      const sublunar = { latitude, longitude };
      const shift = longitudeUncertainty(uncertaintySeconds);
      const lines = [
        element('h2', {}, title),
        element('p', { class: 'eclipse-depth' }, depth),
        element(
          'p',
          {},
          `Greatest eclipse ${formatDate(moment)}, ${formatTimeOfDay(moment)}. Moon overhead at ${formatPoint(sublunar)}.`,
        ),
        element(
          'p',
          { class: 'eclipse-uncertainty' },
          `Shaded: where the Moon was up. ΔT is uncertain by ±${formatDuration(uncertaintySeconds)}, which moves this ±${shift.toFixed(1)}° east or west (hatched band).`,
        ),
      ];
      if (observer !== null) {
        const visibility = moonVisibility(sublunar, observer, uncertaintySeconds);
        lines.push(
          element(
            'p',
            { class: `eclipse-observer is-${visibility}` },
            `${formatPoint(observer)}: ${OBSERVER_TEXT[visibility]}`,
          ),
        );
      }
      root.replaceChildren(...lines);
      root.hidden = false;
    },
  };
}
