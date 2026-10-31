import { describe, expect, it } from 'vitest';

import { createStore } from './store';

describe('createStore', () => {
  it('notifies listeners with the new and previous values', () => {
    const store = createStore({ count: 0 });
    const seen: [number, number][] = [];
    store.subscribe((value, previous) => seen.push([value.count, previous.count]));
    store.set({ count: 1 });
    store.set((current) => ({ count: current.count + 1 }));
    expect(seen).toEqual([
      [1, 0],
      [2, 1],
    ]);
    expect(store.get()).toEqual({ count: 2 });
  });

  it('skips listeners when the value is the same object', () => {
    const state = { count: 0 };
    const store = createStore(state);
    let calls = 0;
    store.subscribe(() => (calls += 1));
    store.set(state);
    store.set((current) => current);
    expect(calls).toBe(0);
  });

  it('stops notifying after unsubscribing, even mid-notification', () => {
    const store = createStore(0);
    const seen: string[] = [];
    const stopB = store.subscribe(() => seen.push('b'));
    store.subscribe(() => {
      seen.push('a');
      stopB();
    });
    store.set(1);
    store.set(2);
    expect(seen).toEqual(['b', 'a', 'a']);
  });
});
