/**
 * Deep time as a part of the page (#445): going into it and out of it, its spans and moment,
 * playing towards the present, its bar and glance, Earth's surface from the elevation maps
 * (which load a few at a time as needed), the magnetic reversals and magnetic north. What its
 * layers and surfaces draw and say, the page gathers for it through the context.
 */

import { deepChoices } from './choices';
import { frameDeepEarth } from './frame';
import { magneticNorthLayer } from './magneticNorthLayer';
import { loadPolarity, type PolarityScale } from '../../data/polarity';
import { magneticNorthAt } from '../../deepTime/earthState';
import {
  type DeepScale,
  EARTH_AGE_MA,
  ICE_AGES_MA,
  LAST_GLACIAL_MAXIMUM_MA,
  roundMa,
  type ViewState,
} from '../../state/viewState';
import { astronomicalYear } from '../../time/year';
import { moveToYear } from '../../time/yearInput';
import { createDeepGlance } from './deepGlance';
import { createDeepTimeBar } from '../../ui/deepTimeBar';
import { periodAt, periodWords } from '../../deepTime/periods';
import { formatMa } from '../../time/format';
import {
  framesAhead,
  framesAround,
  loadPaleoDemIndex,
  oldestMa,
  type PaleoDemIndex,
} from '../../data/paleoDem';
import { HOLOCENE_MA, maOfYear, yearOfMa } from '../../data/iceSheets';
import { DEFAULT_PACE, paceSpeed, prefetchFrames, type Pace } from '../../deepTime/playSpeed';
import { animationLoop } from '../../util/animationLoop';
import { playhead } from '../../deepTime/playhead';
import { PLATES_REACH_MA, sketchAt } from '../../deepTime/sketch';
import { barWindow } from '../../ui/deepBarModel';
import { createSpanSwitch, type Span } from '../../ui/spanSwitch';
import type { DeepTimeContext, DeepTimePart } from './context';
import { errorMessage } from '../../util/errors';
// The elevation maps reach back this far; their index says for certain once loaded.
import { MAPS_REACH_MA } from '../../state/timeAxis';
import { deepAxisWindow, zoomRoom } from '../../state/timeZoom';
import { deepZooming } from './zooming';
import { PRESENT_YEAR } from '../../time/present';

export function mountDeepTime(context: DeepTimeContext): DeepTimePart {
  const { base, fetchJson, store, globe } = context;
  // The eclipse picked before entering deep time, picked again on leaving it.
  let selectionBeforeDeep: ViewState['selection'] = null;
  function leaveDeepTime(): void {
    stopPlay();
    const selection = selectionBeforeDeep;
    selectionBeforeDeep = null;
    store.set((state) => {
      // Within the Holocene's years, the same moment, now as a year; else the year left.
      // (If deep time is still where it was entered, the very date left comes back.)
      const { ma } = state;
      const time =
        ma !== null && ma <= HOLOCENE_MA && ma !== roundMa(maOfYear(state.time.date.year))
          ? moveToYear(state.time, astronomicalYear(yearOfMa(ma)))
          : state.time;
      // Layers stay on: one set for all of time, each drawing on its own spans.
      return { ...state, ma: null, time, selection: state.selection ?? selection };
    });
  }
  /**
   * Picking a span is a fresh start: deep time's spans open at their oldest moment, ready to
   * play forward; the years come back to the date left. (A link with ma= opens where it points.)
   */
  function goToSpan(span: Span): void {
    const { ma } = store.get();
    if (span === 'years') {
      if (ma !== null) leaveDeepTime();
      // The preset is the whole track (#1074).
      if (store.get().yearsWindow !== null) store.set((state) => ({ ...state, yearsWindow: null }));
    } else if (ma === null) {
      enterDeepTime(spanOf(span), span);
      if (span !== 'ice') frameDeepEarth(globe, store.get().camera.distance);
    } else {
      stopPlay();
      context.step();
      store.set((state) => ({
        ...state,
        deepScale: span,
        deepWindow: null,
        ma: roundMa(spanOf(span)),
      }));
    }
  }
  /** Go into deep time at `ma`, on the span that reaches it. */
  function enterDeepTime(ma: number, deepScale?: DeepScale): void {
    selectionBeforeDeep = store.get().selection;
    context.step();
    // Deep time shows the whole Earth: the globe, with no eclipse picked.
    store.set((state) => ({
      ...state,
      ma: roundMa(ma),
      ...(deepScale === undefined ? {} : { deepScale }),
      // A preset or a jump in from the years shows the whole span (#1074).
      deepWindow: null,
      mode: 'globe',
      view: 'free',
      // The Sun, Moon and planets are left out of deep time, so the view centres on Earth.
      focus: 'earth',
      craft: null,
      selection: null,
    }));
  }
  function setScale(deepScale: DeepScale): void {
    stopPlay();
    store.set((state) => {
      const ma = state.ma ?? 0;
      return {
        ...state,
        deepScale,
        deepWindow: null,
        // From further back than the ice ages, open them at the last glacial maximum; from
        // before the elevation maps, the 540 Myr scale opens at their oldest.
        ma:
          deepScale === 'ice' && ma > ICE_AGES_MA
            ? LAST_GLACIAL_MAXIMUM_MA
            : deepScale === 'all' && ma > oldest
              ? oldest
              : state.ma,
      };
    });
  }
  // Zooming the bar (#1074) and fitting it to a unit (#1075), into and out of the years.
  const { zoom, land, fit } = deepZooming({
    store,
    present: PRESENT_YEAR,
    mapsReach: () => oldest,
    shown: (state) => shown(state),
    enter: (ma) => {
      enterDeepTime(ma);
    },
    leave: leaveDeepTime,
    jump: (ma) => {
      stopPlay();
      context.step();
      store.set((state) => ({ ...state, ma }));
    },
  });
  const deepBar = createDeepTimeBar(
    {
      onZoom: zoom,
      onFit: fit,
      why(id, label) {
        return context.why(id, label);
      },
      explain(id) {
        store.set((state) => ({ ...state, why: id }));
      },
      onMa(ma, jump) {
        stopPlay();
        if (jump) context.step();
        store.set((state) => ({ ...state, ma: roundMa(ma) }));
      },
      onPlay(play) {
        if (play) startPlay();
        else stopPlay();
      },
      onPace(picked) {
        pace = picked;
        storySpeed = null;
        showDeepTime(store.get());
      },
      ...deepChoices(store),
      onCo2Archive() {
        context.loadArchive();
      },
    },
    // The chips (#380, #605): the plates', the features', the impacts'.
    context.chips,
  );
  const glance = createDeepGlance(
    (play) => {
      if (play) startPlay();
      else stopPlay();
    },
    (ma) => {
      stopPlay();
      store.set((state) => ({ ...state, ma: roundMa(ma) }));
    },
  );
  // How far back time reaches, one choice for all of it: going deeper is zooming out.
  const historySpan = createSpanSwitch((span) => {
    goToSpan(span);
  });
  const magneticNorthOnGlobe = globe.addLayer(magneticNorthLayer);

  // Deep time: Earth's surface from the elevation maps, which load a few at a time as needed.
  let paleoIndex: Promise<PaleoDemIndex> | null = null;
  // How far back the elevation maps reach, until their index says.
  let oldest = MAPS_REACH_MA;
  let playing = false;
  const playFrames = animationLoop(tick);
  let head = playhead();

  // Every reversal of the last 83 Ma: small, loaded the first time deep time shows.
  let polarity: PolarityScale | null = null;
  let polarityAsked = false;
  function wantPolarity(): void {
    if (polarityAsked) return;
    polarityAsked = true;
    loadPolarity(`${base}data/polarity.json`, fetchJson).then(
      (loaded) => {
        polarity = loaded;
        showDeepTime(store.get());
      },
      (error: unknown) => {
        polarityAsked = false;
        context.notify(`Could not load the magnetic reversals: ${errorMessage(error)}`);
      },
    );
  }

  function showDeepTime(state: ViewState): void {
    const { ma } = state;
    context.marked(ma !== null);
    magneticNorthOnGlobe.update(ma === null ? null : magneticNorthAt(ma, polarity));
    if (ma !== null) wantPolarity();
    if (ma === null) {
      historySpan.render('years', state.yearsWindow === null);
      stopPlay();
      deepBar.render(null);
      glance.render(null);
      globe.setUncharted(false);
      globe.setSketch(null);
      globe.setDeepTime(null);
      globe.setTemperature(null);
      context.off(state);
      return;
    }
    const period = periodAt(ma);
    const story = context.storyDate();
    context.header(ma, story);
    // A link to before the elevation maps opens on the scale that reaches it.
    const scale = state.deepScale === 'all' && ma > oldest ? 'eons' : state.deepScale;
    const part = barWindow(state.deepWindow, spanOf(scale), ma);
    const whole = part.youngest === 0 && part.oldest === spanOf(scale);
    historySpan.render(scale, whole);
    const ice = scale === 'ice';
    const uncharted = ma > oldest;
    globe.setUncharted(uncharted);
    // Before the maps, a sketch of the hypotheses chosen; invented land only beyond the plates.
    const choices = { impact: state.impact, land: state.land, snowball: state.snowball };
    const reconstructed = ma <= (context.platesReach() ?? PLATES_REACH_MA);
    const sketch = uncharted ? sketchAt(ma, choices, reconstructed) : null;
    globe.setSketch(sketch);
    // The layers' fields of the bar, drawing them: the temperature maps ahead as it plays.
    const { temperatureDrawn, ...fields } = context.bar(state, {
      ma,
      scale,
      uncharted,
      maPerSecond: playing ? playSpeed() : null,
    });
    deepBar.render({
      ma,
      story,
      // The part of the span asked for (#1074), while the moment is within it.
      ...part,
      part: !whole,
      mapsReach: oldest,
      period,
      polarity,
      playing,
      pace,
      speed: playSpeed(),
      zoom: zoomRoom(deepAxisWindow(shown(state), PRESENT_YEAR), PRESENT_YEAR),
      scale,
      ...fields,
      sketch: sketch === null ? null : { sketch, choices },
    });
    glance.render({
      when: story?.when ?? formatMa(ma),
      period: story?.what ?? (period === null ? 'Deep time' : periodWords(period)),
      ma,
      oldest: spanOf(scale),
      playing,
      temperature: temperatureDrawn,
    });
    paleoIndex ??= loadPaleoDemIndex(`${base}data/paleodem/index.json`, fetchJson);
    paleoIndex.then(
      (index) => {
        if (oldestMa(index) !== oldest) {
          oldest = oldestMa(index);
          showDeepTime(store.get());
          return;
        }
        if (store.get().ma !== ma) return;
        // On the ice-age scale, today's map: the next is 5 million years back.
        const { younger, older, mix } = framesAround(index.frames, ice ? 0 : ma);
        // Playing, the next maps load ahead, so the globe keeps up with the years.
        if (playing && !ice) {
          globe.prefetch(
            framesAhead(index.frames, ma, prefetchFrames(playSpeed())).map(
              (frame) => `${base}data/paleodem/${frame.file}`,
            ),
          );
        }
        globe.setDeepTime({
          younger: `${base}data/paleodem/${younger.file}`,
          older: `${base}data/paleodem/${older.file}`,
          mix,
          columns: index.columns,
          rows: index.rows,
          seaDepth: index.seaDepth,
          landHeight: index.landHeight,
        });
      },
      (error: unknown) => {
        paleoIndex = null;
        context.notify(`Could not load Earth's past surface: ${errorMessage(error)}`);
      },
    );
  }

  /** How far back each scale's time line reaches, Ma. */
  function spanOf(scale: DeepScale): number {
    if (scale === 'ice') return ICE_AGES_MA;
    return scale === 'eons' ? EARTH_AGE_MA : oldest;
  }

  // The pace picked (#1076), one for all of deep time; a story's own speed until it stops.
  let pace: Pace = DEFAULT_PACE;
  let storySpeed: number | null = null;
  /** How fast deep time plays now, Ma a second: a story's speed, or the pace over the bar shown. */
  function playSpeed(): number {
    const { oldest: from, youngest } = shown(store.get());
    return storySpeed ?? paceSpeed(from - youngest, pace);
  }

  /** The part of the span the bar shows (#1074), as played: from its oldest to its youngest. */
  function shown(state: ViewState): { readonly oldest: number; readonly youngest: number } {
    return barWindow(state.deepWindow, spanOf(state.deepScale), state.ma ?? 0);
  }

  /** Play towards the bar's young end; from there, start again at its oldest. */
  function startPlay(): void {
    if (playing) return;
    playing = true;
    const { oldest, youngest } = shown(store.get());
    if ((store.get().ma ?? 0) <= youngest) store.set((state) => ({ ...state, ma: oldest }));
    head = playhead();
    playFrames.start();
    showDeepTime(store.get());
  }

  function tick(seconds: number): void {
    const ma = store.get().ma;
    if (ma === null) {
      stopPlay();
      return;
    }
    const { youngest } = shown(store.get());
    const next = Math.max(youngest, head.step(ma, playSpeed(), seconds));
    store.set((state) => ({ ...state, ma: next }));
    if (next <= youngest) {
      stopPlay();
      return;
    }
  }

  /** Play from a moment, at one of its span's speeds: a story told by playing (#177). */
  function playFrom(ma: number, deepScale: DeepScale, maPerSecond: number): void {
    stopPlay();
    enterDeepTime(ma, deepScale);
    storySpeed = maPerSecond;
    startPlay();
  }

  function stopPlay(): void {
    if (!playing) return;
    playing = false;
    storySpeed = null;
    playFrames.stop();
    showDeepTime(store.get());
  }

  return {
    bar: deepBar.root,
    docked: () => deepBar.docked(),
    glance: glance.root,
    spanSwitch: historySpan.root,
    show: showDeepTime,
    enterDeepTime,
    playFrom,
    goToSpan,
    land,
    setScale,
    stopPlay,
    playing: () => playing,
    playSpeed,
    oldest: () => oldest,
  };
}
