import { describe, expect, it } from 'vitest';

import { elementAt } from '../util/arrays';

import data from '../../public/data/eruptions.json';
import {
  eruptionsBetween,
  eruptionText,
  LARGEST_SULFUR,
  loadEruptions,
  type Eruptions,
} from './eruptions';

const serve = (body: unknown) => (): Promise<Response> => Promise.resolve(Response.json(body));
const real = data as Eruptions;

describe('the Holocene’s eruptions in the ice cores (HolVol)', () => {
  it('loads and checks the real file, and refuses a broken one', async () => {
    await expect(loadEruptions('/e.json', serve(real))).resolves.toEqual(real);
    await expect(
      loadEruptions('/e.json', serve({ ...real, sulfur: real.sulfur.slice(1) })),
    ).rejects.toThrow();
    await expect(
      loadEruptions('/e.json', serve({ ...real, year: [...real.year].reverse() })),
    ).rejects.toThrow();
    await expect(
      loadEruptions('/e.json', serve({ ...real, region: [9, ...real.region.slice(1)] })),
    ).rejects.toThrow();
  });

  it('runs from 9500 BCE to 1900 CE, its largest within the ticks’ scale', () => {
    expect(real.year[0]).toBeLessThan(-9400);
    expect(real.year.at(-1)).toBeLessThanOrEqual(1900);
    expect(Math.max(...real.sulfur)).toBeLessThanOrEqual(LARGEST_SULFUR);
  });

  it('names Samalas and Tambora, and says Samalas’s two dates', () => {
    const named = eruptionsBetween(real, 1200, 1900).filter(({ name }) => name !== null);
    expect(named.map(({ name, year }) => `${name ?? ''} ${String(year)}`)).toEqual([
      'Samalas 1258',
      'Tambora 1815',
    ]);
    const [samalas] = named;
    if (samalas === undefined) throw new Error('Samalas missing');
    expect(eruptionText(samalas)).toMatch(
      /^1258 CE: Samalas, 75\.\d ± \d+\.\d Tg of sulfur into the stratosphere\. .*1257/,
    );
  });

  it('says where the unnamed ones were, as the ice cores place them', () => {
    const all = eruptionsBetween(real, -10_000, 2000);
    expect(all).toHaveLength(real.year.length);
    const text = (region: string) =>
      eruptionText(all.find((eruption) => eruption.region === region) ?? elementAt(all, 0));
    expect(text('tropics')).toContain('in the tropics');
    expect(text('north')).toContain('northern');
    expect(text('south')).toContain('southern');
    expect(text('iceland')).toContain('Iceland');
    expect(text('located')).toMatch(/identified, near \d+° [NS]/);
    expect(eruptionText({ ...elementAt(all, 0), year: 0 })).toMatch(/^1 BCE/);
  });
});
