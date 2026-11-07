import { describe, expect, it } from 'vitest';

import data from '../../public/data/impacts.json';
import {
  AROUND_MA,
  impactDetails,
  impactsAt,
  impactsText,
  loadImpacts,
  STRIKE_MIN_KM,
  strikeMa,
  strikesPassed,
  type Impact,
  type Impacts,
} from './impacts';

const serve = (body: unknown) => (): Promise<Response> => Promise.resolve(Response.json(body));

const chicxulub: Impact = {
  id: 47,
  kind: 'hypervelocity',
  name: 'Chicxulub',
  country: 'Mexico',
  region: 'Yucatán',
  target: 'Mixed (Carbonates, Crystalline)',
  age: '66.038 ± 0.098',
  olderMa: 66.136,
  youngerMa: 65.94,
  diameterKm: 180,
  // Today, then 5 Ma back across the antimeridian (to show the short way round), then no plate.
  then: [[2140, 17900], [2000, -17900], null],
};

const small: Impacts = {
  schemaVersion: 1,
  credit: 'Impact Earth',
  source: 'https://impact.uwo.ca',
  accessed: '2026-11-04',
  stepMa: 5,
  scale: 100,
  impacts: [
    chicxulub,
    {
      id: 9,
      kind: 'crater',
      name: 'Kaali',
      country: 'Estonia',
      region: 'Saaremaa',
      target: '',
      age: '~0.0035',
      olderMa: 0.0035,
      youngerMa: 0.0035,
      diameterKm: 0.11,
      then: [
        [5840, 2266],
        [5800, 2200],
      ],
    },
    {
      id: 300,
      kind: 'deposit',
      name: 'Undated bed',
      country: '',
      region: '',
      target: 'Not Applicable',
      age: 'Middle Cambrian',
      olderMa: null,
      youngerMa: null,
      diameterKm: null,
      then: [[0, 0]],
    },
  ],
  leftOut: [{ name: 'S6', kind: 'deposit', why: 'its place is not in South Africa' }],
};

describe('impacts', () => {
  it('load and check, the real file too', async () => {
    await expect(loadImpacts('/i.json', serve(small))).resolves.toEqual(small);
    const real = await loadImpacts('/i.json', serve(data));
    expect(real.impacts.length).toBeGreaterThan(200);
    expect(real.impacts.find((impact) => impact.name === 'Chicxulub')?.diameterKm).toBe(180);
  });

  it('today marks every impact where it is, the undated too, largest first', () => {
    const marks = impactsAt(small, 0, true);
    expect(marks.map((mark) => mark.impact.name)).toEqual(['Chicxulub', 'Kaali', 'Undated bed']);
    expect(marks[0]?.point).toEqual({ latitude: 21.4, longitude: 179 });
  });

  it('in deep time, those that may have struck, where they lay, between the steps', () => {
    const marks = impactsAt(small, 2.5);
    expect(marks.map((mark) => mark.impact.name)).toEqual(['Chicxulub']);
    // Half way to 5 Ma, the short way across the antimeridian: from 179° to 181° (-179°).
    expect(marks[0]?.point.latitude).toBeCloseTo(20.7);
    expect(marks[0]?.point.longitude).toBeCloseTo(-180);
    expect(marks[0]?.uncertain).toBe(false);
  });

  it('within its age range, an impact may not have struck yet', () => {
    expect(impactsAt(small, 66)).toEqual([]); // on no plate then, in this made-up file
    const span: Impacts = {
      ...small,
      impacts: [{ ...chicxulub, then: [[2140, -8952]], olderMa: 3, youngerMa: 1 }],
    };
    expect(impactsAt(span, 2)[0]?.uncertain).toBe(true);
    expect(impactsAt(span, 0.5)[0]?.uncertain).toBe(false);
    expect(impactsAt(span, 4)).toEqual([]);
  });

  it('says what it marks, today and then', () => {
    expect(impactsText(small, impactsAt(small, 0, true), null)).toBe(
      '3 impact craters and deposits, from the Impact Earth Database, where they are today. Tap one for its details. 1 left out: S6, its place is not in South Africa.',
    );
    const span: Impacts = {
      ...small,
      leftOut: [],
      impacts: [
        { ...chicxulub, then: [[2140, -8952]], olderMa: 3, youngerMa: 1 },
        { ...chicxulub, id: 2, then: [[2140, -8952]], olderMa: 3, youngerMa: 3 },
      ],
    };
    expect(impactsText(span, impactsAt(span, 2), 2)).toBe(
      'Impacts by 2,000,000 years ago: 1 had struck, and 1 more may have (their ages span this moment), each where it lay then. Ages as the Impact Earth Database gives them.',
    );
    expect(impactsText(span, impactsAt(span, 0.5), 0.5)).toBe(
      'Impacts by 500,000 years ago: 2 had struck, each where it lay then. Ages as the Impact Earth Database gives them.',
    );
  });

  it('gives a card its details, with the age as written', () => {
    const [crater, kaali, bed] = small.impacts;
    expect(crater && impactDetails(crater)).toEqual({
      title: 'Chicxulub',
      facts: [
        ['Kind', 'Impact crater (shock metamorphism found)'],
        ['Where', 'Yucatán, Mexico'],
        ['Diameter', '180 km'],
        ['Age', '66.038 ± 0.098 million years ago'],
        ['Target rock', 'Mixed (Carbonates, Crystalline)'],
      ],
      link: {
        label: 'Impact Earth Database',
        href: 'https://impact.uwo.ca/impact-craters/map/?crater_id=47',
      },
    });
    expect(kaali && impactDetails(kaali).facts).toEqual([
      ['Kind', 'Impact crater (meteorite fragments found)'],
      ['Where', 'Saaremaa, Estonia'],
      ['Diameter', '0.11 km'],
      ['Age', '~0.0035 million years ago'],
    ]);
    expect(bed && impactDetails(bed).facts).toEqual([
      ['Kind', 'Impact deposit'],
      ['Age', 'Middle Cambrian'],
    ]);
    expect(bed && impactDetails({ ...bed, age: '' }).facts.at(-1)).toEqual(['Age', 'not given']);
  });
});

describe('impacts around their time', () => {
  // Each with today's place only, so placed as today (placeMa 0).
  const dated: Impacts = {
    ...small,
    impacts: [
      // Dated closely: shown 2.5 million years either side of its range.
      { ...chicxulub, then: [[2140, -8952]], olderMa: 66.136, youngerMa: 65.94 },
      // Dated only to a span of 40 million years: shown across it, as loosely dated.
      { ...chicxulub, id: 2, name: 'Wide', then: [[0, 0]], olderMa: 100, youngerMa: 60 },
    ],
  };

  it('shows an impact near its dated age, not before, not long after', () => {
    const names = (ma: number) =>
      impactsAt(dated, ma, false, 0, 'around').map((mark) => mark.impact.name);
    expect(names(66)).toEqual(['Chicxulub', 'Wide']);
    expect(names(66.136 + AROUND_MA - 0.01)).toEqual(['Chicxulub', 'Wide']);
    expect(names(62)).toEqual(['Wide']);
    expect(names(57)).toEqual([]);
    expect(names(103)).toEqual([]);
    // Every one that had struck by then, as before.
    expect(impactsAt(dated, 20, false, 0, 'struck')).toHaveLength(2);
  });

  it('marks the loosely dated as uncertain, and says how many', () => {
    const marks = impactsAt(dated, 66, false, 0, 'around');
    expect(marks.map((mark) => mark.uncertain)).toEqual([false, true]);
    expect(impactsText(dated, marks, 66, 'around')).toBe(
      'Impacts around 66 million years ago: 2 whose dated age falls within 2.5 million years of then, each where it lay; 1 of them dated only to a span of more than 10 million years (dashed). Ages as the Impact Earth Database gives them.',
    );
    expect(
      impactsText(dated, impactsAt(dated, 66, false, 0, 'around').slice(0, 1), 66, 'around'),
    ).toBe(
      'Impacts around 66 million years ago: 1 whose dated age falls within 2.5 million years of then, each where it lay. Ages as the Impact Earth Database gives them.',
    );
    expect(impactsText(dated, [], 30, 'around')).toBe(
      'No impacts dated to within 2.5 million years of 30 million years ago.',
    );
  });

  it('today shows every impact whatever the mode', () => {
    expect(impactsAt(dated, 0, true, 0, 'around')).toHaveLength(2);
  });
});

describe('strikes as time plays', () => {
  const real = data as Impacts;
  const named = (impacts: readonly Impact[]): string[] => impacts.map(({ name }) => name);

  it('strike in the middle of a tight dating, and not at all when dated loosely or in words', () => {
    expect(strikeMa(chicxulub)).toBeCloseTo(66.038, 6);
    const loose = real.impacts.find(({ name }) => name === 'Woodleigh');
    expect(loose).toBeDefined();
    if (loose !== undefined) expect(strikeMa(loose)).toBeNull();
    expect(strikeMa(small.impacts[2] ?? chicxulub)).toBeNull();
  });

  it('play Chicxulub as time runs through 66 Ma towards today, but not running back', () => {
    expect(named(strikesPassed(small, 66.1, 66))).toEqual(['Chicxulub']);
    expect(named(strikesPassed(small, 66, 65))).toEqual([]);
    expect(named(strikesPassed(small, 66, 66.1))).toEqual([]);
  });

  it('leave small craters to appear without a strike', () => {
    expect(named(strikesPassed(small, 1, 0))).toEqual([]);
    expect(named(strikesPassed(small, 1, 0, 0.1))).toEqual(['Kaali']);
  });

  it('come in the order they struck, the great ones only, from the real file', () => {
    const all = strikesPassed(real, 3000, 0);
    expect(all.every(({ diameterKm }) => (diameterKm ?? 0) >= STRIKE_MIN_KM)).toBe(true);
    expect(named(all).slice(0, 2)).toEqual(['Yarrabubba', 'Vredefort']);
    expect(named(all)).toContain('Chicxulub');
    expect(named(all)).not.toContain('Woodleigh');
    expect(named(strikesPassed(real, 70, 30))).toEqual([
      'Chicxulub',
      'Montagnais',
      'Popigai',
      'Chesapeake Bay',
    ]);
  });
});
