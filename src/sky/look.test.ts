import { describe, expect, it } from 'vitest';

import type { Constellation } from '../data/sky';
import { DEFAULT_LOOK } from '../state/viewState';
import {
  compassPoint,
  dragLook,
  figureSegments,
  lookDirection,
  LOWEST_LOOK,
  roundLook,
  shownConstellations,
  zoomLook,
} from './look';

describe('lookDirection', () => {
  it('faces north at azimuth 0, east at 90, and up at altitude 90', () => {
    const north = lookDirection({ azimuth: 0, altitude: 0, fov: 60 });
    expect(north[1]).toBeCloseTo(1, 12);
    const east = lookDirection({ azimuth: 90, altitude: 0, fov: 60 });
    expect(east[0]).toBeCloseTo(1, 12);
    expect(lookDirection({ azimuth: 0, altitude: 90, fov: 60 })[2]).toBeCloseTo(1, 12);
  });
});

describe('dragLook', () => {
  it('moves the sky with the pointer, a field of view per screen height', () => {
    // Dragging right by a full screen height turns the view left by the field of view.
    const turned = dragLook(DEFAULT_LOOK, 900, 0, 900);
    expect(turned.azimuth).toBeCloseTo(90, 12);
    expect(dragLook(DEFAULT_LOOK, 0, 300, 900).altitude).toBeCloseTo(60, 12);
  });

  it('wraps the azimuth and stops at the zenith and a little below the horizon', () => {
    expect(dragLook({ ...DEFAULT_LOOK, azimuth: 10 }, 300, 0, 900).azimuth).toBeCloseTo(340, 12);
    expect(dragLook(DEFAULT_LOOK, 0, 5000, 900).altitude).toBe(90);
    expect(dragLook(DEFAULT_LOOK, 0, -5000, 900).altitude).toBe(LOWEST_LOOK);
  });
});

describe('zoomLook', () => {
  it('scales the field of view within its range', () => {
    expect(zoomLook(DEFAULT_LOOK, 0.5).fov).toBe(45);
    expect(zoomLook(DEFAULT_LOOK, 100).fov).toBe(120);
    expect(zoomLook(DEFAULT_LOOK, 0.001).fov).toBe(5);
  });
});

describe('roundLook', () => {
  it('rounds to the tenths the link keeps, wrapping 360 to 0', () => {
    expect(roundLook({ azimuth: 359.97, altitude: 12.345, fov: 60.04 })).toEqual({
      azimuth: 0,
      altitude: 12.3,
      fov: 60,
    });
  });
});

const figure = (id: string, rank: 1 | 2 | 3, lines: number[][]): Constellation => ({
  id,
  name: id,
  rank,
  label: [0, 0],
  lines,
});

describe('which figures are drawn', () => {
  const all = [figure('Ori', 1, [[0, 1, 2], [3]]), figure('Lyr', 2, [[4, 5]])];

  it('draws the famous ones by default, all, or none', () => {
    expect(shownConstellations(all, 'famous').map(({ id }) => id)).toEqual(['Ori']);
    expect(shownConstellations(all, 'all')).toHaveLength(2);
    expect(shownConstellations(all, 'none')).toEqual([]);
  });

  it('turns runs into line segments, skipping single stars', () => {
    expect(figureSegments(all)).toEqual([
      [0, 1],
      [1, 2],
      [4, 5],
    ]);
  });
});

describe('compassPoint', () => {
  it('names the nearest of eight points', () => {
    expect(compassPoint(0)).toBe('N');
    expect(compassPoint(200)).toBe('S');
    expect(compassPoint(338)).toBe('N');
    expect(compassPoint(-90)).toBe('W');
  });
});
