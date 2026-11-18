/**
 * A gravitational wave passing (#829, epic #834), as a part of the page: while the view names a
 * wave (`wave=gw150914`), it is drawn over the globe, with a stage below (`waveStage.ts`) saying
 * what is shown, where the wave is, and how far the drawing is from the truth. Two chapters:
 * space and its ring of free masses, or LIGO Livingston with what both detectors measured
 * (#831). The 3D view's code and the measured wave (#830) are fetched the first time it opens;
 * the sound is played only when asked for.
 */

import type { Globe } from '../../globe/globe';
import { WAVE_CHAPTERS, type Wave, type WaveChapter } from '../../state/slices/display';
import type { ViewState } from '../../state/viewState';
import type { MarkerCardContent } from '../../ui/markerCard';
import { element } from '../../ui/dom';
import { errorMessage } from '../../util/errors';
import { getJson } from '../../util/fetchJson';
import type { MountedPart, PartContext } from '../part';
import { playTone, toneCurves, type ToneContext } from './chirpSound';
import { GW150914_CARD } from './eventCard';
import { GW150914_SCHEMA, measuredWave, type Gw150914 } from './measured';
import type { Waveform } from './strain';
import { createStrainPlot, type StrainPlot } from './strainPlot';
import { createWaveStage, type WaveStage } from './waveStage';
import type { WaveView, WaveViewOptions } from './waveView';
import './wave.css';

/** What the wave asks of the rest of the page. */
export interface WaveContext extends PartContext {
  readonly globe: Pick<Globe, 'controlShower'>;
  /** Open a card with an event's facts. */
  readonly showCard: (card: MarkerCardContent) => void;
  /** Loads the 3D view: its own chunk, or a stand-in in the tests. */
  readonly loadView?: () => Promise<{
    mountWaveView(host: HTMLElement, options: WaveViewOptions): WaveView;
  }>;
  /** Makes somewhere to play the sound: Web Audio, or a stand-in in the tests. */
  readonly audio?: () => ToneContext;
}

interface Measured {
  readonly data: Gw150914;
  readonly wave: Waveform;
}

/** The measured wave, fetched the first time it is asked for and kept; asked again if it failed. */
function measuredLoader(context: PartContext): () => Promise<Measured> {
  let measured: Promise<Measured> | null = null;
  return () => {
    measured ??= getJson(context.fetchJson, `${context.base}data/gw150914.json`, GW150914_SCHEMA)
      .then((data) => ({ data, wave: measuredWave(data) }))
      .catch((error: unknown) => {
        measured = null;
        throw error;
      });
    return measured;
  };
}

/** The sound, once the wave has loaded: played through a context made for it, then let go. */
function soundOf(context: WaveContext): (wave: Waveform | null) => void {
  const audio = context.audio ?? ((): ToneContext => new AudioContext());
  let stop: (() => void) | null = null;
  return (wave) => {
    if (wave === null) return;
    stop?.();
    try {
      stop = playTone(audio(), toneCurves(wave));
    } catch (error) {
      context.notify(`Could not play the sound: ${errorMessage(error)}`);
    }
  };
}

/** The wave over the globe, or gone: the globe draws nothing under it meanwhile. */
function cover(
  on: boolean,
  shown: readonly HTMLElement[],
  globe: Pick<Globe, 'controlShower'>,
): void {
  for (const element of shown) element.hidden = !on;
  document.documentElement.classList.toggle('is-explaining', on);
  globe.controlShower(on ? 'cover' : 'uncover');
}

/** Earth's map, for the journey: the one the globe's story scenes use. */
const EARTH_MAP = 'textures/earth-blue-marble-2048.jpg';

/** How the view is told to draw the measured wave, and tells the stage where it is; at the
 * end of each chapter the story goes on by itself, unless the reader asked for less motion. */
function viewOptions(
  stage: Pick<WaveStage, 'root' | 'moment'>,
  loaded: Measured,
  start: { readonly chapter: WaveChapter; readonly stillness: boolean; readonly base: string },
  story: { readonly plot: () => StrainPlot | null; readonly step: (direction: 1) => void },
): WaveViewOptions {
  return {
    wave: loaded.wave,
    chapter: start.chapter,
    stillness: start.stillness,
    earthMap: `${start.base}${EARTH_MAP}`,
    atLivingston: loaded.data.merger,
    onChapterEnd: () => {
      if (!start.stillness) story.step(1);
    },
    covered: () => stage.root.offsetHeight + 24,
    onMoment: (text) => {
      stage.moment.textContent = text;
    },
    onTime: (t) => {
      story.plot()?.setTime(loaded.data.merger + t);
    },
  };
}

/** What the stage's controls do, given the session's view and wave as they are when used. */
function stageFor(
  context: WaveContext,
  session: {
    readonly view: () => WaveView | null;
    readonly wave: () => Waveform | null;
    readonly close: () => void;
    readonly still: () => boolean;
    /** Show a chapter: the view follows, as the link does. */
    readonly goTo: (chapter: WaveChapter) => void;
    readonly step: (direction: -1 | 1) => void;
  },
): WaveStage {
  const hear = soundOf(context);
  const stage = createWaveStage(context.why('gravitationalWaves', 'Gravitational waves'), {
    onPlay: (playing) => {
      session.view()?.setPlaying(playing);
    },
    restart: () => {
      session.view()?.restart();
      if (session.still()) return;
      stage.play.set(true);
      session.view()?.setPlaying(true);
    },
    close: session.close,
    about: () => {
      context.showCard({
        ...GW150914_CARD,
        action: {
          label: 'Play the story from its start',
          run: () => {
            session.goTo('source');
            session.view()?.restart();
          },
        },
      });
    },
    chapter: session.goTo,
    step: session.step,
    hear: () => {
      hear(session.wave());
    },
  });
  return stage;
}

/** The story's chapters: the one shown, and going to another as the link does. */
function storyChapters(store: PartContext['store']): {
  now: WaveChapter;
  readonly goTo: (chapter: WaveChapter) => void;
  readonly step: (direction: -1 | 1) => void;
} {
  const chapters = {
    now: 'source' as WaveChapter,
    goTo: (next: WaveChapter): void => {
      store.set((state) => ({ ...state, waveChapter: next }));
    },
    step: (direction: -1 | 1): void => {
      const next = WAVE_CHAPTERS[WAVE_CHAPTERS.indexOf(chapters.now) + direction];
      if (next !== undefined) chapters.goTo(next);
    },
  };
  return chapters;
}

export function mountWave(context: WaveContext): MountedPart {
  const { store, globe } = context;
  const loadView = context.loadView ?? (() => import('./waveView'));
  const loadMeasured = measuredLoader(context);
  const container = element('div', { class: 'wave-3d', 'data-testid': 'wave-3d', hidden: '' });
  const close = (): void => {
    store.set((state) => ({ ...state, wave: null }));
  };
  const still = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let view: WaveView | null = null;
  let measured: Measured | null = null;
  let plot: StrainPlot | null = null;
  /** The wave open, or being opened; null when closed. */
  let shown: Wave | null = null;
  const chapters = storyChapters(store);
  const stage = stageFor(context, {
    view: () => view,
    wave: () => measured?.wave ?? null,
    close,
    still,
    goTo: chapters.goTo,
    step: chapters.step,
  });

  function opened(loaded: Measured, made: WaveView): void {
    view = made;
    measured = loaded;
    plot ??= createStrainPlot(loaded.data);
    stage.setPlot(plot.root);
  }

  function open(wave: Wave, first: WaveChapter): void {
    shown = wave;
    chapters.now = first;
    cover(true, [container, stage.root], globe);
    const stillness = still();
    stage.play.button.hidden = stillness;
    stage.play.set(!stillness);
    stage.showChapter(first);
    stage.moment.textContent = '';
    Promise.all([loadView(), loadMeasured()])
      .then(([code, loaded]) => {
        if (shown !== wave || view !== null) return;
        const start = { chapter: first, stillness, base: context.base };
        const story = { plot: () => plot, step: chapters.step };
        opened(loaded, code.mountWaveView(container, viewOptions(stage, loaded, start, story)));
      })
      .catch((error: unknown) => {
        context.notify(`Could not draw the wave: ${errorMessage(error)}`);
        close();
      });
  }

  function turnTo(chapter: WaveChapter): void {
    chapters.now = chapter;
    stage.showChapter(chapter);
    view?.setChapter(chapter);
  }

  function shut(): void {
    shown = null;
    view?.dispose();
    view = null;
    cover(false, [container, stage.root], globe);
  }

  return {
    watches: (state) => [state.wave, state.waveChapter],
    elements: [container, stage.root],
    render(state: ViewState) {
      if (state.wave === shown) {
        if (shown !== null && state.waveChapter !== chapters.now) turnTo(state.waveChapter);
        return;
      }
      if (shown !== null) shut();
      if (state.wave !== null) open(state.wave, state.waveChapter);
    },
  };
}
