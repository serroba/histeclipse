/**
 * Deep time as a part of the page (#445): going into it and out of it, its spans and moment,
 * playing towards the present, its bar and glance, Earth's surface from the elevation maps
 * (which load a few at a time as needed), the magnetic reversals and magnetic north. What its
 * layers and surfaces draw and say, the page gathers for it through the context.
 */

import { deepChoices } from './choices';
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
import { formatMa, periodAt, periodWords } from '../../deepTime/periods';
import {
  framesAhead,
  framesAround,
  loadPaleoDemIndex,
  oldestMa,
  type PaleoDemIndex,
} from '../../data/paleoDem';
import { HOLOCENE_MA, maOfYear, yearOfMa } from '../../data/iceSheets';
import { deepSpeedFor, prefetchFrames } from '../../deepTime/playSpeed';
import { playhead } from '../../deepTime/playhead';
import { PLATES_REACH_MA, sketchAt } from '../../deepTime/sketch';
import { createSpanSwitch, type Span } from '../../ui/spanSwitch';
import type { DeepTimeContext, DeepTimePart } from './context';
import { errorMessage } from '../../util/errors';

/** The elevation maps reach back this far (their index says for certain once loaded). */
const MAPS_REACH_MA = 540;

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
    } else if (ma === null) {
      enterDeepTime(spanOf(span), span);
    } else {
      stopPlay();
      context.step();
      store.set((state) => ({ ...state, deepScale: span, ma: roundMa(spanOf(span)) }));
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
      mode: 'globe',
      view: 'free',
      // The Sun, Moon and planets are left out of deep time, so the view centres on Earth.
      focus: 'earth',
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
  const deepBar = createDeepTimeBar(
    {
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
      onSpeed(maPerSecond) {
        deepSpeeds = { ...deepSpeeds, [store.get().deepScale]: maPerSecond };
        showDeepTime(store.get());
      },
      ...deepChoices(store),
      onCo2Archive() {
        context.loadArchive();
      },
      onImpactsMode(mode) {
        context.impactsMode(mode);
        showDeepTime(store.get());
      },
    },
    // The features' chips (#380), where the fossils' chip stood.
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
  // How far back time reaches, one choice for all of it: going deeper is zooming out, to the
  // same moment.
  const historySpan = createSpanSwitch((span) => {
    goToSpan(span);
  });
  const magneticNorthOnGlobe = globe.addLayer(magneticNorthLayer);

  // Deep time: Earth's surface from the elevation maps, which load a few at a time as needed.
  let paleoIndex: Promise<PaleoDemIndex> | null = null;
  // How far back the elevation maps reach, until their index says.
  let oldest = MAPS_REACH_MA;
  let playing = false;
  let playFrame = 0;
  let lastTick = 0;
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
      historySpan.render('years');
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
    context.header(ma);
    // A link to before the elevation maps opens on the scale that reaches it.
    const scale = state.deepScale === 'all' && ma > oldest ? 'eons' : state.deepScale;
    historySpan.render(scale);
    const ice = scale === 'ice';
    // Before the elevation maps reach, no map: a sketch of the chosen hypotheses instead.
    const uncharted = ma > oldest;
    globe.setUncharted(uncharted);
    // Before the maps, a sketch of the hypotheses chosen; invented land only beyond the plates.
    const choices = { impact: state.impact, land: state.land, snowball: state.snowball };
    const reconstructed = ma <= (context.platesReach() ?? PLATES_REACH_MA);
    const sketch = uncharted ? sketchAt(ma, choices, reconstructed) : null;
    globe.setSketch(sketch);
    deepBar.render({
      ma,
      oldest: spanOf(scale),
      mapsReach: oldest,
      period,
      polarity,
      playing,
      speed: deepSpeedFor(state.deepScale, deepSpeeds[state.deepScale]),
      scale,
      ...context.bar(state, { ma, scale }),
      temperature: context.temperature.view(state, { ma, ice, uncharted }),
      sketch: sketch === null ? null : { sketch, choices },
    });
    glance.render({
      when: formatMa(ma),
      period: period === null ? 'Deep time' : periodWords(period),
      ma,
      oldest: spanOf(scale),
      playing,
      temperature: context.temperature.drawn(state, { ma, ice, uncharted }),
    });
    context.temperature.show(state, { ma, ice, uncharted }, playing ? playSpeed() : null);
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

  // The speed picked for each span, this visit; each starts at its own default.
  let deepSpeeds: Partial<Record<DeepScale, number>> = {};
  /** How fast deep time plays now, millions of years a second, by the span shown. */
  function playSpeed(): number {
    const { deepScale } = store.get();
    return deepSpeedFor(deepScale, deepSpeeds[deepScale]);
  }

  /** Play towards the present; from today, start again at the oldest map. */
  function startPlay(): void {
    if (playing) return;
    playing = true;
    if ((store.get().ma ?? 0) <= 0) {
      store.set((state) => ({ ...state, ma: spanOf(state.deepScale) }));
    }
    lastTick = performance.now();
    head = playhead();
    playFrame = requestAnimationFrame(tick);
    showDeepTime(store.get());
  }

  function tick(now: number): void {
    const seconds = (now - lastTick) / 1000;
    lastTick = now;
    const ma = store.get().ma;
    if (ma === null) {
      stopPlay();
      return;
    }
    const next = head.step(ma, playSpeed(), seconds);
    store.set((state) => ({ ...state, ma: next }));
    if (next <= 0) {
      stopPlay();
      return;
    }
    playFrame = requestAnimationFrame(tick);
  }

  function stopPlay(): void {
    if (!playing) return;
    playing = false;
    cancelAnimationFrame(playFrame);
    showDeepTime(store.get());
  }

  return {
    bar: deepBar.root,
    glance: glance.root,
    spanSwitch: historySpan.root,
    show: showDeepTime,
    enterDeepTime,
    goToSpan,
    setScale,
    stopPlay,
    playing: () => playing,
    playSpeed,
    oldest: () => oldest,
  };
}
