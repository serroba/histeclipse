import { describe, expect, it } from 'vitest';

import type { WaysAt } from '../../data/waysOfLife';
import { waysFact } from './here';

const here = { latitude: 32.5, longitude: 51.7 };
const plateau: WaysAt = {
  year: -550,
  counts: { foraging: 0, pastoralism: 0, extensive: 1, intensive: 0, urban: 0, mixed: 0 },
  regions: [
    {
      name: 'Iranian Plateau',
      rings: [
        [
          [50, 30],
          [54, 30],
          [54, 34],
          [50, 34],
        ],
      ],
      way: 'extensive',
      ways: ['extensive'],
      level: 3,
    },
  ],
};

describe('the ways of life at a place', () => {
  it('gives the region rated there, how, and how strongly', () => {
    expect(waysFact(plateau, here, '550 BCE')).toEqual({
      title: 'Ways of life',
      text: 'Iranian Plateau: farming, widespread, as archaeologists rated it for 550 BCE.',
      why: 'ways',
    });
  });

  it('says when no region is rated there', () => {
    const fact = waysFact(plateau, { latitude: -40, longitude: 170 }, '550 BCE');
    expect(fact.text).toBe('ArchaeoGLOBE rates no region here for 550 BCE.');
    expect(fact.why).toBe('ways');
  });
});
