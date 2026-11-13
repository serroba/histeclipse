/**
 * The moment shown as a part of the page (#451): the header's date line (the date, the time of
 * day, the calendar and ΔT, each term explained on a tap), deep time's header, and the Sun, the
 * Moon and the planets placed for the moment. Where the observer stands is `observer.ts`.
 */

import type { Globe } from '../../globe/globe';
import type { PartContext } from '../part';
import type { PlanetName } from '../../astro/planets';
import { type MoonEphemeris } from '../../astro/moon';
import { earthFixedToJ2000, sunPositionJ2000 } from '../../astro/precession';
import { subsolarPoint } from '../../astro/sun';
import { geoToVector } from '../../globe/geo';
import { defaultViewState, momentJulianDay, type ViewState } from '../../state/viewState';
import type { DeltaT } from '../../time/deltaT';
import { formatCalendar, formatDate, formatDuration, formatTimeOfDay } from '../../time/format';
import { type JulianDay } from '../../time/julianDay';
import { formatInCalendar } from '../../time/calendars';
import { element } from '../../ui/dom';
import { periodAt, periodWords } from '../../deepTime/periods';
import { formatMa } from '../../time/format';
import type { StoryDate } from '../../deepTime/storyDate';
import { errorMessage } from '../../util/errors';
import './moment.css';

/** What the moment asks of the rest of the page. */
// Where the observer stands and what they see: the page uses these too (#487).
export { bodiesSeen, namedPlace, observerOf, placeName } from './observer';

export interface MomentContext extends PartContext {
  readonly globe: Pick<Globe, 'setSunDirection' | 'setSpace'>;
  /** When the page was opened: "today", where a moment beyond ΔT goes instead. */
  readonly now: Date;
  readonly deltaT: () => DeltaT;
  readonly moon: () => MoonEphemeris | null;
  readonly planetPositions: (
    jdTT: JulianDay,
  ) => Readonly<Record<PlanetName, readonly [number, number, number]>> | null;
  /** The moment shown changed: what is placed by it shows again. */
  atMoment(state: ViewState, terrestrial: JulianDay): void;
  /** The point under the Sun, as the page's data says it for the tests. */
  subsolar(point: string): void;
}

export interface MomentPart {
  /** The date line's parts, in the order the header holds them. */
  readonly dateText: HTMLElement;
  readonly timeText: HTMLElement;
  readonly detailText: HTMLElement;
  readonly termNote: HTMLElement;
  /** Show the moment, the header and what is placed by it. */
  readonly show: (state: ViewState) => void;
  /** The header in deep time, with the date a story lends, if any. */
  readonly deepHeader: (ma: number, story?: StoryDate | null) => void;
  /** The moment last shown, in Terrestrial Time; null before the first. */
  readonly terrestrial: () => JulianDay | null;
}

export function mountMoment(context: MomentContext): MomentPart {
  const { store, globe } = context;
  const dateText = element('time', { class: 'hud-date' });
  const timeText = element('span', {
    class: 'hud-time',
    title: 'UT: Universal Time, the time of day at Greenwich, England',
    tabindex: '0',
  });
  const detailText = element('p', { class: 'hud-detail' });
  // A tap (or Enter) on a term with an explanation shows it here: phones have no hover.
  const termNote = element('p', { class: 'term-note', 'data-testid': 'term-note', hidden: '' });
  // By its text, since the line is rebuilt as time moves.
  let termShown: string | null = null;
  function explain(term: Element): void {
    const text = term.getAttribute('title');
    if (text === null || text === termShown) {
      termShown = null;
      termNote.hidden = true;
      return;
    }
    termShown = text;
    termNote.textContent = text;
    termNote.hidden = false;
  }
  const termOf = (target: EventTarget | null): Element | null =>
    target instanceof Element ? target.closest('.hud-detail abbr[title], .hud-time[title]') : null;
  for (const holder of [timeText, detailText]) {
    holder.addEventListener('click', (event) => {
      const term = termOf(event.target);
      if (term !== null) explain(term);
    });
    holder.addEventListener('keydown', (event) => {
      const term = termOf(event.target);
      if (term !== null && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        explain(term);
      }
    });
  }
  // The moment last shown (TT), for the body bar: it works out only the body in view.
  let bodiesAt: JulianDay | null = null;

  function showTime(state: ViewState): void {
    const universal = momentJulianDay(state.time);
    let terrestrial;
    try {
      terrestrial = context.deltaT().terrestrialTime(universal);
    } catch (error) {
      context.notify(`${errorMessage(error)}. Showing today instead.`);
      store.set({ ...state, time: defaultViewState(context.now).time, selection: null });
      return;
    }
    const sun = subsolarPoint(universal, terrestrial);
    globe.setSunDirection(geoToVector(sun));
    globe.setSpace({
      earthFixedToJ2000: earthFixedToJ2000(universal, terrestrial),
      sunKm: sunPositionJ2000(terrestrial),
      moonKm: context.moon()?.position(terrestrial) ?? null,
      planetsKm: context.planetPositions(terrestrial),
      jdTT: terrestrial,
    });
    bodiesAt = terrestrial;
    context.atMoment(state, terrestrial);
    context.subsolar(`${sun.latitude.toFixed(3)},${sun.longitude.toFixed(3)}`);
    if (state.ma !== null) {
      showDeepTimeText(state.ma);
      return;
    }
    dateText.textContent = formatDate(state.time);
    timeText.textContent = formatTimeOfDay(state.time);
    const seconds = context.deltaT().seconds(universal);
    const uncertainty = context.deltaT().uncertaintySeconds(universal);
    // In another calendar, the same day written its way too (by day, from midnight).
    const other = state.years === 'western' ? '' : ` · ${formatInCalendar(state.years, universal)}`;
    // ΔT is a term few readers know: it explains itself on hover, or on a tap.
    detailText.replaceChildren(
      `${formatCalendar(state.time)}${other} · `,
      element(
        'abbr',
        { title: DELTA_T_MEANING, tabindex: '0' },
        `ΔT ${formatDuration(seconds)} ± ${formatDuration(uncertainty)}`,
      ),
      ' ',
      deltaTWhy,
    );
  }

  // ΔT's book, made once: the date line is written again as time moves.
  const deltaTWhy = context.why('delta-t', 'ΔT');
  const DELTA_T_MEANING =
    'ΔT: how far Earth’s slowing spin has put clock time behind a perfectly even time. It decides where on Earth an ancient eclipse fell; the ± is how uncertain it is.';

  /**
   * The header in deep time: how long ago, and the period by the ICS chart; or, while a story
   * has the globe, the date it lends (#492).
   */
  function showDeepTimeText(ma: number, story: StoryDate | null = null): void {
    const period = periodAt(ma);
    dateText.textContent = story?.when ?? formatMa(ma);
    timeText.textContent = '';
    detailText.textContent = story?.what ?? (period === null ? 'Deep time' : periodWords(period));
  }

  return {
    dateText,
    timeText,
    detailText,
    termNote,
    show: showTime,
    deepHeader: showDeepTimeText,
    terrestrial: () => bodiesAt,
  };
}
