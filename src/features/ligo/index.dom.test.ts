// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createStore } from '../../state/store';
import { defaultViewState, type ViewState } from '../../state/viewState';
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
  readonly part: ReturnType<typeof mountWave>;
}

function mount(fails = false): Mounted {
  const store = createStore<ViewState>(defaultViewState(new Date('2026-01-01T00:00:00Z')));
  const notify = vi.fn();
  const controlShower = vi.fn();
  const views: Mounted['views'] = [];
  const context: WaveContext = {
    base: '/',
    fetchJson: () => Promise.reject(new Error('no fetching in tests')),
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
    loadView: () =>
      fails
        ? Promise.reject(new Error('no WebGL'))
        : Promise.resolve({
            mountWaveView: (_host: HTMLElement, options: WaveViewOptions) => {
              const view = {
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
  return { views, store, notify, controlShower, part };
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
    const { store, notify } = mount(true);
    open(store);
    await settled();
    expect(notify).toHaveBeenCalledWith('Could not draw the wave: no WebGL');
    expect(store.get().wave).toBeNull();
  });
});
