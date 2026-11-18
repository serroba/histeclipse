// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createStore } from '../../state/store';
import { defaultViewState, type ViewState } from '../../state/viewState';
import { GW150914_CARD } from './eventCard';
import type { WaveView, WaveViewOptions } from './waveView';
import { mountWave, type WaveContext } from '.';

interface Mounted {
  readonly views: {
    options: WaveViewOptions;
    view: Record<keyof WaveView, ReturnType<typeof vi.fn>>;
  }[];
  readonly store: ReturnType<typeof createStore<ViewState>>;
  readonly notify: ReturnType<typeof vi.fn>;
  readonly controlShower: ReturnType<typeof vi.fn>;
  readonly showCard: ReturnType<typeof vi.fn>;
  readonly played: ReturnType<typeof vi.fn>;
  readonly fetched: string[];
  readonly part: ReturnType<typeof mountWave>;
}

// From the repository's root, where the tests run: in this environment the module's own URL is
// the page's, not a file's.
const measured = readFileSync('public/data/gw150914.json', 'utf8');

function mount(fails: 'view' | 'data' | null = null): Mounted {
  const store = createStore<ViewState>(defaultViewState(new Date('2026-01-01T00:00:00Z')));
  const notify = vi.fn();
  const controlShower = vi.fn();
  const showCard = vi.fn();
  const played = vi.fn();
  const views: Mounted['views'] = [];
  const fetched: string[] = [];
  const context: WaveContext = {
    base: '/',
    fetchJson: (url) => {
      fetched.push(url);
      return Promise.resolve(
        fails === 'data' ? new Response('', { status: 404 }) : new Response(measured),
      );
    },
    store,
    notify,
    why: () => document.createElement('button'),
    goToDeepTime: () => undefined,
    timeline: {
      travelling: () => false,
      playing: () => false,
      oldest: () => 540,
      earthFace: (jd) => jd,
    },
    deltaT: () => {
      throw new Error('no ΔT here');
    },
    ephemerides: {
      moon: () => null,
      moonAt: () => null,
      planets: () => null,
      loadPlanets: () => Promise.reject(new Error('none')),
      planetPositions: () => null,
      planetsSeen: () => [],
    },
    globe: { controlShower },
    showCard,
    audio: () => {
      played();
      throw new Error('no sound here');
    },
    loadView: () =>
      fails === 'view'
        ? Promise.reject(new Error('no WebGL'))
        : Promise.resolve({
            mountWaveView: (_host: HTMLElement, options: WaveViewOptions) => {
              const view = {
                setChapter: vi.fn(),
                setPlaying: vi.fn(),
                restart: vi.fn(),
                dispose: vi.fn(),
              };
              views.push({ options, view });
              return view;
            },
          }),
  };
  const part = mountWave(context);
  document.body.append(...part.elements);
  store.subscribe((state) => {
    part.render(state);
  });
  return { views, store, notify, controlShower, showCard, played, fetched, part };
}

const settled = (): Promise<unknown> => new Promise((resolve) => setTimeout(resolve, 0));
const open = (store: Mounted['store']): void => {
  store.set((state) => ({ ...state, wave: 'gw150914' }));
};
const stage = (): HTMLElement => {
  const found = document.querySelector<HTMLElement>('.wave-stage');
  if (found === null) throw new Error('no stage');
  return found;
};
const click = (label: string): void => {
  [...stage().querySelectorAll('button')].find((button) => button.textContent === label)?.click();
};

describe('a gravitational wave passing, as a part of the page (#829)', () => {
  afterEach(() => {
    document.body.replaceChildren();
    document.documentElement.classList.remove('is-explaining');
  });

  it('Given no wave named, Then nothing shows', () => {
    const { part } = mount();
    part.render(defaultViewState(new Date('2026-01-01T00:00:00Z')));
    expect(stage().hidden).toBe(true);
    expect(part.watches({ wave: 'gw150914' } as ViewState)).toEqual(['gw150914']);
  });

  it('Given the wave named, Then the view opens over a covered globe, saying how far it is stretched', async () => {
    const { views, store, controlShower } = mount();
    open(store);
    await settled();
    expect(stage().hidden).toBe(false);
    expect(document.querySelector<HTMLElement>('[data-testid="wave-3d"]')?.hidden).toBe(false);
    expect(controlShower).toHaveBeenCalledWith('cover');
    expect(document.documentElement.classList.contains('is-explaining')).toBe(true);
    expect(document.querySelector('[data-testid="wave-scale"]')?.textContent).toContain('10²⁰');
    expect(views).toHaveLength(1);
    views[0]?.options.onMoment('The merger · 150 Hz');
    expect(document.querySelector('[data-testid="wave-moment"]')?.textContent).toBe(
      'The merger · 150 Hz',
    );
  });

  it('Given it open, When paused and started again, Then the view is told', async () => {
    const { views, store } = mount();
    open(store);
    await settled();
    const view = views[0]?.view;
    click('Pause');
    expect(view?.setPlaying).toHaveBeenLastCalledWith(false);
    click('Start again');
    expect(view?.restart).toHaveBeenCalled();
    expect(view?.setPlaying).toHaveBeenLastCalledWith(true);
  });

  it('Given it open, When closed or Escape is pressed, Then the view goes and the globe shows', async () => {
    const { views, store, controlShower } = mount();
    open(store);
    await settled();
    click('Close');
    expect(store.get().wave).toBeNull();
    expect(views[0]?.view.dispose).toHaveBeenCalled();
    expect(stage().hidden).toBe(true);
    expect(controlShower).toHaveBeenLastCalledWith('uncover');

    open(store);
    await settled();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(store.get().wave).toBeNull();
  });

  it('Given it closed before its code has loaded, Then no view is made', async () => {
    const { views, store } = mount();
    open(store);
    store.set((state) => ({ ...state, wave: null }));
    await settled();
    expect(views).toHaveLength(0);
  });

  it('Given the view cannot be drawn, Then the reader is told and it closes', async () => {
    const { store, notify } = mount('view');
    open(store);
    await settled();
    expect(notify).toHaveBeenCalledWith('Could not draw the wave: no WebGL');
    expect(store.get().wave).toBeNull();
  });

  it('Given the measured wave cannot be fetched, Then the reader is told, and it is asked for again next time', async () => {
    const { store, notify, fetched } = mount('data');
    open(store);
    await settled();
    expect(notify.mock.calls[0]?.[0]).toMatch(
      /^Could not draw the wave: GET \/data\/gw150914\.json failed/,
    );
    open(store);
    await settled();
    expect(fetched).toEqual(['/data/gw150914.json', '/data/gw150914.json']);
  });

  it('Given it open, Then it plays the measured wave, fetched once, and its card opens from the stage', async () => {
    const { views, store, showCard, fetched } = mount();
    open(store);
    await settled();
    expect(views[0]?.options.wave.peak).toBeGreaterThan(0.8e-21);
    click('About GW150914');
    expect(showCard).toHaveBeenCalledWith(expect.objectContaining(GW150914_CARD));
    click('Close');
    open(store);
    await settled();
    expect(fetched).toEqual(['/data/gw150914.json']);
  });

  it('Given it open, When Livingston is chosen, Then the detector shows with both detectors plotted, the clock following', async () => {
    const { views, store } = mount();
    open(store);
    await settled();
    expect(stage().dataset['chapter']).toBe('space');
    const plot = stage().querySelector<HTMLElement>('.wave-plot');
    expect(plot?.hidden).toBe(true);
    click('At Livingston');
    expect(views[0]?.view.setChapter).toHaveBeenLastCalledWith('detector');
    expect(stage().dataset['chapter']).toBe('detector');
    expect(plot?.hidden).toBe(false);
    expect(plot?.querySelector('[data-testid="strain-h1"]')).not.toBeNull();
    views[0]?.options.onTime?.(0);
    expect(plot?.querySelector('[data-testid="strain-clock"]')?.textContent).toMatch(
      /^09:50:45\.4\d\d UTC$/,
    );
    click('Space');
    expect(views[0]?.view.setChapter).toHaveBeenLastCalledWith('space');
    click('The source');
    expect(views[0]?.view.setChapter).toHaveBeenLastCalledWith('source');
    expect(stage().textContent).toContain('not to scale');
  });

  it('Given the card opened from the stage, When its action is taken, Then Livingston shows', async () => {
    const { views, store, showCard } = mount();
    open(store);
    await settled();
    click('About GW150914');
    const card = showCard.mock.calls[0]?.[0] as { action?: { label: string; run: () => void } };
    expect(card.action?.label).toBe('See it at Livingston');
    card.action?.run();
    expect(views[0]?.view.setChapter).toHaveBeenLastCalledWith('detector');
  });

  it('Given the sound, Then it plays only when asked, and says so if it cannot', async () => {
    const { store, played, notify } = mount();
    click('Hear it');
    expect(played).not.toHaveBeenCalled();
    open(store);
    await settled();
    expect(played).not.toHaveBeenCalled();
    expect(stage().textContent).toContain('plays the chirp slowed 10 times and raised two octaves');
    click('Hear it');
    expect(played).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith('Could not play the sound: no sound here');
  });
});
