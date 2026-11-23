import { describe, expect, it, vi } from 'vitest';

import type { BoundaryFrame } from '../../data/plateBoundaries';
import type { Fetch } from '../../util/fetchJson';
import { createPlateBoundaries } from './plateBoundaries';
import type { BoundariesShown } from './plateBoundaryLayer';

const INDEX = {
  schemaVersion: 1,
  credit: 'Cao et al. (2024), CC BY 4.0',
  source: 'https://doi.org/10.5281/zenodo.13628813',
  stepMa: 5,
  oldestMa: 10,
};
const frame = (ma: number) => ({
  ma,
  lines: { ridge: [[170, 0, 175, 1]], subduction: [], transform: [], other: [] },
});

/** A fetch that answers when told: each URL asked, and a way to answer it. */
function pending() {
  const asked: string[] = [];
  const answers = new Map<string, (body: unknown) => void>();
  const failures = new Map<string, () => void>();
  const fetchJson: Fetch = (url) => {
    asked.push(url);
    return new Promise((resolve, reject) => {
      answers.set(url, (body) => {
        resolve(Response.json(body));
      });
      failures.set(url, () => {
        reject(new Error('offline'));
      });
    });
  };
  return { asked, fetchJson, answers, failures };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function setUp() {
  const net = pending();
  const shown: (BoundariesShown | null)[] = [];
  const refresh = vi.fn();
  const notify = vi.fn();
  const boundaries = createPlateBoundaries({
    base: '/',
    fetchJson: net.fetchJson,
    layer: { update: (input) => shown.push(input) },
    page: { refresh, notify },
  });
  return { net, shown, refresh, notify, boundaries };
}

describe('the plate boundaries with Plates (#1160)', () => {
  it('load the index, then the frame nearest, and show it turned as the continents are', async () => {
    const { net, shown, refresh, boundaries } = setUp();
    boundaries.show({ ma: 6, turn: 20 });
    boundaries.show({ ma: 6, turn: 20 });
    expect(net.asked).toEqual(['/data/plate-boundaries/index.json']);
    net.answers.get('/data/plate-boundaries/index.json')?.(INDEX);
    await settle();
    expect(refresh).toHaveBeenCalledTimes(1);
    boundaries.show({ ma: 6, turn: 20 });
    expect(net.asked.at(-1)).toBe('/data/plate-boundaries/5.json');
    expect(shown.at(-1)).toBeNull();
    net.answers.get('/data/plate-boundaries/5.json')?.(frame(5));
    await settle();
    boundaries.show({ ma: 6, turn: 20 });
    const last = shown.at(-1);
    expect(last?.key).toBe('5:20');
    expect(last?.frame.lines.ridge).toEqual([
      [
        [-170, 0],
        [-165, 1],
      ],
    ]);
  });

  it('keep the frame before while the next loads, and none beyond the oldest', async () => {
    const { net, shown, boundaries } = setUp();
    boundaries.show({ ma: 0, turn: 0 });
    net.answers.get('/data/plate-boundaries/index.json')?.(INDEX);
    await settle();
    boundaries.show({ ma: 0, turn: 0 });
    net.answers.get('/data/plate-boundaries/0.json')?.(frame(0));
    await settle();
    boundaries.show({ ma: 0, turn: 0 });
    const first: BoundaryFrame | undefined = shown.at(-1)?.frame;
    boundaries.show({ ma: 5, turn: 0 });
    expect(shown.at(-1)?.frame).toBe(first);
    boundaries.show({ ma: 20, turn: 0 });
    expect(shown.at(-1)).toBeNull();
    boundaries.show(null);
    expect(shown.at(-1)).toBeNull();
  });

  it('say once when they could not load', async () => {
    const { net, notify, boundaries } = setUp();
    boundaries.show({ ma: 0, turn: 0 });
    net.failures.get('/data/plate-boundaries/index.json')?.();
    await settle();
    expect(notify).toHaveBeenCalledWith('Could not load the plate boundaries: offline');
    boundaries.show({ ma: 0, turn: 0 });
    expect(net.asked).toHaveLength(1);
  });

  it('say when a frame could not load, and not ask for it again', async () => {
    const { net, notify, boundaries } = setUp();
    boundaries.show({ ma: 0, turn: 0 });
    net.answers.get('/data/plate-boundaries/index.json')?.(INDEX);
    await settle();
    boundaries.show({ ma: 0, turn: 0 });
    net.failures.get('/data/plate-boundaries/0.json')?.();
    await settle();
    expect(notify).toHaveBeenCalledTimes(1);
    boundaries.show({ ma: 0, turn: 0 });
    expect(net.asked).toHaveLength(2);
  });
});
