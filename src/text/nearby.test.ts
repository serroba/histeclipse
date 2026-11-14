import { describe, expect, it } from 'vitest';

import data from '../../public/data/passages.json';
import { nearby, type Here } from './nearby';
import { loadPassages, type Passage } from './passages';

const serve = (body: unknown) => () => Promise.resolve(new Response(JSON.stringify(body)));
const { passages } = await loadPassages('passages.json', serve(data));
const ids = (here: Here, limit?: number) => nearby(passages, here, limit).map((n) => n.passage.id);

describe('what is written about here', () => {
  it('Given the Moon seen over Tranquillity in July 1969, Then Apollo 11 comes first', () => {
    const here: Here = {
      body: 'moon',
      target: { latitude: 0.7, longitude: 23.4 },
      distance: 1.8,
      year: 1969,
    };
    const [first] = nearby(passages, here);
    expect(first?.passage.title).toMatch(/^Apollo 11: /);
    expect(first?.anchor.body).toBe('moon');
  });

  it('Given Io in view, Then its own story is there, and nothing of Earth', () => {
    const found = ids({
      body: 'io',
      target: { latitude: 0, longitude: 0 },
      distance: 3,
      year: 2026,
    });
    expect(found).toEqual(['moon:io']);
  });

  it('Given Earth over Syria in 1223 BCE, Then the Ugarit eclipse is first; over the Pacific, it is not there', () => {
    const syria = { latitude: 35, longitude: 36 };
    expect(ids({ body: 'earth', target: syria, distance: 3, year: -1222 })[0]).toBe(
      'eclipse:ugarit-1223-bce',
    );
    expect(
      ids({ body: 'earth', target: { latitude: 0, longitude: -160 }, distance: 1.5, year: -1222 }),
    ).not.toContain('eclipse:ugarit-1223-bce');
  });

  it('Given deep time, Then passages tied to a year are not there', () => {
    expect(
      ids({ body: 'earth', target: { latitude: 35, longitude: 36 }, distance: 3, year: null }),
    ).toEqual([]);
  });

  it('Given a passage far from the moment shown, Then it counts for less than one at it', () => {
    const at = (year: number): Passage => ({
      id: `eclipse:y${String(year)}`,
      kind: 'eclipse',
      title: String(year),
      text: 'x',
      sources: [],
      anchors: [{ body: 'earth', at: [0, 0], when: [year, year], view: '' }],
    });
    const here: Here = {
      body: 'earth',
      target: { latitude: 0, longitude: 0 },
      distance: 3,
      year: 500,
    };
    const found = nearby([at(1300), at(500), at(400), at(2500)], here);
    // Two thousand years off, it is not here at all.
    expect(found.map((n) => n.passage.id)).toEqual([
      'eclipse:y500',
      'eclipse:y400',
      'eclipse:y1300',
    ]);
    expect(found[1]?.score).toBeCloseTo(0.5, 6);
    // Equally fitting, they come in the order of their names.
    const twin = { ...at(500), id: 'eclipse:a' };
    expect(nearby([at(500), twin], here).map((n) => n.passage.id)).toEqual([
      'eclipse:a',
      'eclipse:y500',
    ]);
    // A camera on the ground still sees its own point.
    expect(nearby([at(500)], { ...here, distance: 1 })).toHaveLength(1);
  });

  it('Given many passages here, Then no more than asked for, and no whys', () => {
    const found = nearby(
      passages,
      {
        body: 'moon',
        target: { latitude: 0, longitude: 0 },
        distance: 50,
        year: 1970,
      },
      3,
    );
    expect(found).toHaveLength(3);
    expect(found.every((n) => n.passage.kind !== 'why')).toBe(true);
  });

  it('Given the Sun in the years craft flew, Then no mission crowds in: they are found by search (#712)', () => {
    const found = nearby(passages, {
      body: 'sun',
      target: { latitude: 0, longitude: 0 },
      distance: 2000,
      year: 1980,
    });
    expect(found.filter(({ passage }) => passage.kind === 'mission')).toEqual([]);
  });
});
