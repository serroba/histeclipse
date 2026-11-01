import { describe, expect, it } from 'vitest';

import served from '../../public/data/hip-stars.json';
import skyServed from '../../public/data/sky.json';
import babylonian from '../../public/skycultures/babylonian_mulapin/index.json';
import chinese from '../../public/skycultures/chinese/index.json';
import type { Fetch } from './fetchJson';
import { loadSky } from './sky';
import {
  CULTURE_INFO,
  cultureFigures,
  loadCultureIndex,
  loadHipStars,
  SKY_CULTURES,
  withFigureStars,
} from './skyCultures';

const serve =
  (body: unknown): Fetch =>
  () =>
    Promise.resolve(Response.json(body));

const sky = await loadSky('/x', serve(skyServed));
const hip = await loadHipStars('/x', serve(served));
const { sky: merged, index } = withFigureStars(sky, hip);

describe('figure stars', () => {
  it('reuse Bright Star Catalogue stars and add only the faint ones', () => {
    const added = merged.stars.hr.length - sky.stars.hr.length;
    expect(added).toBeGreaterThan(50);
    expect(added).toBeLessThan(200);
    // Arcturus (HIP 69673) is HR 5340, already drawn.
    expect(merged.stars.hr[index.get(69673) ?? -1]).toBe(5340);
    expect(merged.stars.ra).toHaveLength(merged.stars.hr.length);
  });

  it('rejects columns of different lengths', async () => {
    await expect(loadHipStars('/x', serve({ ...served, vmag: [1] }))).rejects.toThrow(
      'same length',
    );
  });
});

describe('cultureFigures', () => {
  it('draws the Babylonian Plough from the copied MUL.APIN file', async () => {
    const file = await loadCultureIndex('/x', serve(babylonian));
    const figures = cultureFigures('babylonian_mulapin', file, index);
    expect(figures).toHaveLength(58);
    const plough = figures.find(({ name }) => name === 'Plough');
    expect(plough?.native).toBe('𒀳');
    expect(plough?.lines.flat().length).toBeGreaterThan(5);
    expect(figures.every(({ rank }) => rank === 1)).toBe(true);
  });

  it('ranks the 28 Chinese lunar mansions first', async () => {
    const file = await loadCultureIndex('/x', serve(chinese));
    const mansions = cultureFigures('chinese', file, index).filter(({ rank }) => rank === 1);
    expect(mansions).toHaveLength(28);
  });

  it('breaks a run at anything that is not a known star', () => {
    const file = {
      constellations: [
        { id: 'X', lines: [[69673, 'DSO:NGC5139', 69673, 999_999_999, 69673]], common_name: {} },
      ],
    };
    const [figure] = cultureFigures('egyptian', file, index);
    expect(figure?.lines).toEqual([]);
    expect(figure?.name).toBe('X');
    expect(figure?.native).toBe('');
  });
});

const descriptions = import.meta.glob<string>('../../public/skycultures/*/description.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('CULTURE_INFO', () => {
  it('states the same licence as each copied culture’s own description', () => {
    for (const culture of SKY_CULTURES.filter((id) => id !== 'modern')) {
      const text = descriptions[`../../public/skycultures/${culture}/description.md`] ?? '';
      const stated = /## License\s+(.+)/.exec(text)?.[1]?.trim();
      expect(stated?.replace('GNU GPL v2.0', 'GNU GPL v2')).toBe(CULTURE_INFO[culture].licence);
    }
  });

  it('names every culture and gives a licence for each copied one', () => {
    for (const culture of SKY_CULTURES) {
      expect(CULTURE_INFO[culture].label).not.toBe('');
      if (culture !== 'modern') expect(CULTURE_INFO[culture].licence).not.toBe('');
    }
  });
});
