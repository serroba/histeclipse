import { describe, expect, it, vi } from 'vitest';

import { retryingFetch } from './fetchJson';

const answer = (status: number): Response => new Response('{}', { status });

describe('a data file asked once more after a server error', () => {
  it('Given a 503, Then it is asked again past the browser’s copy, and that answer kept', async () => {
    const raw = vi.fn().mockResolvedValueOnce(answer(503)).mockResolvedValueOnce(answer(200));
    const response = await retryingFetch(raw)('data/solar/index.json');
    expect(response.status).toBe(200);
    expect(raw.mock.calls).toEqual([
      ['data/solar/index.json'],
      ['data/solar/index.json', { cache: 'reload' }],
    ]);
  });

  it('Given a success or a 404, Then it is not asked again', async () => {
    for (const status of [200, 404]) {
      const raw = vi.fn().mockResolvedValue(answer(status));
      expect((await retryingFetch(raw)('a.json')).status).toBe(status);
      expect(raw).toHaveBeenCalledOnce();
    }
  });
});
