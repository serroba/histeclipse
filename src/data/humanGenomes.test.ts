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

  it('writes each sample’s details where known, and leaves out what is not', () => {
    const source = { citation: 'A et al. 2020, Nature', doi: '10.1/a' };
    const base = {
      id: 'one',
      label: 'One',
      species: 'neanderthal' as const,
      site: 'here',
      fromKa: 50,
      toKa: 40,
      data: ['mtDNA' as const, 'Y' as const],
      coverage: null,
      sex: null,
      mtHaplo: null,
      yHaplo: null,
      showed: 'It showed something.',
      source,
      repository: null,
    };
    const data = {
      schemaVersion: 1 as const,
      about: 'Test',
      genomes: [
        base,
        {
          ...base,
          id: 'two',
          label: 'Two',
          fromKa: 60,
          toKa: 55,
          coverage: '30x',
          sex: 'male' as const,
          mtHaplo: 'NL',
          yHaplo: 'A00',
          dating: 'Radiocarbon.',
          note: 'A preprint.',
          repository: 'https://example.org/two',
          evidence: [
            {
              stance: 'challenges' as const,
              kind: 'genetic' as const,
              text: 'Not so.',
              source: { citation: 'B 2021', doi: '10.1/b' },
            },
          ],
        },
      ],
    };
    const rows = genomeRows(data, 'here');
    expect(rows.facts).toEqual([
      ['Ancient DNA', '2 samples read here.'],
      [
        'DNA: Two',
        'mitochondrial DNA, Y chromosome (30x coverage, male, mtDNA NL, Y A00, 55–60 ka). It showed something. (A et al. 2020, Nature) Dated: Radiocarbon. A preprint.',
      ],
      ['Challenges (Two)', 'Not so. (B 2021)'],
      [
        'DNA: One',
        'mitochondrial DNA, Y chromosome (40–50 ka). It showed something. (A et al. 2020, Nature)',
      ],
    ]);
    expect(rows.links.map((link) => link.label)).toEqual([
      'A et al. 2020, Nature',
      'B 2021',
      'Two: the data',
      'A et al. 2020, Nature',
    ]);
    expect(genomeRows({ ...data, genomes: [base] }, 'here').facts[0]).toEqual([
      'Ancient DNA',
      '1 sample read here.',
    ]);
  });
});
