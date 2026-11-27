// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { STRIKE_SCALE } from '../../deepTime/strikeClock';
import type { LayerFactory } from '../../globe/layerHost';
import { defaultViewState, type ViewState } from '../../state/viewState';
import type { FeatureContext } from '../feature';
import { createOwnTime, handover, type OwnTimeEvent } from '.';
import { OFFER_MS } from './strikeClock';

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', () => 1);
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  document.body.replaceChildren();
});

/** An event that records what its clock asks of it, drawing on one layer. */
function event(key: string, layer: LayerFactory<number>) {
  const at = vi.fn();
  const end = vi.fn();
  const made: OwnTimeEvent = {
    key,
    title: `${key}, in its own time`,
    phases: [],
    scale: STRIKE_SCALE,
    offer: `Watch ${key}`,
    play(tools) {
      const drawn = tools.layer(layer);
      return {
        at(seconds) {
          at(seconds);
          drawn.update(seconds);
        },
        end,
      };
    },
  };
  return { made, at, end };
}

function service(pace: 'slow' | 'normal' = 'slow', playing = true) {
  let view: ViewState = { ...defaultViewState(new Date('2026-01-01T00:00:00Z')), ma: 70 };
  const addLayer = vi.fn(() => ({ update: vi.fn() }));
  const hold = vi.fn(() => playing);
  const resume = vi.fn();
  const refresh = vi.fn();
  const strikes = {
    on: document.createElement('div'),
    setInsets: vi.fn(),
    flyTo: vi.fn(),
    zoomTo: vi.fn(),
  };
  const context = {
    globe: { addLayer },
    refresh,
    change: (next: (state: ViewState) => ViewState) => {
      view = next(view);
    },
    strikes,
    deepTime: { hold, resume, pace: () => pace },
    overPage: {
      add: (element: HTMLElement) => {
        document.body.append(element);
      },
    },
  } as unknown as FeatureContext<'strikes' | 'deepTime' | 'overPage'>;
  return {
    own: createOwnTime(context, context),
    addLayer,
    hold,
    resume,
    refresh,
    strikes,
    view: () => view,
  };
}

const layer: LayerFactory<number> = () => ({ update: () => undefined });
const close = () => document.querySelector<HTMLButtonElement>('.strike-clock-close')?.click();

describe('events in their own time (#1191)', () => {
  it('hands deep time over to the clock at Slow, and offers it faster (#1174)', () => {
    expect(handover('slow')).toBe('clock');
    expect(handover('normal')).toBe('offer');
    expect(handover('fast')).toBe('offer');
  });

  it('at Slow, holds deep time at the event, opens its clock, and resumes it when closed', () => {
    const { own, hold, resume, view } = service('slow');
    const chicxulub = event('Chicxulub', layer);
    expect(own.arrive(chicxulub.made, 66)).toBe('clock');
    expect(hold).toHaveBeenCalledTimes(1);
    expect(view().ma).toBe(66);
    expect(chicxulub.at).toHaveBeenCalledWith(-10);
    // Reached again by another layer while open: left as it is.
    expect(own.arrive(chicxulub.made, 66)).toBe('already');
    close();
    expect(chicxulub.end).toHaveBeenCalledTimes(1);
    expect(resume).toHaveBeenCalledTimes(1);
    // Closed, it can be reached again.
    expect(own.arrive(chicxulub.made, 66)).toBe('clock');
  });

  it('guides the camera as its clock plays, the globe kept clear of the clock beside it (#1266)', () => {
    const { own, strikes } = service('slow');
    const place = { latitude: 60, longitude: 90 };
    const box = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({ left: window.innerWidth - 400, width: 384 } as DOMRect);
    own.watch(
      { ...event('end-Permian', layer).made, views: [{ from: 0, place, distance: 2 }] },
      252,
    );
    expect(strikes.flyTo).toHaveBeenCalledWith(place);
    expect(strikes.zoomTo).toHaveBeenCalledWith(2);
    window.dispatchEvent(new Event('resize'));
    expect(strikes.setInsets).toHaveBeenLastCalledWith({ right: 400 });
    // Across the page's foot, as on a phone: not beside it.
    box.mockReturnValue({ left: 16, width: 300 } as DOMRect);
    window.dispatchEvent(new Event('resize'));
    expect(strikes.setInsets).toHaveBeenLastCalledWith({ right: 0 });
    box.mockReturnValue({ left: window.innerWidth - 400, width: 384 } as DOMRect);
    window.dispatchEvent(new Event('resize'));
    close();
    expect(strikes.setInsets).toHaveBeenLastCalledWith({ right: 0 });
    box.mockRestore();
  });

  it('lends the header the moment its clock is at, from its own zero, while it is open (#1222)', () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    const { own, refresh } = service('slow');
    const permian = event('end-Permian', layer);
    own.watch({ ...permian.made, ma: 251.941 }, 251.9);
    expect(own.lent()).toMatchObject({ when: '251.9 million years ago', what: null });
    expect(own.lent()?.ma).toBeCloseTo(251.941, 6);
    expect(document.documentElement.hasAttribute('data-own-time')).toBe(true);
    // Written again once, a moment later, however often the clock moves meanwhile.
    expect(refresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(250);
    expect(refresh).toHaveBeenCalledTimes(1);
    close();
    expect(own.lent()).toBeNull();
    expect(document.documentElement.hasAttribute('data-own-time')).toBe(false);
    expect(refresh).toHaveBeenCalledTimes(2);
    // Outside deep time, with no zero of its own, nothing is lent.
    own.watch(permian.made, null);
    expect(own.lent()).toBeNull();
    close();
  });

  it('faster, offers the clock once for a while, then again after the offer has gone', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'performance'] });
    const { own, hold } = service('normal');
    const chicxulub = event('Chicxulub', layer);
    expect(own.arrive(chicxulub.made, 66)).toBe('offer');
    expect(own.arrive(chicxulub.made, 66)).toBe('already');
    expect(document.querySelectorAll('.strike-offer')).toHaveLength(1);
    vi.advanceTimersByTime(OFFER_MS + 1);
    expect(document.querySelector('.strike-offer')).toBeNull();
    expect(own.arrive(chicxulub.made, 66)).toBe('offer');
    document.querySelector<HTMLButtonElement>('.strike-offer')?.click();
    expect(hold).toHaveBeenCalledTimes(1);
    expect(document.querySelector<HTMLElement>('.strike-clock')?.hidden).toBe(false);
  });

  it('keeps one clock open: the next closes the last, and their layer is added once', () => {
    const { own, addLayer, resume } = service('slow', false);
    const first = event('First', layer);
    const second = event('Second', layer);
    own.watch(first.made, null);
    own.watch(second.made, 100);
    expect(first.end).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll('.strike-clock')).toHaveLength(1);
    expect(addLayer).toHaveBeenCalledTimes(1);
    // Deep time was not playing: closing does not set it playing.
    close();
    expect(resume).not.toHaveBeenCalled();
  });

  it('out of deep time, holds nothing and moves no moment', () => {
    const { own, hold, view } = service('slow');
    own.watch(event('Chicxulub', layer).made, null);
    expect(hold).not.toHaveBeenCalled();
    expect(view().ma).toBe(70);
  });

  it('lets a fuller drawing of the same event take its clock or its offer over (#1206)', () => {
    const { own } = service('slow');
    const alone = event('Chicxulub', layer);
    const fuller = event('Chicxulub', layer);
    expect(own.arrive(alone.made, 66)).toBe('clock');
    expect(own.arrive({ ...fuller.made, rank: 1 }, 66)).toBe('clock');
    expect(alone.end).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll('.strike-clock')).toHaveLength(1);
    // The fuller open, the plainer is left out.
    expect(own.arrive(alone.made, 66)).toBe('already');
  });

  it('offers the fuller drawing in place of the plainer one', () => {
    const { own } = service('normal');
    expect(own.arrive(event('Chicxulub', layer).made, 66)).toBe('offer');
    expect(own.arrive({ ...event('Chicxulub', layer).made, rank: 1 }, 66)).toBe('offer');
    expect(document.querySelectorAll('.strike-offer')).toHaveLength(1);
  });
});

describe('deep time’s own story (#1218)', () => {
  /** Frames run by hand: each call runs those asked for, at `step` ms after the last. */
  function frames() {
    let asked: FrameRequestCallback[] = [];
    let now = 0;
    // A 200 ms frame is a slow one: the clock waits on a timer before asking for the next.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      asked.push(callback);
      return asked.length;
    });
    return (count: number, step = 200) => {
      for (let index = 0; index < count; index += 1) {
        vi.runOnlyPendingTimers();
        const run = asked;
        asked = [];
        now += step;
        for (const callback of run) callback(now);
      }
    };
  }

  const MYR = 1e6 * 365.25 * 86_400;

  /** A story whose clock carries deep time's moment, its event at 4,500 Ma. */
  function story(key: string) {
    const { made, at, end } = event(key, layer);
    const deep = {
      maAt: (seconds: number) => 4500 - seconds / MYR,
      secondsAt: (ma: number) => (4500 - ma) * MYR,
    };
    return { made: { ...made, deep }, at, end };
  }

  it('opens at the moment deep time was at, and carries deep time along', () => {
    const { own, view } = service('normal');
    const { made, at } = story('formation');
    own.watch(made, 4499.9);
    expect(at).toHaveBeenLastCalledWith(expect.closeTo(0.1 * MYR, -3));
    expect(view().ma).toBe(4499.9);
    const slider = document.querySelector<HTMLInputElement>('.strike-clock-range');
    if (slider === null) throw new Error('no slider');
    slider.value = String(STRIKE_SCALE.positionAt(0.5 * MYR));
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    expect(view().ma).toBe(4499.5);
  });

  it('hands back to deep time from its end, playing on, when it ends', () => {
    const run = frames();
    const { own, resume, view } = service('normal');
    const { made, end } = story('formation');
    own.watch(made, 4600);
    run(400);
    expect(end).toHaveBeenCalledTimes(1);
    expect(resume).toHaveBeenCalledTimes(1);
    // The strike scale ends a million years on.
    expect(view().ma).toBe(4499);
    expect(document.querySelector<HTMLElement>('.strike-clock')?.hidden).toBe(true);
  });

  it('skips to its end when closed', () => {
    const { own, resume, view } = service('normal');
    own.watch(story('formation').made, 4600);
    close();
    expect(resume).toHaveBeenCalledTimes(1);
    expect(view().ma).toBe(4499);
  });

  it('leaves an event that is not deep time’s own waiting at its end', () => {
    const run = frames();
    const { own, resume } = service('slow');
    const chicxulub = event('Chicxulub', layer);
    own.watch(chicxulub.made, 66);
    run(400);
    expect(chicxulub.end).not.toHaveBeenCalled();
    expect(resume).not.toHaveBeenCalled();
  });
});
