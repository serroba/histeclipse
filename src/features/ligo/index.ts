/**
 * A gravitational wave passing (#829, epic #834; #990, epic #994), as a part of the page: while
 * the view names a wave (`wave=gw150914`, or `wave=gw170817`), it is drawn over the globe, with a stage below (`waveStage.ts`) saying
 * what is shown, where the wave is, and how far the drawing is from the truth. Two chapters:
 * space and its ring of free masses, or LIGO Livingston with what both detectors measured
 * (#831). Each wave's story is told from its profile (`events.ts`). The 3D view's code and
 * GW150914's measured wave (#830) are fetched the first time they are needed; GW170817 plays a
 * model. The sound is played only when asked for.
 */

import type { Globe } from '../../globe/globe';
import type { Wave, WaveChapter } from '../../state/slices/display';
import type { ViewState } from '../../state/viewState';
import type { MarkerCardContent } from '../../ui/markerCard';
import { element } from '../../ui/dom';
import { errorMessage } from '../../util/errors';
import { getJson } from '../../util/fetchJson';
import type { MountedPart, PartContext } from '../part';
import { playTone, toneCurves, type ToneContext } from './chirpSound';
import { openingChapter, WAVE_EVENTS, type WaveEvent } from './events';
import { GW150914_SCHEMA, measuredWave, type Gw150914 } from './measured';
import { chirp, type Waveform } from './strain';
import { GW170817_SCHEMA, mergerSeconds, type Gw170817Recorded } from './recorded';
import { createRecordedPlot } from './recordedPlot';
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

/** The wave as played: measured (with what both detectors recorded) or a model. */
interface Measured {
  /** What the detectors recorded, for the plot; null for a model. */
  readonly data: Gw150914 | null;
  readonly wave: Waveform;
  /** When the merger's wave reached Livingston, s after its minute. */
  readonly atLivingston: number;
}

/** Each wave, fetched or made the first time it is asked for and kept; asked again if it failed. */
function waveLoader(context: PartContext): (event: WaveEvent) => Promise<Measured> {
  const kept = new Map<Wave, Promise<Measured>>();
  return (event) => {
    const { origin } = event;
    if (origin.kind === 'model') {
      const model = { data: null, wave: chirp(origin.chirp), atLivingston: origin.atLivingston };
      return Promise.resolve(model);
    }
    const asked =
      kept.get(event.id) ??
      getJson(context.fetchJson, `${context.base}data/${origin.file}`, GW150914_SCHEMA)
        .then((data) => ({ data, wave: measuredWave(data), atLivingston: data.merger }))
        .catch((error: unknown) => {
          kept.delete(event.id);
          throw error;
        });
    kept.set(event.id, asked);
    return asked;
  };
}

/** The sound, once the wave has loaded: played through a context made for it, then let go. */
function soundOf(context: WaveContext): (wave: Waveform | null, raised: number) => void {
  const audio = context.audio ?? ((): ToneContext => new AudioContext());
  let stop: (() => void) | null = null;
  return (wave, raised) => {
    if (wave === null) return;
    stop?.();
    try {
      stop = playTone(audio(), toneCurves(wave, raised));
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
const EARTH_MAP = 'textures/earth-blue-marble-2048.webp';

/** How the view is told to draw the measured wave, and tells the stage where it is; at the
 * end of each chapter the story goes on by itself, unless the reader asked for less motion. */
function viewOptions(
  stage: Pick<WaveStage, 'root' | 'moment'>,
  loaded: Measured,
  start: {
    readonly event: WaveEvent;
    readonly chapter: WaveChapter;
    readonly stillness: boolean;
    readonly base: string;
  },
  story: { readonly plot: () => Plot | null; readonly step: (direction: 1) => void },
): WaveViewOptions {
  return {
    wave: loaded.wave,
    bodies: start.event.bodies,
    journey: start.event.journey,
    chapter: start.chapter,
    stillness: start.stillness,
    earthMap: `${start.base}${EARTH_MAP}`,
    atLivingston: loaded.atLivingston,
    onChapterEnd: () => {
      if (!start.stillness) story.step(1);
    },
    covered: () => stage.root.offsetHeight + 24,
    onMoment: (text) => {
      stage.moment.textContent = text;
    },
    onTime: (t) => {
      story.plot()?.setTime(loaded.atLivingston + t);
    },
  };
}

/** What the stage's controls do, given the session's view and wave as they are when used. */
function stageFor(
  context: WaveContext,
  session: {
    readonly event: () => WaveEvent;
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
  const stage = createWaveStage(
    context.why(() => session.event().why, 'Gravitational waves'),
    {
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
          ...session.event().card,
          action: {
            label: 'Play the story from its start',
            run: () => {
              session.goTo('source');
              session.view()?.restart();
            },
          },
        });
      },
      more: () => {
        const { more } = session.event();
        if (more !== undefined) context.showCard(more.card);
      },
      chapter: session.goTo,
      step: session.step,
      hear: () => {
        hear(session.wave(), session.event().sound.raised);
      },
    },
  );
  return stage;
}

/** The story's chapters: the one shown, and going to another as the link does, among those
 * the wave's story has. */
function storyChapters(
  store: PartContext['store'],
  event: () => WaveEvent,
): {
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
      const order = event().chapters;
      const next = order[order.indexOf(chapters.now) + direction];
      if (next !== undefined) chapters.goTo(next);
    },
  };
  return chapters;
}

/** What a plot of what the detectors recorded offers: GW150914's strain, GW170817's maps. */
type Plot = Pick<StrainPlot, 'root' | 'setTime'>;

/** What each wave's detectors recorded, plotted once and kept: GW150914's strain from its file,
 * GW170817's maps fetched when its story opens (#1000); none for a model without them. */
function plotter(
  context: PartContext,
  open: () => Wave | null,
  put: (plot: Plot | null) => void,
): (event: WaveEvent, data: Gw150914 | null) => void {
  const plots = new Map<Wave, Plot>();
  const files = new Map<string, Promise<Gw170817Recorded>>();
  return (event, data) => {
    // Shown only while the wave it is for is open.
    const show = (plot: Plot | null): void => {
      if (open() === event.id) put(plot);
    };
    const kept = plots.get(event.id) ?? (data === null ? null : createStrainPlot(data));
    if (kept !== null) plots.set(event.id, kept);
    show(kept);
    const { origin } = event;
    if (kept !== null || origin.kind !== 'model' || origin.recorded === undefined) return;
    // Fetched apart from the wave, so the story plays without it if it cannot be had.
    const file = origin.recorded;
    const asked =
      files.get(file) ?? getJson(context.fetchJson, `${context.base}data/${file}`, GW170817_SCHEMA);
    files.set(file, asked);
    asked
      .then((recorded) => {
        const plot = createRecordedPlot(recorded, mergerSeconds(recorded));
        plots.set(event.id, plot);
        show(plot);
      })
      .catch((error: unknown) => {
        files.delete(file);
        context.notify(`Could not draw what the detectors recorded: ${errorMessage(error)}`);
      });
  };
}

/** The stage made ready for `event`'s story, from `first`. */
function readied(stage: WaveStage, event: WaveEvent, first: WaveChapter, stillness: boolean): void {
  stage.setEvent(event);
  stage.play.button.hidden = stillness;
  stage.play.set(!stillness);
  stage.showChapter(first);
  stage.moment.textContent = '';
}

export function mountWave(context: WaveContext): MountedPart {
  const { store, globe } = context;
  const loadView = context.loadView ?? (() => import('./waveView'));
  const loadWave = waveLoader(context);
  const container = element('div', { class: 'wave-3d', 'data-testid': 'wave-3d', hidden: '' });
  const close = (): void => {
    store.set((state) => ({ ...state, wave: null }));
  };
  const still = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let view: WaveView | null = null;
  let measured: Measured | null = null;
  let plot: Plot | null = null;
  const plotOf = plotter(
    context,
    () => shown,
    (made) => {
      plot = made;
      stage.setPlot(made?.root ?? null);
    },
  );
  /** The wave open, or being opened; null when closed. */
  let shown: Wave | null = null;
  /** The wave whose story is told: the one open, or the last. */
  let event: WaveEvent = WAVE_EVENTS.gw150914;
  const chapters = storyChapters(store, () => event);
  const stage = stageFor(context, {
    event: () => event,
    view: () => view,
    wave: () => measured?.wave ?? null,
    close,
    still,
    goTo: chapters.goTo,
    step: chapters.step,
  });

  function open(wave: Wave, asked: WaveChapter): void {
    shown = wave;
    event = WAVE_EVENTS[wave];
    const first = openingChapter(event, asked);
    chapters.now = first;
    cover(true, [container, stage.root], globe);
    const stillness = still();
    readied(stage, event, first, stillness);
    Promise.all([loadView(), loadWave(event)])
      .then(([code, loaded]) => {
        if (shown !== wave || view !== null) return;
        const start = { event, chapter: first, stillness, base: context.base };
        const story = { plot: () => plot, step: chapters.step };
        view = code.mountWaveView(container, viewOptions(stage, loaded, start, story));
        measured = loaded;
        plotOf(event, loaded.data);
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
        const chapter = openingChapter(event, state.waveChapter);
        if (shown !== null && chapter !== chapters.now) turnTo(chapter);
        return;
      }
      if (shown !== null) shut();
      if (state.wave !== null) open(state.wave, state.waveChapter);
    },
  };
}
