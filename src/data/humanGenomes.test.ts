import { describe, expect, it } from 'vitest';

import claims from '../../public/data/humans/claims.json';
import genomes from '../../public/data/humans/genomes.json';
import { genomeRows, genomesAt, loadHumanGenomes, type HumanGenomes } from './humanGenomes';

const serve = (body: unknown) => (): Promise<Response> => Promise.resolve(Response.json(body));

async function load(): Promise<HumanGenomes> {
  return loadHumanGenomes('genomes.json', serve(genomes));
}

describe('ancient DNA (#1047)', () => {
  it('loads, every sample at a find on the map, each once', async () => {
    const data = await load();
    expect(data.genomes.length).toBeGreaterThan(50);
    const sites = new Set(claims.claims.map((claim) => claim.id));
    for (const genome of data.genomes) expect(sites, genome.id).toContain(genome.site);
  });

  it('includes the high-coverage Neanderthal genomes, each with its data', async () => {
    const data = await load();
    const high = data.genomes.filter(
      (genome) => genome.species === 'neanderthal' && genome.data.includes('nuclear-high'),
    );
    expect(high.length).toBeGreaterThanOrEqual(3);
    expect(high.every((genome) => genome.repository !== null)).toBe(true);
  });

  it('refuses a sample twice, or a date half given', async () => {
    const [first] = genomes.genomes;
    if (first === undefined) throw new Error('no genome');
    await expect(
      loadHumanGenomes('x', serve({ ...genomes, genomes: [first, first] })),
    ).rejects.toThrow();
    await expect(
      loadHumanGenomes('x', serve({ ...genomes, genomes: [{ ...first, fromKa: 1, toKa: null }] })),
    ).rejects.toThrow();
  });

  it('gives a site’s card a row for each sample read there, oldest first, with its paper and data', async () => {
    const data = await load();
    const at = genomesAt(data, 'vindija');
    expect(at.length).toBeGreaterThan(0);
    const rows = genomeRows(data, 'vindija');
    expect(rows.facts[0]?.[0]).toBe('Ancient DNA');
    expect(rows.facts.some(([label]) => label.startsWith('DNA: Vindija'))).toBe(true);
    expect(rows.links.some((link) => link.label.endsWith(': the data'))).toBe(true);
    expect(genomeRows(data, 'jebel-irhoud')).toEqual({ facts: [], links: [] });
  });

  it('says an undated sample is not dated', async () => {
    const data = await load();
    const undated = data.genomes.find((genome) => genome.fromKa === null);
    if (undated === undefined) throw new Error('no undated sample');
    const row = genomeRows(data, undated.site).facts.find(
      ([label]) => label === `DNA: ${undated.label}`,
    );
    expect(row?.[1]).toMatch(/not dated/);
  });
});
