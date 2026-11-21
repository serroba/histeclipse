import { describe, expect, it } from 'vitest';

import admixture from '../../public/data/humans/admixture.json';
import claims from '../../public/data/humans/claims.json';
import {
  episodeCard,
  episodesAt,
  loadHumanAdmixture,
  traitCard,
  type HumanAdmixture,
} from './humanAdmixture';

const serve = (body: unknown) => (): Promise<Response> => Promise.resolve(Response.json(body));

async function load(): Promise<HumanAdmixture> {
  return loadHumanAdmixture('admixture.json', serve(admixture));
}

describe('interbreeding (#1047)', () => {
  it('loads, every episode with at least one estimate and every find it names on the map', async () => {
    const data = await load();
    expect(data.episodes.length).toBeGreaterThan(5);
    const ids = new Set(claims.claims.map((claim) => claim.id));
    for (const episode of data.episodes) {
      expect(episode.estimates.length).toBeGreaterThan(0);
      for (const find of episode.finds) expect(ids, `${episode.id}: ${find}`).toContain(find);
    }
  });

  it('refuses a window half given, or running backwards', async () => {
    const [first] = admixture.episodes;
    if (first === undefined) throw new Error('no episode');
    const half = { ...admixture, episodes: [{ ...first, fromKa: 50, toKa: null }] };
    await expect(loadHumanAdmixture('x', serve(half))).rejects.toThrow();
    const backwards = { ...admixture, episodes: [{ ...first, fromKa: 40, toKa: 50 }] };
    await expect(loadHumanAdmixture('x', serve(backwards))).rejects.toThrow();
  });

  it('gives the episodes reached: the dated from their window’s start, the undated always', async () => {
    const data = await load();
    const at = (ka: number) => episodesAt(data, ka).map((episode) => episode.id);
    expect(at(30)).toContain('recent-neanderthal-ancestors-early-europeans');
    expect(at(60)).not.toContain('recent-neanderthal-ancestors-early-europeans');
    expect(at(500)).toContain('extra-neanderthal-ancestry-east-asia');
  });

  it('gives an episode its card: who into whom, when, the estimates side by side, the evidence', async () => {
    const card = episodeCard(await load(), 'recent-neanderthal-ancestors-early-europeans');
    const labels = card?.facts.map(([label]) => label) ?? [];
    expect(labels.slice(0, 2)).toEqual(['Who', 'When']);
    expect(card?.facts[0]?.[1]).toBe('From Neanderthals into Homo sapiens');
    expect(labels.filter((label) => label === 'Estimate').length).toBeGreaterThan(1);
    expect(card?.finds).toContain('oase');
    const hrefs = card?.links.map((link) => link.href) ?? [];
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(card?.note).toMatch(/^Inferred from DNA/);
    expect(episodeCard(await load(), 'nowhere')).toBeNull();
  });

  it('says an undated episode is not dated, and names a line among themselves', async () => {
    const data = await load();
    expect(episodeCard(data, 'extra-neanderthal-ancestry-east-asia')?.facts[1]).toEqual([
      'When',
      'Not dated',
    ]);
    expect(episodeCard(data, 'thorin-isolated-lineage')?.facts[0]?.[1]).toBe(
      'Neanderthals, among themselves',
    );
  });

  it('names a study challenging a trait as such', async () => {
    const data = await load();
    const [trait] = data.traits;
    if (trait === undefined) throw new Error('no trait');
    const challenged = {
      ...data,
      traits: [
        {
          ...trait,
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
    expect(traitCard(challenged, trait.id)?.facts[1]).toEqual([
      'Challenges (genetic)',
      'Not so. (B 2021)',
    ]);
  });

  it('gives a trait its card, with the studies of it', async () => {
    const data = await load();
    const card = traitCard(data, 'covid-19');
    expect(card?.title).toMatch(/COVID-19/);
    expect(card?.facts[0]?.[0]).toBe('What');
    expect(card?.links.length).toBeGreaterThan(0);
    expect(traitCard(data, 'nowhere')).toBeNull();
  });
});
