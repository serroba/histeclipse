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
  const context = {
    globe: { addLayer },
    change: (next: (state: ViewState) => ViewState) => {
      view = next(view);
    },
    strikes: { on: document.createElement('div') },
    deepTime: { hold, resume, pace: () => pace },
    overPage: {
      add: (element: HTMLElement) => {
        document.body.append(element);
      },
    },
  } as unknown as FeatureContext<'strikes' | 'deepTime' | 'overPage'>;
  return { own: createOwnTime(context, context), addLayer, hold, resume, view: () => view };
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
