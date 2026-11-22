import { describe, expect, it, vi } from 'vitest';

import { loadOnce } from './layerLoad';

function setUp() {
  const fetches: { resolve: (value: string) => void; reject: (error: Error) => void }[] = [];
  const fetch = vi.fn(
    () =>
      new Promise<string>((resolve, reject) => {
        fetches.push({ resolve, reject });
      }),
  );
  const notify = vi.fn();
  const refresh = vi.fn();
  const load = loadOnce({ fetch, what: 'the records', context: { notify, refresh } });
  const settle = async (): Promise<void> => {
    for (let turn = 0; turn < 3; turn++) await Promise.resolve();
  };
  return { load, fetch, fetches, notify, refresh, settle };
}

describe("a layer's data, loaded once (#762)", () => {
  it('Given it is not wanted yet, Then nothing is fetched and nothing is reported', () => {
    const { load, fetch } = setUp();
    expect(fetch).not.toHaveBeenCalled();
    expect(load.status()).toBe('idle');
    expect(load.report(true)).toBeNull();
  });

  it('Given it is wanted at every moment, Then it is fetched once, and loading is reported while on', async () => {
    const { load, fetch, fetches, refresh, settle } = setUp();
    load.want();
    load.want();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(load.report(true)).toEqual({ state: 'loading' });
    expect(load.report(false)).toBeNull();
    fetches[0]?.resolve('data');
    await settle();
    expect(load.value()).toBe('data');
    expect(load.status()).toBe('loaded');
    expect(load.report(true)).toBeNull();
    expect(refresh).toHaveBeenCalledTimes(1);
    load.want();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('Given the fetch fails, Then the reader is told, and it is not fetched again until Try again', async () => {
    const { load, fetch, fetches, notify, refresh, settle } = setUp();
    load.want();
    fetches[0]?.reject(new Error('HTTP 404'));
    await settle();
    expect(notify).toHaveBeenCalledWith('Could not load the records: HTTP 404');
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(load.status()).toBe('failed');
    // Time plays on: each moment wants it, and none fetches it again.
    load.want();
    load.want();
    expect(fetch).toHaveBeenCalledTimes(1);

    const failed = load.report(true);
    expect(failed?.state).toBe('failed');
    if (failed?.state !== 'failed') return;
    failed.retry();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(load.report(true)).toEqual({ state: 'loading' });
    expect(refresh).toHaveBeenCalledTimes(2);
    fetches[1]?.resolve('data');
    await settle();
    expect(load.value()).toBe('data');
  });

  it('Given Try again from a chip read before the load ended, Then it does nothing', async () => {
    const { load, fetch, fetches, settle } = setUp();
    load.want();
    fetches[0]?.reject(new Error('offline'));
    await settle();
    const failed = load.report(true);
    if (failed?.state !== 'failed') throw new Error('expected a failed load');
    failed.retry();
    failed.retry();
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
