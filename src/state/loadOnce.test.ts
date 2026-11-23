import { describe, expect, it, vi } from 'vitest';

import { loadOnce, reportAll } from './loadOnce';

function setUp(retryInNotice?: boolean) {
  const fetches: { resolve: (value: string) => void; reject: (error: Error) => void }[] = [];
  const fetch = vi.fn(
    () =>
      new Promise<string>((resolve, reject) => {
        fetches.push({ resolve, reject });
      }),
  );
  const notify = vi.fn();
  const refresh = vi.fn();
  const load = loadOnce({
    fetch,
    what: 'the records',
    context: { notify, refresh },
    ...(retryInNotice !== undefined && { retryInNotice }),
  });
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

describe('a part with no chip (#1130)', () => {
  it('Given the fetch fails, Then the notice offers Try again, which fetches it again', async () => {
    const { load, fetch, fetches, notify, settle } = setUp(true);
    load.want();
    fetches[0]?.reject(new Error('HTTP 503'));
    await settle();
    expect(notify).toHaveBeenCalledWith(
      'Could not load the records: HTTP 503',
      expect.any(Function),
    );
    load.want();
    expect(fetch).toHaveBeenCalledTimes(1);
    const retry = notify.mock.calls[0]?.[1] as () => void;
    retry();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(load.status()).toBe('loading');
  });

  it('Given a layer with a chip, Then its notice offers none: the chip does', async () => {
    const { load, fetches, notify, settle } = setUp();
    load.want();
    fetches[0]?.reject(new Error('HTTP 503'));
    await settle();
    expect(notify.mock.calls[0]).toHaveLength(1);
  });
});

describe('one chip for several files (#762)', () => {
  const quiet = { notify: vi.fn(), refresh: vi.fn() };
  const pending = () => new Promise<string>(() => undefined);
  const settle = async (): Promise<void> => {
    for (let turn = 0; turn < 3; turn++) await Promise.resolve();
  };

  it('Given none asked for, Then nothing; one loading, Then loading', () => {
    const a = loadOnce({ fetch: pending, what: 'a', context: quiet });
    const b = loadOnce({ fetch: pending, what: 'b', context: quiet });
    expect(reportAll(true, [a, b])).toBeNull();
    a.want();
    expect(reportAll(true, [a, b])).toEqual({ state: 'loading' });
    expect(reportAll(false, [a, b])).toBeNull();
  });

  it('Given one failed and one loading, Then failed, and Try again retries the failed one', async () => {
    const failing = vi.fn(() => Promise.reject(new Error('offline')));
    const a = loadOnce({ fetch: failing, what: 'a', context: quiet });
    const b = loadOnce({ fetch: pending, what: 'b', context: quiet });
    a.want();
    b.want();
    await settle();
    const report = reportAll(true, [a, b]);
    if (report?.state !== 'failed') throw new Error('expected a failed load');
    report.retry();
    expect(failing).toHaveBeenCalledTimes(2);
  });
});
