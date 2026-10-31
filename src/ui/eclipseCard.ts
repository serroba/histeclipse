/** Details of the selected eclipse: what, when, where, how sure, and what a chosen place saw. */

import type { LunarEclipse } from '../data/lunarCatalog';
import type { SolarEclipse } from '../data/solarCatalog';
import {
  describeLunarEclipse,
  describeSolarEclipse,
  eclipseMoment,
  isSolar,
} from '../eclipses/describe';
import { solarOutlook, type LocalPhase } from '../eclipses/solar';
import { longitudeUncertainty, moonVisibility } from '../eclipses/visibility';
import type { GeoPoint } from '../state/viewState';
import { formatDate, formatDuration, formatTimeOfDay } from '../time/format';
import { element } from './dom';

export interface EclipseCard {
  readonly root: HTMLElement;
  render(
    eclipse: LunarEclipse | SolarEclipse | undefined,
    uncertaintySeconds: number,
    observer: GeoPoint | null,
  ): void;
}

export function formatPoint({ latitude, longitude }: GeoPoint): string {
  const lat = `${Math.abs(latitude).toFixed(1)}°${latitude >= 0 ? 'N' : 'S'}`;
  const lon = `${Math.abs(longitude).toFixed(1)}°${longitude >= 0 ? 'E' : 'W'}`;
  return `${lat} ${lon}`;
}

const LUNAR_OBSERVER_TEXT = {
  visible: 'The Moon was above the horizon here.',
  hidden: 'The Moon was below the horizon here.',
  uncertain: 'The Moon was near the horizon here; ΔT uncertainty decides whether it was up.',
} as const;

const PHASE_TEXT: Record<LocalPhase, string> = {
  none: 'no eclipse',
  partial: 'a partial eclipse',
  annular: 'an annular eclipse',
  total: 'a total eclipse',
};

/** ΔT uncertainty in plain words; negligible for the telescopic era. */
export function uncertaintyText(uncertaintySeconds: number, shiftDegrees: number): string {
  if (shiftDegrees < 0.05) {
    return `ΔT is known to ±${formatDuration(uncertaintySeconds)} here, so positions are not in doubt.`;
  }
  return `ΔT is uncertain by ±${formatDuration(uncertaintySeconds)}, which moves this ±${shiftDegrees.toFixed(1)}° east or west (hatched band).`;
}

function lunarLines(
  eclipse: LunarEclipse,
  uncertaintySeconds: number,
  observer: GeoPoint | null,
): HTMLElement[] {
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
      `Shaded: where the Moon was up. ${uncertaintyText(uncertaintySeconds, shift)}`,
    ),
  ];
  if (observer !== null) {
    const visibility = moonVisibility(sublunar, observer, uncertaintySeconds);
    lines.push(
      element(
        'p',
        { class: `eclipse-observer is-${visibility}` },
        `${formatPoint(observer)}: ${LUNAR_OBSERVER_TEXT[visibility]}`,
      ),
    );
  }
  return lines;
}

function solarLines(
  eclipse: SolarEclipse,
  uncertaintySeconds: number,
  observer: GeoPoint | null,
): HTMLElement[] {
  const { title, depth } = describeSolarEclipse(eclipse);
  const moment = eclipseMoment(eclipse);
  const [latitude, longitude] = eclipse.greatest;
  const shift = longitudeUncertainty(uncertaintySeconds);
  const lines = [
    element('h2', {}, title),
    element('p', { class: 'eclipse-depth' }, depth),
    element(
      'p',
      {},
      `Greatest eclipse ${formatDate(moment)}, ${formatTimeOfDay(moment)}, at ${formatPoint({ latitude, longitude })}.`,
    ),
    element(
      'p',
      { class: 'eclipse-uncertainty' },
      `Shadow: where the Moon covers the Sun now (dark core: ${eclipse.kind === 'annular' ? 'annular' : 'total'}). ${eclipse.kind === 'partial' ? 'No central path: the umbra misses Earth.' : 'Gold band: the central path.'} Dashed blue line: the limits of the partial eclipse. ${uncertaintyText(uncertaintySeconds, shift)}`,
    ),
  ];
  if (observer !== null) {
    const outlook = solarOutlook(eclipse.elements, eclipse.deltaT, uncertaintySeconds, observer);
    const here = formatPoint(observer);
    if (outlook.nominal === null && outlook.phases.length === 1) {
      lines.push(
        element('p', { class: 'eclipse-observer is-hidden' }, `${here}: no eclipse here.`),
      );
    } else {
      const maximum = outlook.nominal;
      const when =
        maximum === null
          ? ''
          : ` Deepest at ${formatTimeOfDay(eclipseMoment({ jdTT: maximum.jdTT, deltaT: eclipse.deltaT }))}, magnitude ${maximum.circumstances.magnitude.toFixed(2)}.`;
      const certain = outlook.phases.length === 1;
      const seen = certain
        ? `${here}: ${PHASE_TEXT[outlook.phases[0] ?? 'none']}.`
        : `${here}: ${outlook.phases.map((phase) => PHASE_TEXT[phase]).join(' or ')}, depending on ΔT.`;
      lines.push(
        element(
          'p',
          { class: `eclipse-observer ${certain ? 'is-visible' : 'is-uncertain'}` },
          `${seen}${when}`,
        ),
      );
    }
  }
  return lines;
}

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
      root.replaceChildren(
        ...(isSolar(eclipse)
          ? solarLines(eclipse, uncertaintySeconds, observer)
          : lunarLines(eclipse, uncertaintySeconds, observer)),
      );
      root.hidden = false;
    },
  };
}
