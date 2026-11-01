import { describe, expect, it } from 'vitest';

import bce500 from '../../public/data/empires/-500.json';
import bce600 from '../../public/data/empires/-600.json';
import bce800 from '../../public/data/empires/-800.json';
import index from '../../public/data/empires/index.json';
import type { Fetch } from './fetchJson';
import {
  centuryFor,
  labelPoint,
  loadEmpireCentury,
  loadEmpireIndex,
  ringArea,
  territoriesIn,
  territoryHue,
  unwrapRing,
} from './empires';

const serve =
  (body: unknown): Fetch =>
  () =>
    Promise.resolve(Response.json(body));

const FILES: Readonly<Record<number, unknown>> = { [-800]: bce800, [-600]: bce600, [-500]: bce500 };
const centuryFile = (start: number): unknown => FILES[start];

describe('empire borders', () => {
  it('cover 3400 BCE to today, credited to Cliopatria', async () => {
    const loaded = await loadEmpireIndex('/x', serve(index));
    expect(loaded.centuries.at(0)).toBe(-3400);
    expect(loaded.centuries.at(-1)).toBe(2000);
    expect(loaded.credit).toContain('CC BY 4.0');
    expect(centuryFor(loaded, -586)).toBe(-600);
    expect(centuryFor(loaded, 5000)).toBeNull();
  });

  it('show the Neo-Babylonian Empire in 587 BCE, and the Persian Empire after it', async () => {
    const century = await loadEmpireCentury('/x', serve(centuryFile(-600)));
    const names = (year: number) => territoriesIn(century, year).map(({ name }) => name);
    expect(names(-586)).toEqual(
      expect.arrayContaining(['Neo-Babylonian Empire', 'Twenty-sixth Dynasty of Egypt', 'Lydia']),
    );
    // Cliopatria ends Judah in 701 BCE, folding it into its overlords' territory after that.
    expect(names(-586)).not.toContain('Kingdom of Judah');
    const judah = await loadEmpireCentury('/x', serve(centuryFile(-800)));
    expect(territoriesIn(judah, -750).map(({ name }) => name)).toContain('Kingdom of Judah');
    const later = await loadEmpireCentury('/x', serve(centuryFile(-500)));
    expect(territoriesIn(later, -480).map(({ name }) => name)).toContain('Achaemenid Empire');
  });

  it('decodes rings into degrees', async () => {
    const century = await loadEmpireCentury('/x', serve(centuryFile(-500)));
    const persia = territoriesIn(century, -480).find(({ name }) => name === 'Achaemenid Empire');
    const label = persia === undefined ? null : labelPoint(persia);
    // Somewhere in Iran or Mesopotamia.
    expect(label?.latitude).toBeGreaterThan(25);
    expect(label?.latitude).toBeLessThan(42);
    expect(label?.longitude).toBeGreaterThan(35);
    expect(label?.longitude).toBeLessThan(65);
  });

  it('rejects rings that are not lon/lat pairs', async () => {
    const broken = {
      schemaVersion: 1,
      century: 0,
      scale: 100,
      polities: [{ name: 'A', wikipedia: '', from: 0, to: 1, rings: [[1, 2, 3]] }],
    };
    await expect(loadEmpireCentury('/x', serve(broken))).rejects.toThrow('lon/lat pairs');
  });
});

describe('unwrapRing', () => {
  it('keeps a ring that crosses the 180° meridian continuous', () => {
    const ring = [
      [170, 60],
      [-170, 60],
      [-170, 70],
      [170, 70],
    ] as const;
    expect(unwrapRing(ring)).toEqual([
      [170, 60],
      [190, 60],
      [190, 70],
      [170, 70],
    ]);
    expect(
      unwrapRing([
        [-170, 0],
        [170, 0],
      ]),
    ).toEqual([
      [-170, 0],
      [-190, 0],
    ]);
  });

  it('puts the label of a ring across the meridian on the map', () => {
    const label = labelPoint({
      name: 'Chukotka',
      wikipedia: '',
      rings: [
        [
          [170, 60],
          [-170, 60],
          [-170, 70],
          [170, 70],
        ],
      ],
    });
    expect(label.longitude).toBeCloseTo(-180, 6);
    expect(label.latitude).toBe(65);
    expect(label.area).toBe(200);
  });
});

describe('helpers', () => {
  it('measures ring areas and gives stable hues', () => {
    expect(
      ringArea([
        [0, 0],
        [2, 0],
        [2, 2],
        [0, 2],
      ]),
    ).toBe(4);
    expect(territoryHue('Achaemenid Empire')).toBe(territoryHue('Achaemenid Empire'));
    expect(territoryHue('Rome')).not.toBe(territoryHue('Carthage'));
    expect(territoryHue('x')).toBeGreaterThanOrEqual(0);
    expect(territoryHue('x')).toBeLessThan(360);
  });

  it('labels an empty territory at the origin', () => {
    expect(labelPoint({ name: 'none', wikipedia: '', rings: [] })).toEqual({
      latitude: 0,
      longitude: 0,
      area: 0,
    });
  });
});
