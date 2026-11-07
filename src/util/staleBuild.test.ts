import { describe, expect, it } from 'vitest';

import { RELOAD_GUARD_MS, shouldReload } from './staleBuild';

function memory(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => {
      items.clear();
    },
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => {
      items.delete(key);
    },
    setItem: (key, value) => {
      items.set(key, value);
    },
  };
}

describe('reloading for a new build', () => {
  it('reloads the first time a late part fails to load', () => {
    expect(shouldReload(memory(), 1_000_000)).toBe(true);
  });

  it('does not reload again soon after: the new build fails too, so no loop', () => {
    const storage = memory();
    expect(shouldReload(storage, 1_000_000)).toBe(true);
    expect(shouldReload(storage, 1_000_000 + RELOAD_GUARD_MS - 1)).toBe(false);
  });

  it('reloads again for a later deploy', () => {
    const storage = memory();
    expect(shouldReload(storage, 1_000_000)).toBe(true);
    expect(shouldReload(storage, 1_000_000 + RELOAD_GUARD_MS)).toBe(true);
  });

  it('ignores a value it did not write', () => {
    const storage = memory();
    storage.setItem('histeclipse:reloaded-for-new-build', 'garbage');
    expect(shouldReload(storage, 5)).toBe(true);
  });
});
