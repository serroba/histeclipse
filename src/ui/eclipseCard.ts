/** Details of the selected eclipse: what, when, where, how sure, and what a chosen place saw. */

import type { FamousEclipse } from '../data/famousEclipses';
import type { LunarEclipse } from '../data/lunarCatalog';
import type { SolarEclipse } from '../data/solarCatalog';
import {
  describeLunarEclipse,
  describeSolarEclipse,
  eclipseMoment,
  isSolar,
} from '../eclipses/describe';
import { lunarPhaseAt, type LunarPhase } from '../eclipses/lunarPhases';
import { moonInShadow } from '../eclipses/moonInShadow';
import { solarOutlook, type LocalPhase } from '../eclipses/solar';
import { longitudeUncertainty, moonVisibility } from '../eclipses/visibility';
import type { GeoPoint } from '../state/viewState';
import { formatDate, formatDuration, formatTimeOfDay } from '../time/format';
import { element } from './dom';
import { createMoonView } from './moonView';

export interface EclipseCard {
  readonly root: HTMLElement;
  render(
    eclipse: LunarEclipse | SolarEclipse | undefined,
    uncertaintySeconds: number,
    observer: GeoPoint | null,
    famous?: FamousEclipse,
    offsetMinutes?: number,
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

const LUNAR_PHASE_NOW: Record<LunarPhase, string> = {
  none: 'Not now: the Moon is outside Earth’s shadow at this time. Move the time slider into the eclipse.',
  penumbral: 'Now: penumbral phase, a faint dimming that is hard to notice.',
  partial: 'Now: partial phase, Earth’s dark shadow takes a bite out of the Moon.',
  total: 'Now: totality, the whole Moon is in Earth’s shadow and glows coppery red.',
};

function lunarLines(
  eclipse: LunarEclipse,
  uncertaintySeconds: number,
  observer: GeoPoint | null,
  offsetMinutes: number,
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
    element('p', { class: 'eclipse-phase' }, LUNAR_PHASE_NOW[lunarPhaseAt(eclipse, offsetMinutes)]),
    element(
      'p',
      { class: 'eclipse-uncertainty' },
      `In a lunar eclipse Earth’s shadow falls on the Moon, so the ground doesn’t darken. Copper: where the Moon is above the horizon now, so people could watch it. ${uncertaintyText(uncertaintySeconds, shift)}`,
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

/** The historical context of a famous eclipse: why it is known, and from where. */
function famousLines(famous: FamousEclipse): HTMLElement[] {
  return [
    element('p', { class: 'famous-card-title' }, famous.title),
    element('p', { class: 'famous-card-summary' }, famous.summary),
    element('p', { class: 'famous-card-source' }, `Source: ${famous.source}`),
    ...(famous.debateNote === undefined
      ? []
      : [element('p', { class: 'famous-card-debate' }, `Debated: ${famous.debateNote}`)]),
  ];
}

export function createEclipseCard(): EclipseCard {
  const root = element('section', { class: 'eclipse-card', 'aria-live': 'polite', hidden: '' });
  // Reused across renders, so scrubbing time moves the Moon smoothly instead of rebuilding it.
  const moonView = createMoonView();
  return {
    root,
    render(eclipse, uncertaintySeconds, observer, famous, offsetMinutes = 0) {
      if (eclipse === undefined) {
        root.hidden = true;
        root.replaceChildren();
        return;
      }
      const lines = isSolar(eclipse)
        ? solarLines(eclipse, uncertaintySeconds, observer)
        : lunarLines(eclipse, uncertaintySeconds, observer, offsetMinutes);
      // Essentials stay in view; background and how to read the map fold away, which keeps the
      // globe visible on phones.
      const background = lines.filter((line) => line.classList.contains('eclipse-uncertainty'));
      const essentials = lines.filter((line) => !background.includes(line));
      const famousBackground = famous === undefined ? [] : famousLines(famous).slice(1);
      // The card is rebuilt as time changes; keep "More about this eclipse" open if it was.
      const wasOpen = root.querySelector('details')?.open ?? false;
      const more = element(
        'details',
        { class: 'eclipse-more' },
        element('summary', {}, 'More about this eclipse'),
        ...famousBackground,
        ...background,
      );
      more.open = wasOpen;
      const text = element(
        'div',
        { class: 'eclipse-text' },
        ...(famous === undefined ? [] : famousLines(famous).slice(0, 1)),
        ...essentials,
      );
      moonView.render(isSolar(eclipse) ? null : moonInShadow(eclipse, offsetMinutes));
      root.replaceChildren(
        isSolar(eclipse) ? text : element('div', { class: 'eclipse-head' }, text, moonView.root),
        more,
      );
      root.hidden = false;
    },
  };
}
