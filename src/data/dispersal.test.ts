import { describe, expect, it } from 'vitest';

import index from '../../public/data/dispersal/index.json';
import { loadDispersalIndex, settledShare } from './dispersal';

const serve = (body: unknown) => (): Promise<Response> => Promise.resolve(Response.json(body));

describe('the dispersal model', () => {
  it('loads its index, licence and both scenarios', async () => {
    const loaded = await loadDispersalIndex('index.json', serve(index));
    expect(loaded.license).toBe('CC BY-NC 4.0');
    expect(loaded.scenarios.map((scenario) => scenario.id)).toEqual(['a', 'b']);
    await expect(loadDispersalIndex('x', serve({ ...index, license: 'MIT' }))).rejects.toThrow();
  });

  it('counts the share settled by a moment among the cells ever settled', () => {
    const grid = { columns: 4, rows: 1, arrival: Uint8Array.from([0, 120, 60, 10]) };
    expect(settledShare(grid, 125)).toBe(0);
    expect(settledShare(grid, 60)).toBeCloseTo(2 / 3);
    expect(settledShare(grid, 1)).toBe(1);
    expect(settledShare({ columns: 1, rows: 1, arrival: Uint8Array.from([0]) }, 5)).toBe(0);
  });
});
