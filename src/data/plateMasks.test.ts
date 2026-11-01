import { describe, expect, it } from 'vitest';

import index from '../../public/data/plates/index.json';
import type { Fetch } from './fetchJson';
import { framesAround } from './paleoDem';
import { loadPlateMasks, platesBeyondText, plateText } from './plateMasks';

const serve =
  (body: unknown): Fetch =>
  () =>
    Promise.resolve(Response.json(body));

describe('the continent masks', () => {
  it('reach back 1.8 billion years every 5 million, credited', async () => {
    const loaded = await loadPlateMasks('/x', serve(index));
    expect(loaded.frames).toHaveLength(361);
    expect(loaded.frames.at(-1)?.ma).toBe(1800);
    expect(loaded.credit).toContain('CC BY 4.0');
    // Less crust survives to be carried back the further back one goes.
    expect(loaded.frames.at(-1)?.continents ?? 1).toBeLessThan(loaded.frames[0]?.continents ?? 0);
  });

  it('blend like the other deep-time maps', async () => {
    const loaded = await loadPlateMasks('/x', serve(index));
    const between = framesAround(loaded.frames, 252);
    expect([between.younger.file, between.older.file]).toEqual(['250.png', '255.png']);
  });

  it('carry how they line up with the surface map, where it reaches', async () => {
    const loaded = await loadPlateMasks('/x', serve(index));
    const at100 = loaded.frames.find(({ ma }) => ma === 100);
    expect(at100?.turn).toBe(-8);
    expect(at100 && plateText(at100)).toMatch(
      /Turned 8° west to line up with the surface map: rock magnetism fixes latitude, not longitude.*87% of the surface map’s land lies inside them \(80% as published\)/,
    );
    const today = loaded.frames[0];
    expect(today && plateText(today)).toContain('They line up with the surface map as published.');
    const old = loaded.frames.find(({ ma }) => ma === 1000);
    expect(old?.turn).toBeUndefined();
    expect(old && plateText(old)).toContain('No surface map reaches this far');
  });

  it('say how far back they reach, beyond the oldest', () => {
    expect(platesBeyondText(1800)).toBe(
      'The continent outlines (Cao et al. 2024) reach back 1,800 million years; none are drawn before.',
    );
  });

  it('reject frames out of order', async () => {
    const shuffled = { ...index, frames: [...index.frames].reverse() };
    await expect(loadPlateMasks('/x', serve(shuffled))).rejects.toThrow(/present back/);
  });
});
