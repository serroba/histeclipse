import { describe, expect, it } from 'vitest';

import { rockFact } from './here';

describe('the rock at a place', () => {
  it('names the unit, its rock and its age', () => {
    expect(
      rockFact({
        name: 'Cenozoic sediments',
        lith: 'sedimentary rocks',
        topMa: 0,
        bottomMa: 66,
        colour: '#fff',
        rings: [],
      }),
    ).toEqual({
      title: 'Rocks',
      text: 'Cenozoic sediments: sedimentary rocks, from 66 to 0 million years ago.',
      why: 'rocks',
    });
  });

  it('says when the map has no unit there', () => {
    expect(rockFact(null).text).toBe('No map unit of Macrostrat’s here.');
  });
});
