import { animationLoop } from '../../util/animationLoop';
/**
 * The years as a part of the page (#446): the Holocene's track, back as far as ΔT reaches, its
 * ages under the slider; playing them by, with the travel view; and carbon-14 in the air under
 * the slider, with the eruptions the ice cores record, loaded once the layer is on.
 */

import type { Globe } from '../../globe/globe';
import type { DatingCard } from '../../ui/datingCard';
import type { PartContext } from '../part';
import { loadRadiocarbon, type Radiocarbon } from '../../data/radiocarbon';
import { eruptionsBetween, loadEruptions, type Eruptions } from '../../data/eruptions';
import { RADIOCARBON_EVENTS } from '../../data/radiocarbonEvents';
import { createRadiocarbonStrip } from './radiocarbonStrip';
import { type Layer, type ViewState } from '../../state/viewState';
import { astronomicalYear, formatYear } from '../../time/year';
import { moveToYear } from '../../time/yearInput';
import { blankText, createHistoryTrack, trackNote } from '../../ui/historyTrack';
import { yearPlayhead } from '../../time/yearPlay';
import type { PlaySpeed, SpeedLevel } from '../../time/playSpeeds';
import type { Moment } from '../../time/moment';
import { windowOf } from '../../state/yearsWindow';
import { travelTrip, tripTurn } from './travelTrip';
import { travelBrings, windowing } from './windowing';
import { yearOfMa } from '../../data/iceSheets';
import { PRESENT_YEAR } from '../../time/present';
import { createPeriodBands } from '../../ui/periodBands';
import { yearTicks } from './yearTicks';
import { errorMessage } from '../../util/errors';

/** What the years ask of the rest of the page. */
export interface YearsContext extends PartContext {
  readonly globe: Pick<Globe, 'setEvenLight' | 'flyTo'>;
  /** The card that carries a date across a curve. */
  readonly datingCard: Pick<DatingCard, 'open'>;
  /** The first year ΔT reaches. */
  /** The travel view came or went: what rests while travelling shows again. */
  travelChanged(state: ViewState): void;
  /** What the borders last said changed: nothing until they change. */
  statesSaid(): string;
  /** What the Holocene's Earth shows, while it shows. */
  holoceneText(): string | null;
}

export interface YearsPart {
  readonly track: { readonly root: HTMLElement; readonly extras: HTMLElement };
  /** The track, the bands and the strip, as the view has them. */
  readonly show: (state: ViewState) => void;
  readonly stop: () => void;
  /** The travel view, on or off. */
  readonly setTravel: (open: boolean) => void;
  /** Whether the reader is travelling through the years. */
  readonly travelling: () => boolean;
  /** The calibration curves, loaded once. */
  readonly curves: () => Promise<Radiocarbon>;
  /** Deep time, or an eclipse picked, ends a trip through the years. */
  readonly settle: (state: ViewState) => void;
}

export function mountYears(context: YearsContext): YearsPart {
  const { base, fetchJson, store } = context;
  // The Holocene track, as far back as ΔT reaches; the speed picked, until then the years' own
  // (#984); where Play went back to, said while it plays (#982).
  let historySpeed: SpeedLevel | null = null;
  let historyPlaying = false;
  let playedFrom: { first: number; last: number; present: number } | null = null;
  const historyFrames = animationLoop(tickHistory, 0.08);
  let historyHead = yearPlayhead();
  // The Holocene's ages under its slider; a tap goes to an age's start.
  const historyBands = createPeriodBands(
    (ma) => {
      stopHistory();
      setYear(Math.max(historyFirst(), yearOfMa(ma)));
    },
    // In the years, a moment is its year (the ends without the CE everyone assumes); the
    // round marks are every other millennium.
    {
      words: (ma) => formatYear(astronomicalYear(yearOfMa(ma))),
      short: (ma) => formatYear(astronomicalYear(yearOfMa(ma))).replace(/ CE$/, ''),
      marks: yearTicks,
    },
  );
  const radiocarbonStrip = createRadiocarbonStrip(
    context.why('radiocarbon', 'Carbon-14 in the air'),
    (curve, name) => {
      context.datingCard.open(curve, name);
    },
  );
  const historyTrack = createHistoryTrack(
    {
      onYear(year) {
        stopHistory();
        setYear(year);
      },
      onPlay(play) {
        if (play) startHistory();
        else stopHistory();
      },
      onSpeed(speed) {
        historySpeed = speed;
        showHistory(store.get());
      },
      onEndTravel() {
        stopHistory();
        setTravel(false);
      },
      onWindow(value) {
        window.set(windowOf(value));
      },
    },
    historyBands.root,
    radiocarbonStrip.root,
  );
  let radiocarbon: Radiocarbon | null = null;
  let radiocarbonAsked = false;
  // The eruptions the ice cores record (HolVol), under the curve; loaded with it.
  let eruptions: Eruptions | null = null;
  let eruptionsAsked = false;
  /** The strip, for the years shown, from the curve of the hemisphere one stands in. */
  function showRadiocarbon(state: ViewState): void {
    const on = state.layers.has('radiocarbon') && state.mode === 'globe' && state.ma === null;
    if (!on) {
      radiocarbonStrip.render(null);
      return;
    }
    if (radiocarbon === null) {
      radiocarbonStrip.render(null);
      if (radiocarbonAsked) return;
      radiocarbonAsked = true;
      loadRadiocarbon(`${base}data/radiocarbon.json`, fetchJson).then(
        (loaded) => {
          radiocarbon = loaded;
          showRadiocarbon(store.get());
        },
        (error: unknown) => {
          radiocarbonAsked = false;
          context.notify(`Could not load the radiocarbon curves: ${errorMessage(error)}`);
        },
      );
      return;
    }
    if (eruptions === null && !eruptionsAsked) {
      eruptionsAsked = true;
      loadEruptions(`${base}data/eruptions.json`, fetchJson).then(
        (loaded) => {
          eruptions = loaded;
          showRadiocarbon(store.get());
        },
        (error: unknown) => {
          eruptionsAsked = false;
          context.notify(`Could not load the eruptions: ${errorMessage(error)}`);
        },
      );
    }
    const south = (state.location?.latitude ?? 1) < 0;
    const { first, last } = window.shown(state);
    radiocarbonStrip.render({
      curve: south ? radiocarbon.curves.shcal20 : radiocarbon.curves.intcal20,
      name: south ? 'SHCal20' : 'IntCal20',
      first,
      last,
      events: RADIOCARBON_EVENTS,
      eruptions: eruptions === null ? null : eruptionsBetween(eruptions, first, last),
    });
  }
  /**
   * The travel view, on as the years play and until the reader leaves it: even light, states
   * and ways of life, the year's ice and sea; markers of single finds and events resting.
   */
  function setTravel(open: boolean): void {
    if (open === travelling) return;
    travelling = open;
    context.globe.setEvenLight(open);
    // The trip is about peoples and states: their borders, and how people lived where no
    // state is drawn, come on with it, and go with it if it brought them.
    // Said the first time; one the reader turns off stays off (#983).
    const { bring, note } = open ? trip.open(store.get().layers) : { bring: [], note: null };
    const taken = new Set<Layer>(open ? [] : trip.close());
    // It stays in ⓘ for the trip; on a phone it is said only there, not over the globe (#1050).
    tripNote = note;
    if (note !== null && !globalThis.matchMedia('(max-width: 600px)').matches) context.notify(note);
    if (bring.length > 0 || taken.size > 0) {
      store.set((state) => ({
        ...state,
        layers: new Set([...state.layers, ...bring].filter((layer) => !taken.has(layer))),
      }));
    }
    const now = store.get();
    context.travelChanged(now);
    showHistory(now);
  }
  // While the track is open, the globe is lit evenly and the markers of single finds and
  // events rest: at years a second they flicker past without meaning.
  let travelling = false;
  let tripNote: string | null = null;
  const [trip, turn] = [travelTrip(), tripTurn(context.globe)];

  function historyFirst(): number {
    return Math.ceil(context.deltaT().firstYear) + 1;
  }

  // The years the bar shows (#749), and the fit when a layer with a span is turned on.
  const window = windowing(store, () => ({ first: historyFirst(), last: PRESENT_YEAR }));

  function setTime(time: Moment): void {
    store.set((state) => ({ ...state, time, selection: null }));
  }

  function speedsShown(state: ViewState): { speeds: PlaySpeed[]; speed: SpeedLevel } {
    const { speeds, speed } = window.speeds(state, historySpeed);
    return { speeds, speed: speed.level };
  }

  function setYear(year: number): void {
    store.set((state) => ({
      ...state,
      time: moveToYear(state.time, astronomicalYear(year)),
      selection: null,
    }));
  }

  function startHistory(): void {
    const from = window.start(store.get());
    playedFrom = from && { ...window.shown(store.get()), present: PRESENT_YEAR };
    if (from !== null) setTime(from);
    turn.start(playedFrom?.first === historyFirst());
    historyPlaying = true;
    setTravel(true);
    historyHead = yearPlayhead();
    historyFrames.start();
    showHistory(store.get());
  }

  // A new year at most every 80 ms: the scheduler accumulates time between updates.
  function tickHistory(seconds: number): void {
    const { time, done } = window.step(store.get(), historySpeed, seconds, historyHead);
    if (time !== null) setTime(time);
    if (done) stopHistory();
  }

  function stopHistory(): void {
    if (!historyPlaying) return;
    historyPlaying = false;
    historyFrames.stop();
    showHistory(store.get());
  }

  function showHistory(state: ViewState): void {
    if (travelling) trip.seen(state.layers);
    window.fitNew(state, historyPlaying);
    const shown = window.shown(state);
    showRadiocarbon(state);
    // Unclamped: the years run past 1950, where deep time's present stops.
    const maOf = (year: number): number => (1950 - year) / 1e6;
    historyBands.render({
      oldest: maOf(shown.first),
      ma: maOf(state.time.date.year),
      youngest: maOf(shown.last),
      playing: historyPlaying,
    });
    historyTrack.render({
      year: state.time.date.year,
      first: shown.first,
      last: shown.last,
      playing: historyPlaying,
      travelling,
      ...speedsShown(state),
      ...window.choices(state),
      changes: trackNote({
        empires: state.layers.has('empires'),
        said: context.statesSaid(),
        travelling,
        brings: travelBrings(state.layers).length > 0,
        from: historyPlaying ? playedFrom : null,
      }),
      blank: state.layers.has('empires') ? blankText(state.layers.has('ways')) : null,
      earth: context.holoceneText(),
      brought: travelling ? tripNote : null,
    });
  }

  /** The curves, for carrying a date across one: loaded once, with or without their layer. */
  function radiocarbonCurves(): Promise<Radiocarbon> {
    return radiocarbon === null
      ? loadRadiocarbon(`${base}data/radiocarbon.json`, fetchJson).then((loaded) => {
          radiocarbon = loaded;
          return loaded;
        })
      : Promise.resolve(radiocarbon);
  }

  return {
    track: historyTrack,
    show: showHistory,
    stop: stopHistory,
    setTravel,
    travelling: () => travelling,
    curves: radiocarbonCurves,
    settle(state) {
      if (state.ma === null && state.selection === null) return;
      stopHistory();
      setTravel(false);
    },
  };
}
