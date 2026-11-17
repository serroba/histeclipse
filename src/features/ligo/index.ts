/**
 * A gravitational wave passing (#829, epic #834), as a part of the page: while the view names a
 * wave (`wave=gw150914`), space stretched and squeezed is drawn over the globe, with a stage
 * below saying what it is, where the wave is, and how far the drawing is from the truth; and
 * controls to pause, start again and close. The 3D view's code is loaded the first time it opens.
 *
 * The wave is GW150914 as LIGO measured it (#830): its file is fetched with the view's code, and
 * the stage opens its card, the event's facts as the discovery paper gives them.
 */

import type { Globe } from '../../globe/globe';
import type { Wave } from '../../state/slices/display';
import type { ViewState } from '../../state/viewState';
import { element } from '../../ui/dom';
import { createStoryPlay } from '../../ui/transport';
import { errorMessage } from '../../util/errors';
import type { MountedPart, PartContext } from '../part';
import type { MarkerCardContent } from '../../ui/markerCard';
import { getJson } from '../../util/fetchJson';
import { GW150914_CARD } from './eventCard';
import { GW150914_SCHEMA, measuredWave } from './measured';
import type { Waveform } from './strain';
import type { WaveView, WaveViewOptions } from './waveView';
import { SCALE_NOTE } from './wavePlay';
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
}

const ABOUT =
  'A ring of free masses, as a gravitational wave from two black holes merging 1.3 billion light-years away comes through it toward you. Space itself stretches one way and squeezes the other, then the other way round, faster and harder as the black holes spiral together, and rings as the one they make settles. Behind the ring, the space the wave has already crossed.';

interface Stage {
  readonly root: HTMLElement;
  readonly moment: HTMLElement;
  readonly play: ReturnType<typeof createStoryPlay>;
}

/** The stage under the view: what it is, where the wave is, the scale, and the controls. */
function createStage(
  context: WaveContext,
  controls: {
    readonly onPlay: (playing: boolean) => void;
    readonly restart: () => void;
    readonly close: () => void;
    readonly about: () => void;
  },
): Stage {
  const moment = element('p', { class: 'wave-moment', 'data-testid': 'wave-moment' });
  const button = (label: string, run: () => void): HTMLButtonElement => {
    const made = element('button', { type: 'button', class: 'wave-control' }, label);
    made.addEventListener('click', run);
    return made;
  };
  const play = createStoryPlay('wave-control', (playing) => {
    play.set(playing);
    controls.onPlay(playing);
  });
  const root = element(
    'section',
    { class: 'wave-stage', 'aria-label': 'A gravitational wave passing', hidden: '' },
    element('h2', { class: 'wave-title' }, 'GW150914: space stretched by a passing wave'),
    element('p', { class: 'wave-about' }, ABOUT),
    moment,
    element('p', { class: 'wave-scale', 'data-testid': 'wave-scale' }, SCALE_NOTE),
    element(
      'div',
      { class: 'wave-controls' },
      play.button,
      button('Start again', controls.restart),
      button('About GW150914', controls.about),
      context.why('gravitationalWaves', 'Gravitational waves'),
      button('Close', controls.close),
    ),
  );
  play.join(root, () => undefined);
  document.addEventListener('keydown', (event) => {
    if (root.hasAttribute('hidden') || event.defaultPrevented || event.key !== 'Escape') return;
    event.preventDefault();
    controls.close();
  });
  return { root, moment, play };
}

/** The measured wave, fetched the first time it is asked for and kept; asked again if it failed. */
function measuredLoader(context: PartContext): () => Promise<Waveform> {
  let measured: Promise<Waveform> | null = null;
  return () => {
    measured ??= getJson(context.fetchJson, `${context.base}data/gw150914.json`, GW150914_SCHEMA)
      .then(measuredWave)
      .catch((error: unknown) => {
        measured = null;
        throw error;
      });
    return measured;
  };
}

export function mountWave(context: WaveContext): MountedPart {
  const { store, globe } = context;
  const loadView = context.loadView ?? (() => import('./waveView'));
  const container = element('div', { class: 'wave-3d', 'data-testid': 'wave-3d', hidden: '' });
  const close = (): void => {
    store.set((state) => ({ ...state, wave: null }));
  };
  const still = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const {
    root: stage,
    moment,
    play,
  } = createStage(context, {
    onPlay: (playing) => view?.setPlaying(playing),
    restart: () => {
      view?.restart();
      if (still()) return;
      play.set(true);
      view?.setPlaying(true);
    },
    close,
    about: () => {
      context.showCard(GW150914_CARD);
    },
  });
  const loadWave = measuredLoader(context);

  let view: WaveView | null = null;
  /** The wave open, or being opened; null when closed. */
  let shown: Wave | null = null;

  function open(wave: Wave): void {
    shown = wave;
    container.hidden = false;
    stage.hidden = false;
    document.documentElement.classList.add('is-explaining');
    globe.controlShower('cover');
    const stillness = still();
    play.button.hidden = stillness;
    play.set(!stillness);
    moment.textContent = '';
    Promise.all([loadView(), loadWave()])
      .then(([loaded, measuredWave]) => {
        if (shown !== wave || view !== null) return;
        view = loaded.mountWaveView(container, {
          wave: measuredWave,
          stillness,
          covered: () => stage.offsetHeight + 24,
          onMoment: (text) => {
            moment.textContent = text;
          },
        });
      })
      .catch((error: unknown) => {
        context.notify(`Could not draw the wave: ${errorMessage(error)}`);
        close();
      });
  }

  function shut(): void {
    shown = null;
    view?.dispose();
    view = null;
    container.hidden = true;
    stage.hidden = true;
    document.documentElement.classList.remove('is-explaining');
    globe.controlShower('uncover');
  }

  return {
    watches: (state) => [state.wave],
    elements: [container, stage],
    render(state: ViewState) {
      if (state.wave === shown) return;
      if (shown !== null) shut();
      if (state.wave !== null) open(state.wave);
    },
  };
}
