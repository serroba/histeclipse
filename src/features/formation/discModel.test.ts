import { describe, expect, it } from 'vitest';

import { gasLeft, moteAt, motes, REACH, swept } from './discModel';

describe('the disc round the growing Earth (#1219)', () => {
  const swarm = motes(400);

  it('is mostly dust with a few embryos, none on Earth, the same each time', () => {
    expect(swarm).toEqual(motes(400));
    const kinds = (kind: string): number => swarm.filter((mote) => mote.kind === kind).length;
    expect(kinds('dust')).toBeGreaterThan(320);
    expect(kinds('embryo')).toBeGreaterThan(0);
    expect(kinds('embryo')).toBeLessThan(20);
    for (const mote of swarm) {
      expect(Math.abs(mote.x)).toBeGreaterThanOrEqual(1.3);
      expect(Math.abs(mote.x)).toBeLessThanOrEqual(REACH);
    }
  });

  it('keeps its gas until 2.5 Myr and loses it by 4.5', () => {
    expect(gasLeft(1)).toBe(1);
    expect(gasLeft(3.5)).toBeCloseTo(0.5);
    expect(gasLeft(5)).toBe(0);
  });

  it('is swept up as fast as Earth grows in the model chosen', () => {
    expect(swept('slow', 0)).toBe(0);
    expect(swept('fast', 4)).toBeCloseTo(0.8);
    expect(swept('slow', 4)).toBeLessThan(swept('fast', 4));
    expect(swept('slow', 200)).toBeGreaterThan(0.99);
    const left = (myr: number): number =>
      swarm.filter((mote) => moteAt(mote, 'slow', myr, 0) !== null).length;
    expect(left(2)).toBeGreaterThan(left(20));
    expect(left(200)).toBeLessThan(10);
  });

  it('grows planetesimals within 100,000 years and embryos within a million', () => {
    const embryo = swarm.find((mote) => mote.kind === 'embryo' && mote.sweptAt > 0.5);
    const small = swarm.find((mote) => mote.kind === 'planetesimal' && mote.sweptAt > 0.5);
    if (embryo === undefined || small === undefined) throw new Error('no bodies');
    expect(moteAt(embryo, 'slow', 0.5, 0)).toBeNull();
    expect(moteAt(embryo, 'slow', 1.5, 0)?.size).toBeGreaterThan(0.5);
    expect(moteAt(small, 'slow', 0.05, 0)).toBeNull();
    expect(moteAt(small, 'slow', 0.2, 0)).not.toBeNull();
  });

  it('streams past Earth with the time played, ahead nearer the Sun, behind further out', () => {
    const inner = swarm.find((mote) => mote.x < -3 && mote.kind === 'dust');
    const outer = swarm.find((mote) => mote.x > 3 && mote.kind === 'dust');
    if (inner === undefined || outer === undefined) throw new Error('no dust');
    const along = (mote: typeof inner, played: number): number =>
      moteAt(mote, 'fast', 0.01, played)?.place[2] ?? NaN;
    // A small step, before either wraps round.
    expect(along(inner, 0.5) - along(inner, 0)).toBeGreaterThan(0);
    expect(along(outer, 0.5) - along(outer, 0)).toBeLessThan(0);
    for (const played of [0, 100, 1000]) {
      expect(Math.abs(along(inner, played))).toBeLessThanOrEqual(REACH);
    }
  });

  it('dims the dust as the gas goes, not the solid bodies', () => {
    const dust = swarm.find((mote) => mote.kind === 'dust' && mote.sweptAt > 0.9);
    const body = swarm.find((mote) => mote.kind === 'planetesimal' && mote.sweptAt > 0.9);
    if (dust === undefined || body === undefined) throw new Error('none left');
    const early = moteAt(dust, 'slow', 1, 0)?.colour[0] ?? 0;
    const late = moteAt(dust, 'slow', 6, 0)?.colour[0] ?? 0;
    expect(late).toBeLessThan(early);
    expect(moteAt(body, 'slow', 1, 0)?.colour).toEqual(moteAt(body, 'slow', 6, 0)?.colour);
  });
});
