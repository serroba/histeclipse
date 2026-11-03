import { describe, expect, it } from 'vitest';

import data from '../../public/data/impacts.json';
import {
  impactDetails,
  impactsAt,
  impactsText,
  loadImpacts,
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
