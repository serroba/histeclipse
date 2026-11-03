import { describe, expect, it } from 'vitest';

import claims from '../../public/data/humans/claims.json';
import pictures from '../../public/data/humans/pictures.json';
import { claimCard, humansAt, kaRange, loadHumanClaims, type HumanClaims } from './humanClaims';
import { loadPictures, pictureFor, type Pictures } from './pictures';

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

const fewPictures: Pictures = {
  schemaVersion: 1,
  credit: 'Wikipedia and Wikimedia Commons',
  made: '2026-11-04',
  pictures: {
    'Jebel Irhoud': {
      page: 'https://en.wikipedia.org/wiki/Jebel_Irhoud',
      image: {
        src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/H.jpg/320px-H.jpg',
        width: 320,
        height: 240,
        artist: 'Shannon McPherron',
        licence: 'CC BY-SA 2.0',
        licenceUrl: 'https://creativecommons.org/licenses/by-sa/2.0',
        filePage: 'https://commons.wikimedia.org/wiki/File:H.jpg',
      },
    },
    'Apidima Cave': { page: 'https://en.wikipedia.org/wiki/Apidima_Cave', image: null },
  },
};

describe('claimCard', () => {
  it('gives a find its claim, source, picture with credit, and Wikipedia', async () => {
    const card = claimCard(await load(), 'jebel-irhoud', fewPictures);
    expect(card).toEqual({
      title: 'Jebel Irhoud',
      facts: [
        ['Who', 'Homo sapiens'],
        ['Where', 'Morocco'],
        ['When', '281–349 ka (thousands of years ago)'],
        ['Claim', 'The oldest known fossils of our species, about 315,000 years old.'],
        ['Source', 'Hublin et al. 2017, Nature'],
      ],
      links: [
        { label: 'Hublin et al. 2017, Nature', href: 'https://doi.org/10.1038/nature22336' },
        { label: 'Wikipedia', href: 'https://en.wikipedia.org/wiki/Jebel_Irhoud' },
        {
          label: 'The picture and its licence',
          href: 'https://commons.wikimedia.org/wiki/File:H.jpg',
        },
      ],
      image: {
        src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/H.jpg/320px-H.jpg',
        alt: 'Jebel Irhoud',
        credit: 'Picture: Shannon McPherron, CC BY-SA 2.0, via Wikimedia Commons.',
      },
    });
  });

  it('names a disputed find’s question and its rivals; a page without a picture is a link', async () => {
    const card = claimCard(await load(), 'apidima', fewPictures);
    expect(card?.image).toBeUndefined();
    expect(card?.links.at(-1)).toEqual({
      label: 'Wikipedia',
      href: 'https://en.wikipedia.org/wiki/Apidima_Cave',
    });
    expect(card?.note).toMatch(
      /^One answer to “When did our species first leave Africa\?” Others: .*Hershkovitz et al\. 2018, Science/,
    );
  });

  it('has no picture or page before the pictures load, and no card for an unknown find', async () => {
    const data = await load();
    expect(claimCard(data, 'jebel-irhoud', null)?.links).toHaveLength(1);
    expect(claimCard(data, 'no-such-find', null)).toBeNull();
    expect(pictureFor(fewPictures, undefined, 'x')).toEqual({ links: [] });
    // A claim with no place is titled by what it says.
    expect(claimCard(data, 'neanderthal-end', null)?.title).toBe(
      'Neanderthals disappear from Europe about 39,000 to 41,000 years ago.',
    );
  });

  it('the real pictures file loads, with a picture for most finds', async () => {
    const real = await loadPictures('pictures.json', serve(pictures));
    const shown = Object.values(real.pictures).filter((entry) => entry.image !== null);
    expect(shown.length).toBeGreaterThan(10);
  });
});
