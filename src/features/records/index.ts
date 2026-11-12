/**
 * A tablet's records checked against the sky (#447): the check of VAT 4956, run in the
 * Babylonian calendar, and a record looked at in the sky from Babylon, its bodies pointed out
 * until the view leaves Babylon's sky. The Moon, the planets and the stars it needs load the
 * first time a tablet is checked.
 */

import { loadMoonEphemeris, type MoonEphemeris } from '../../astro/moon';
import type { PlanetEphemeris } from '../../astro/planets';
import { loadSky } from '../../data/sky';
import { horizonMatrix, horizontalOf } from '../../sky/horizon';
import { LOWEST_LOOK, roundLook } from '../../sky/look';
import type { SkyMark } from '../../sky/skyScene';
import { momentAt } from '../../eclipses/describe';
import { momentJulianDay, type ViewState } from '../../state/viewState';
import { candidateYear, checkAll, type Verdict, verdictMoment } from './check';
import { BABYLON, directionOf, starsByNumber, type TabletSky } from '../../tablets/tabletSky';
import { bodyName, computedText, recordBodies } from './verdictText';
import { VAT_4956 } from './vat4956';
import { julianDayNumber, type JulianDay } from '../../time/julianDay';
import { element } from '../../ui/dom';
import { createTabletPanel } from './tabletPanel';
import type { PartContext } from '../part';
import './records.css';

/** The sky's field of view, degrees, when it turns to a record's body. */
const RECORD_FOV = 40;

/** What the records ask of the rest of the page. */
export interface RecordsContext extends PartContext {
  /** The Moon's ephemeris, if it has loaded. */
  moon(): MoonEphemeris | null;
  loadPlanets(): Promise<PlanetEphemeris>;
  /** ΔT at a moment, seconds. */
  deltaTSeconds(jdUT: JulianDay): number;
  /** Point out bodies in the sky, or none. */
  setSkyMarks(marks: readonly SkyMark[]): void;
}

export interface RecordsPart {
  /** Opens the tablet's check; shown in the Babylonian calendar. */
  readonly button: HTMLElement;
  readonly dialog: HTMLElement;
  /** The record being looked at: what it says, whether it fits, and the way back. */
  readonly banner: HTMLElement;
  readonly open: () => void;
  /** The bodies the record names, where they stand from Babylon at the moment shown; none once the view leaves Babylon's sky. */
  readonly marks: (state: ViewState) => readonly SkyMark[];
  readonly render: (state: ViewState) => void;
}

export function mountRecords(context: RecordsContext): RecordsPart {
  const { base, fetchJson, store } = context;
  let tabletSkyLoading: Promise<TabletSky> | null = null;
  function tabletSky(): Promise<TabletSky> {
    const moon = context.moon();
    tabletSkyLoading ??= Promise.all([
      moon === null ? loadMoonEphemeris() : Promise.resolve(moon),
      context.loadPlanets(),
      loadSky(`${base}data/sky.json`, fetchJson),
    ]).then(([loadedMoon, planets, catalogue]) => ({
      moon: loadedMoon,
      planets,
      stars: starsByNumber(catalogue.stars),
      deltaT: (jd) => context.deltaTSeconds(jd),
      place: BABYLON,
    }));
    tabletSkyLoading.catch(() => {
      tabletSkyLoading = null;
    });
    return tabletSkyLoading;
  }

  const panel = createTabletPanel({
    async check(bce, shift) {
      const sky = await tabletSky();
      const candidate = candidateYear(bce, shift);
      if (candidate === null) {
        throw new Error(`No Babylonian months are computed for ${String(bce)} BCE.`);
      }
      // Let "Computing the sky…" show before the work starts.
      await new Promise((resolve) => setTimeout(resolve, 0));
      return checkAll(sky, VAT_4956, candidate);
    },
    go(verdict) {
      void goTo(verdict);
    },
  });

  const text = element('span', { class: 'tablet-record-text' });
  const mark = element('span', { class: 'tablet-mark' });
  const back = element(
    'button',
    { type: 'button', class: 'tablet-record-back' },
    'Back to the tablet',
  );
  const close = element(
    'button',
    { type: 'button', class: 'tablet-record-close', 'aria-label': 'Stop pointing out the record' },
    '×',
  );
  const banner = element(
    'div',
    { class: 'tablet-record', 'data-testid': 'tablet-record', hidden: '' },
    element('p', {}, text, ' ', mark),
    element('div', { class: 'tablet-record-actions' }, back, close),
  );

  // The record shown in the sky, with its bodies pointed out.
  let shown: { readonly verdict: Verdict; readonly sky: TabletSky } | null = null;
  back.addEventListener('click', () => {
    const id = shown?.verdict.observation.id;
    panel.open();
    if (id !== undefined) {
      const row = panel.dialog.querySelector<HTMLElement>(`[data-record="${id}"]`);
      row?.scrollIntoView({ block: 'center' });
      row?.focus();
    }
  });
  close.addEventListener('click', () => {
    clear();
  });

  function clear(): void {
    shown = null;
    banner.hidden = true;
    context.setSkyMarks([]);
  }

  /** Stand in Babylon at the moment of a tablet's record, facing what it describes. */
  async function goTo(verdict: Verdict): Promise<void> {
    const sky = await tabletSky();
    const moment = verdictMoment(sky, verdict);
    if (moment === null) return;
    const { observation } = verdict;
    shown = { verdict, sky };
    text.textContent = `${observation.line}: ${observation.text}`;
    mark.className = `tablet-mark ${verdict.fits ? 'fits' : 'misses'}`;
    mark.textContent = verdict.fits
      ? `✓ fits: computed ${computedText(verdict)}`
      : `✗ does not fit: computed ${computedText(verdict)}`;
    banner.hidden = false;
    const body = observation.kind === 'position' ? observation.body : 'moon';
    const jdTT = julianDayNumber(moment + context.deltaTSeconds(moment) / 86_400);
    const { azimuth, altitude } = horizontalOf(
      horizonMatrix(BABYLON, moment, jdTT),
      directionOf(sky, body, moment),
    );
    store.set((state) => ({
      ...state,
      mode: 'sky',
      ma: null,
      years: 'babylonian',
      location: BABYLON,
      time: momentAt(moment),
      // Aim at the body: the sky centres it in the space the panels leave.
      look: roundLook({ azimuth, altitude: Math.max(LOWEST_LOOK, altitude), fov: RECORD_FOV }),
    }));
  }

  return {
    button: panel.button,
    dialog: panel.dialog,
    banner,
    open: () => {
      panel.open();
    },
    marks(state) {
      const atBabylon =
        state.location !== null &&
        state.location.latitude === BABYLON.latitude &&
        state.location.longitude === BABYLON.longitude;
      if (shown !== null && (state.mode !== 'sky' || !atBabylon)) clear();
      if (shown === null) return [];
      const { sky, verdict } = shown;
      const jdUT = momentJulianDay(state.time);
      const jdTT = julianDayNumber(jdUT + context.deltaTSeconds(jdUT) / 86_400);
      const horizon = horizonMatrix(BABYLON, jdUT, jdTT);
      return recordBodies(verdict.observation).map((body) => ({
        name: bodyName(body),
        ...horizontalOf(horizon, directionOf(sky, body, jdUT)),
      }));
    },
    render(state) {
      // Tablets are dated in the Babylonian calendar: their check shows with it.
      panel.button.hidden = state.years !== 'babylonian';
    },
  };
}
