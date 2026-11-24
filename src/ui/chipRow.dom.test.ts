// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createChipRow } from './chipRow';

/** The observers made, so a test can say what came into view. */
let observers: { callback: IntersectionObserverCallback; watched: Element[] }[] = [];

beforeEach(() => {
  observers = [];
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      readonly record: { callback: IntersectionObserverCallback; watched: Element[] };
      constructor(callback: IntersectionObserverCallback) {
        this.record = { callback, watched: [] };
        observers.push(this.record);
      }
      observe(target: Element): void {
        this.record.watched.push(target);
      }
      disconnect(): void {
        this.record.watched = [];
      }
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function chips(...names: string[]): HTMLElement[] {
  return names.map((name) => {
    const item = document.createElement('li');
    item.textContent = name;
    return item;
  });
}

describe('a row of chips (#1196)', () => {
  it('is built again only when what it shows changes', () => {
    const list = document.createElement('ul');
    const row = createChipRow(list);
    const eclipses = ['March', 'September'];
    const build = vi.fn(() => chips(...eclipses));
    row.show([eclipses, null], build);
    const first = list.firstElementChild;
    row.show([eclipses, null], build);
    expect(build).toHaveBeenCalledTimes(1);
    expect(list.firstElementChild).toBe(first);
    row.show([eclipses, 'March'], build);
    expect(build).toHaveBeenCalledTimes(2);
    expect(list.firstElementChild).not.toBe(first);
    row.show([eclipses], build);
    expect(build).toHaveBeenCalledTimes(3);
  });

  it('fades its end while its last chip is cut off, told by an observer, not measured', () => {
    const list = document.createElement('ul');
    const row = createChipRow(list);
    row.show(['two'], () => chips('March', 'September'));
    const [watcher] = observers;
    if (watcher === undefined) throw new Error('no observer');
    expect(watcher.watched).toEqual([list.lastElementChild]);
    const tell = (...ratios: number[]): void => {
      watcher.callback(
        ratios.map((ratio) => ({ intersectionRatio: ratio }) as IntersectionObserverEntry),
        {} as IntersectionObserver,
      );
    };
    tell(0.4);
    expect(list.dataset['more']).toBe('true');
    tell(0.4, 1);
    expect(list.dataset['more']).toBe('false');
    tell();
    expect(list.dataset['more']).toBe('false');
    tell(0.4);
    // A message, not chips: no fade, and nothing watched.
    row.show(['none'], () => chips('No eclipses this year'), false);
    expect(list.dataset['more']).toBeUndefined();
    expect(watcher.watched).toEqual([]);
    row.show(['empty'], () => []);
    expect(list.dataset['more']).toBeUndefined();
  });
});
