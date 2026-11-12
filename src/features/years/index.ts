/**
 * The years as a part of the page (#446): the Holocene's track, from as far back as ΔT reaches
 * to the present, with its ages under the slider; playing the years by, and the travel view
 * that comes with it; and carbon-14 in the air under the slider, with the eruptions the ice
 * cores record, loaded once the layer is on.
 */

import type { Globe } from '../../globe/scene';
import type { DatingCard } from '../../ui/datingCard';
import type { PartContext } from '../part';
import { loadRadiocarbon, type Radiocarbon } from '../../data/radiocarbon';
import { eruptionsBetween, loadEruptions, type Eruptions } from '../../data/eruptions';
import { RADIOCARBON_EVENTS } from '../../data/radiocarbonEvents';
import { createRadiocarbonStrip } from '../../ui/radiocarbonStrip';
import { type Layer, type ViewState } from '../../state/viewState';
import { astronomicalYear, formatYear } from '../../time/year';
import { moveToYear } from '../../time/yearInput';
import { blankText, createHistoryTrack, STATES_HINT, STATES_WAIT } from '../../ui/historyTrack';
import { yearPlayhead, type YearSpeed } from '../../time/yearPlay';
import { yearOfMa } from '../../data/iceSheets';
import { PRESENT_YEAR } from '../../time/present';
import { createPeriodBands, yearTicks } from '../../ui/periodBands';
import { errorMessage } from '../../util/errors';

/** What the years ask of the rest of the page. */
export interface YearsContext extends PartContext {
  readonly globe: Pick<Globe, 'setEvenLight'>;
  /** The card that carries a date across a curve. */
  readonly datingCard: Pick<DatingCard, 'open'>;
  /** The first year ΔT reaches. */
  firstYear(): number;
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
  // The Holocene track: the years played by, from as far back as ΔT reaches to the present.
  let historySpeed: YearSpeed = 50;
  let historyPlaying = false;
  let historyFrame = 0;
  let historyTick = 0;
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
    const first = historyFirst();
    radiocarbonStrip.render({
      curve: south ? radiocarbon.curves.shcal20 : radiocarbon.curves.intcal20,
      name: south ? 'SHCal20' : 'IntCal20',
      first,
      last: PRESENT_YEAR,
      events: RADIOCARBON_EVENTS,
      eruptions: eruptions === null ? null : eruptionsBetween(eruptions, first, PRESENT_YEAR),
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
    const { layers } = store.get();
    if (open) {
      travelBrought = TRAVEL_LAYERS.filter((layer) => !layers.has(layer));
      if (travelBrought.length > 0) {
        store.set((state) => ({
          ...state,
          layers: new Set([...state.layers, ...travelBrought]),
        }));
      }
    } else if (travelBrought.length > 0) {
      const brought = new Set<Layer>(travelBrought);
      travelBrought = [];
      store.set((state) => ({
        ...state,
        layers: new Set([...state.layers].filter((layer) => !brought.has(layer))),
      }));
    }
    const now = store.get();
    context.travelChanged(now);
    showHistory(now);
  }
  // While the track is open, the globe is lit evenly and the markers of single finds and
  // events rest: at years a second they flicker past without meaning.
  let travelling = false;
  const TRAVEL_LAYERS: readonly Layer[] = ['empires', 'ways'];
  let travelBrought: readonly Layer[] = [];

  function historyFirst(): number {
    return Math.ceil(context.firstYear()) + 1;
  }

  function setYear(year: number): void {
    store.set((state) => ({
      ...state,
      time: moveToYear(state.time, astronomicalYear(year)),
      selection: null,
    }));
  }

  function startHistory(): void {
    if (store.get().time.date.year >= PRESENT_YEAR) setYear(historyFirst());
    historyPlaying = true;
    setTravel(true);
    historyHead = yearPlayhead();
    historyTick = performance.now();
    historyFrame = requestAnimationFrame(tickHistory);
    showHistory(store.get());
  }

  // A new year at most every 80 ms: each brings its eclipses and borders to load.
  const HISTORY_STEP_SECONDS = 0.08;
  function tickHistory(now: number): void {
    if (!historyPlaying) return;
    const seconds = (now - historyTick) / 1000;
    if (seconds >= HISTORY_STEP_SECONDS) {
      historyTick = now;
      const year = store.get().time.date.year;
      const next = historyHead.step(year, historySpeed, seconds, PRESENT_YEAR);
      if (next !== year) setYear(next);
      if (next >= PRESENT_YEAR) {
        stopHistory();
        return;
      }
    }
    historyFrame = requestAnimationFrame(tickHistory);
  }

  function stopHistory(): void {
    if (!historyPlaying) return;
    historyPlaying = false;
    cancelAnimationFrame(historyFrame);
    showHistory(store.get());
  }

  function showHistory(state: ViewState): void {
    showRadiocarbon(state);
    // Unclamped: the years run past 1950, where deep time's present stops.
    const maOf = (year: number): number => (1950 - year) / 1e6;
    historyBands.render({
      oldest: maOf(historyFirst()),
      ma: maOf(state.time.date.year),
      youngest: maOf(PRESENT_YEAR),
      playing: historyPlaying,
    });
    historyTrack.render({
      year: state.time.date.year,
      first: historyFirst(),
      last: PRESENT_YEAR,
      playing: historyPlaying,
      travelling,
      speed: historySpeed,
      // What changed whenever states are on; while travelling, what to expect until then.
      changes: state.layers.has('empires')
        ? context.statesSaid() === '' && travelling
          ? STATES_WAIT
          : context.statesSaid()
        : travelling
          ? STATES_HINT
          : '',
      blank: state.layers.has('empires') ? blankText(state.layers.has('ways')) : null,
      earth: context.holoceneText(),
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
