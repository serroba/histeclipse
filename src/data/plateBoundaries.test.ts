import { describe, expect, it } from 'vitest';

import index from '../../public/data/plate-boundaries/index.json';
import today from '../../public/data/plate-boundaries/0.json';
import oldest from '../../public/data/plate-boundaries/1800.json';
import type { Fetch } from '../util/fetchJson';
import {
  boundaryFrameMa,
  loadBoundaryFrame,
  loadBoundaryIndex,
  turnedFrame,
  type BoundaryFrame,
} from './plateBoundaries';

const serve =
  (body: unknown): Fetch =>
  () =>
    Promise.resolve(Response.json(body));

describe('the plate boundaries (#1160)', () => {
  it('reach back 1.8 billion years every 5 million, credited', async () => {
    const loaded = await loadBoundaryIndex('/x', serve(index));
    expect(loaded).toMatchObject({ stepMa: 5, oldestMa: 1800 });
    expect(loaded.credit).toContain('CC BY 4.0');
  });

  it('hold every kind today: ridges, trenches and transforms, the Pacific among them', async () => {
    const frame = await loadBoundaryFrame('/x', serve(today));
    expect(frame.ma).toBe(0);
    expect(frame.lines.ridge.length).toBeGreaterThan(20);
    expect(frame.lines.subduction.length).toBeGreaterThan(20);
    expect(frame.lines.transform.length).toBeGreaterThan(5);
    // The East Pacific Rise runs north–south near 110° W, under the open ocean.
    const epr = frame.lines.ridge
      .flat()
      .filter(([lon, lat]) => lon > -115 && lon < -100 && Math.abs(lat) < 30);
    expect(epr.length).toBeGreaterThan(10);
  });

  it('still hold plates at 1,800 Ma', async () => {
    const frame = await loadBoundaryFrame('/x', serve(oldest));
    expect(frame.lines.subduction.length + frame.lines.ridge.length).toBeGreaterThan(5);
  });

  it('reject a line of one point', async () => {
    const broken = { ma: 0, lines: { ridge: [[1, 2]], subduction: [], transform: [], other: [] } };
    await expect(loadBoundaryFrame('/x', serve(broken))).rejects.toThrow();
  });

  it('pick the frame nearest the moment, none beyond the oldest', async () => {
    const loaded = await loadBoundaryIndex('/x', serve(index));
    expect(boundaryFrameMa(loaded, 0)).toBe(0);
    expect(boundaryFrameMa(loaded, 442)).toBe(440);
    expect(boundaryFrameMa(loaded, 443)).toBe(445);
    expect(boundaryFrameMa(loaded, 1800)).toBe(1800);
    expect(boundaryFrameMa(loaded, 1801)).toBeNull();
  });

  it('turn about the axis as the continents are, back within the map', () => {
    const frame: BoundaryFrame = {
      ma: 440,
      lines: {
        ridge: [
          [
            [170, 10],
            [175, 12],
          ],
        ],
        subduction: [],
        transform: [],
        other: [],
      },
    };
    expect(turnedFrame(frame, 0)).toBe(frame);
    expect(turnedFrame(frame, 20).lines.ridge).toEqual([
      [
        [-170, 10],
        [-165, 12],
      ],
    ]);
    expect(turnedFrame(frame, -350).lines.ridge).toEqual([
      [
        [-180, 10],
        [-175, 12],
      ],
    ]);
  });
});
