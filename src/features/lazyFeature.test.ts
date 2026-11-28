import { describe, expect, it, vi } from 'vitest';

import { defaultViewState, withLayer, type ViewState } from '../state/viewState';
import type { Capability, FeatureContext, FeatureInstance } from './feature';
import { lazyFeature } from './lazyFeature';

const base = defaultViewState(new Date('2026-01-01T00:00:00Z'));
const on: ViewState = { ...base, layers: withLayer(base.layers, 'volcanoes', true) };

function setUp(load: () => Promise<(context: FeatureContext) => FeatureInstance>) {
  const refresh = vi.fn();
  const notify = vi.fn();
  const idle = vi.fn();
  const context = { refresh, notify } as unknown as FeatureContext<Capability>;
  const front = lazyFeature({
    id: 'volcanoes',
    needs: [],
    watches: (state) => [state.layers],
    wanted: (state) => state.layers.has('volcanoes'),
    idle,
    body: load,
  });
  return { shown: front.mount(context, context), front, refresh, notify, idle };
}

function body(): FeatureInstance & { readonly shows: unknown[]; readonly picks: string[] } {
  const shows: unknown[] = [];
  const picks: string[] = [];
  return {
    shows,
    picks,
    show: (state, jd) => shows.push([state.layers.has('volcanoes'), jd]),
    pick: (id) => picks.push(id),
    unpick: () => picks.push('unpicked'),
    said: () => 'said',
    brief: () => ({ short: 'b', full: 'brief' }),
    action: () => ({ label: 'act', run: () => undefined }),
    here: () => ({ title: 'Volcanoes', text: 'here', why: 'volcanoes' }),
    finds: () => [66],
    load: () => null,
  };
}

describe('a feature whose code loads when first wanted (#220)', () => {
  it('Given it not wanted, Then only its front runs, and nothing loads', () => {
    const load = vi.fn(() => Promise.resolve(() => body()));
    const { shown, front, idle } = setUp(load);
    shown.show?.(base, 1);
    expect(idle).toHaveBeenCalledWith(expect.anything(), base);
    expect(load).not.toHaveBeenCalled();
    expect(shown.load?.()).toBeNull();
    expect(shown.said?.()).toBeNull();
    expect(shown.brief?.()).toBeNull();
    expect(shown.action?.()).toBeNull();
    expect(shown.here?.(base)).toBeNull();
    expect(shown.finds?.(base)).toEqual([]);
    expect(front.watches(on)).toEqual([on.layers]);
    expect(front.picks).toBeUndefined();
  });

  it('Given it wanted, Then its chip says loading, the body loads once and mounts, and the moment is shown again', async () => {
    const made = body();
    const load = vi.fn(() => Promise.resolve(() => made));
    const { shown, refresh } = setUp(load);
    shown.show?.(on, 1);
    shown.show?.(on, 2);
    expect(shown.load?.()).toEqual({ state: 'loading' });
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledOnce();
    });
    expect(load).toHaveBeenCalledOnce();
    shown.show?.(on, 3);
    expect(made.shows).toEqual([[true, 3]]);
    expect(shown.said?.()).toBe('said');
    expect(shown.brief?.()).toEqual({ short: 'b', full: 'brief' });
    expect(shown.action?.()?.label).toBe('act');
    expect(shown.here?.(on)).toEqual({ title: 'Volcanoes', text: 'here', why: 'volcanoes' });
    expect(shown.finds?.(on)).toEqual([66]);
    expect(shown.load?.()).toBeNull();
    // Mounted, picks go straight to it, and loading is not asked again.
    shown.pick?.('8');
    shown.unpick?.();
    expect(made.picks).toEqual(['8', 'unpicked']);
    shown.show?.(on, 4);
    expect(load).toHaveBeenCalledOnce();
  });

  it('Given a pick before it loads, Then the body loads and opens it', async () => {
    const made = body();
    const { shown } = setUp(() => Promise.resolve(() => made));
    shown.pick?.('7');
    await vi.waitFor(() => {
      expect(made.picks).toEqual(['7']);
    });
  });

  it('Given a pick taken back before it loads, Then nothing opens', async () => {
    const made = body();
    const { shown, refresh } = setUp(() => Promise.resolve(() => made));
    shown.pick?.('7');
    shown.unpick?.();
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalled();
    });
    expect(made.picks).toEqual([]);
  });

  it('Given the body does not load, Then it says so, and its chip offers to try again', async () => {
    const made = body();
    const load = vi
      .fn<() => Promise<(context: FeatureContext) => FeatureInstance>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(() => made);
    const { shown, notify } = setUp(load);
    shown.show?.(on, 1);
    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledWith('Could not load volcanoes: offline');
    });
    const failed = shown.load?.();
    expect(failed?.state).toBe('failed');
    if (failed?.state === 'failed') failed.retry();
    await vi.waitFor(() => {
      expect(shown.load?.()).toBeNull();
    });
    shown.show?.(on, 2);
    expect(made.shows).toEqual([[true, 2]]);
  });
});
