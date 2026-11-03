import { describe, expect, it } from 'vitest';

import claims from '../../public/data/humans/claims.json';
import { humansAt, kaRange, loadHumanClaims, type HumanClaims } from './humanClaims';

const serve = (body: unknown) => (): Promise<Response> => Promise.resolve(Response.json(body));

async function load(): Promise<HumanClaims> {
  return loadHumanClaims('claims.json', serve(claims));
}

describe('the curated human claims', () => {
  it('load and check', async () => {
    const data = await load();
    expect(data.claims.length).toBeGreaterThan(10);
  });

  it('give every question at least two competing claims', async () => {
    const data = await load();
    for (const question of data.questions) {
      expect(data.claims.filter((claim) => claim.question === question.id).length).toBeGreaterThan(
        1,
      );
    }
  });

  it('name each claim once', async () => {
    const data = await load();
    const ids = data.claims.map((claim) => claim.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('refuse a date that runs backwards, or an unlisted question', async () => {
    const backwards = { ...claims, claims: [{ ...claims.claims[0], fromKa: 1, toKa: 2 }] };
    await expect(loadHumanClaims('x', serve(backwards))).rejects.toThrow();
    const unlisted = { ...claims, claims: [{ ...claims.claims[0], question: 'nowhere' }] };
    await expect(loadHumanClaims('x', serve(unlisted))).rejects.toThrow();
  });
});

describe('humansAt', () => {
  it('marks each find from its oldest date on, flagging disputed ones', async () => {
    const data = await load();
    const at60 = humansAt(data, 60);
    const madjedbebe = at60.sites.find((site) => site.id === 'madjedbebe');
    expect(madjedbebe?.label).toBe('Madjedbebe 59–71 ka');
    expect(madjedbebe?.disputed).toBe(true);
    expect(at60.sites.some((site) => site.id === 'clovis')).toBe(false);
    expect(humansAt(data, 100).sites.some((site) => site.id === 'madjedbebe')).toBe(false);
  });

  it('gives a question with every competing claim, once one is reached', async () => {
    const data = await load();
    const australia = humansAt(data, 60).questions.find((q) => q.title.includes('Australia'));
    expect(australia?.claims.map((claim) => claim.citation)).toEqual([
      'Clarkson et al. 2017, Nature',
      'O’Connell et al. 2018, PNAS',
    ]);
    expect(australia?.claims.map((claim) => claim.reached)).toEqual([true, false]);
    expect(humansAt(data, 80).questions.some((q) => q.title.includes('Australia'))).toBe(false);
  });

  it('lists placeless claims without rivals once reached', async () => {
    const data = await load();
    expect(humansAt(data, 30).others.map((claim) => claim.citation)).toContain(
      'Higham et al. 2014, Nature',
    );
    expect(humansAt(data, 50).others).toEqual([]);
  });
});

describe('kaRange', () => {
  it('reads as one date or a range, youngest first', () => {
    expect(kaRange(233, 233)).toBe('233 ka');
    expect(kaRange(13.05, 12.75)).toBe('12.75–13.05 ka');
  });
});
