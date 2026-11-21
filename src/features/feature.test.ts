import { describe, expect, it, vi } from 'vitest';

import {
  feature,
  travelPace,
  TRAVEL_REDRAW_MS,
  type Capabilities,
  type FeatureCore,
} from './feature';

const core = {
  base: '/',
  notify: vi.fn(),
  refresh: vi.fn(),
} as unknown as FeatureCore;

const capabilities = {
  cards: { show: vi.fn(), open: () => false },
  anchors: { open: vi.fn() },
  timeline: { travelling: () => false },
  tree: { openLineages: vi.fn(), openTree: vi.fn() },
} as unknown as Capabilities;

describe('a feature and what it asks for', () => {
  it('is lent the core and the capabilities it names, and no others', () => {
    const mount = vi.fn(() => ({}));
    const made = feature({
      id: 'volcanoes',
      needs: ['cards', 'timeline'],
      watches: () => [],
      mount,
    });
    made.mount(core, capabilities);
    const [lent] = mount.mock.calls[0] as unknown as [Record<string, unknown>];
    expect(Object.keys(lent).sort()).toEqual(['base', 'cards', 'notify', 'refresh', 'timeline']);
    expect(lent['cards']).toBe(capabilities.cards);
    expect(lent['timeline']).toBe(capabilities.timeline);
    expect(lent['base']).toBe('/');
  });

  it('is lent the core alone when it asks for nothing', () => {
    const mount = vi.fn(() => ({}));
    feature({ id: 'warming', needs: [], watches: () => [], mount }).mount(core, capabilities);
    const [lent] = mount.mock.calls[0] as unknown as [Record<string, unknown>];
    expect(Object.keys(lent).sort()).toEqual(['base', 'notify', 'refresh']);
  });

  it('keeps what it declares: its layer, its needs, its picks and what it watches', () => {
    const watches = () => [1];
    const made = feature({
      id: 'fossils',
      needs: ['tree'],
      watches,
      picks: 'fossil',
      deepChip: { label: 'Fossils', why: 'fossils' },
      mount: () => ({}),
    });
    expect(made.id).toBe('fossils');
    expect(made.needs).toEqual(['tree']);
    expect(made.picks).toBe('fossil');
    expect(made.deepChip).toEqual({ label: 'Fossils', why: 'fossils' });
    expect(made.watches).toBe(watches);
  });

  it('gives what the mounted feature returns back to the app', () => {
    const instance = { said: () => 'here' };
    const made = feature({ id: 'genomes', needs: [], watches: () => [], mount: () => instance });
    expect(made.mount(core, capabilities)).toBe(instance);
  });
});

describe('a layer drawn from the year, while the years play', () => {
  it('draws whenever time stands, and while it plays at most every TRAVEL_REDRAW_MS, then once more late', () => {
    let at = 0;
    const scheduled: { run: () => void; ms: number }[] = [];
    const late = vi.fn();
    const pace = travelPace(
      late,
      () => at,
      (run, ms) => scheduled.push({ run, ms }),
    );
    expect(pace.due(false)).toBe(true);
    expect(pace.due(true)).toBe(true);
    at = 100;
    expect(pace.due(true)).toBe(false);
    at = 200;
    expect(pace.due(true)).toBe(false);
    // One late draw asked for, when the wait is over.
    expect(scheduled.map((each) => each.ms)).toEqual([TRAVEL_REDRAW_MS - 100]);
    scheduled[0]?.run();
    expect(late).toHaveBeenCalledTimes(1);
    at = TRAVEL_REDRAW_MS;
    expect(pace.due(true)).toBe(true);
    // Time standing draws at once, whatever the pace.
    at = TRAVEL_REDRAW_MS + 1;
    expect(pace.due(false)).toBe(true);
  });
});
