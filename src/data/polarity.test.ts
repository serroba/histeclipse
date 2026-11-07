import { describe, expect, it } from 'vitest';

import data from '../../public/data/polarity.json';
import { chronAt, loadPolarity, scaleEnd, scalePolarity, type PolarityScale } from './polarity';

const serve = (body: unknown) => (): Promise<Response> => Promise.resolve(Response.json(body));
const real = data as PolarityScale;

describe('the polarity time scale', () => {
  it('loads and checks the real file', async () => {
    await expect(loadPolarity('/p.json', serve(real))).resolves.toEqual(real);
    await expect(
      loadPolarity('/p.json', serve({ ...real, boundaries: [0.5, 1] })),
    ).rejects.toThrow();
  });

  it('reaches back to the start of the Cretaceous Normal Superchron, about 83 Ma', () => {
    expect(scaleEnd(real)).toBeGreaterThan(82);
    expect(scaleEnd(real)).toBeLessThan(84);
  });

  it('has today normal, reversed before the Brunhes–Matuyama reversal (0.773 Ma)', () => {
    expect(scalePolarity(real, 0)).toBe('normal');
    expect(scalePolarity(real, 0.5)).toBe('normal');
    expect(scalePolarity(real, 0.8)).toBe('reversed');
    expect(chronAt(real, 0.5)).toBe('C1n');
    expect(chronAt(real, 0.8)).toBe('C1r');
  });

  it('puts the Chicxulub impact, 66 Ma, in the reversed chron C29r', () => {
    expect(chronAt(real, 66.04)).toBe('C29r');
    expect(scalePolarity(real, 66.04)).toBe('reversed');
  });

  it('says nothing beyond its reach', () => {
    expect(scalePolarity(real, 100)).toBeNull();
    expect(chronAt(real, 100)).toBeNull();
    expect(scalePolarity(real, -1)).toBeNull();
    expect(chronAt(real, -1)).toBeNull();
    expect(scalePolarity(real, scaleEnd(real))).toBe('reversed');
  });
});
