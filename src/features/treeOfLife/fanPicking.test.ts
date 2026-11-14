import { describe, expect, it } from 'vitest';
import { fanFrame, pickFan } from './fanPicking';
import { parseLineages } from '../../data/lineages';

const lineages = parseLineages({
  schemaVersion: 2,
  credit: 'test',
  source: 'https://example.org',
  accessed: '2026-11-14',
  id: 'dinosaurs',
  name: 'Test tree',
  stepMa: 5,
  ranks: ['clade', 'genus'],
  pbdb: [1, 2, 3],
  names: ['Root', 'Older', 'Younger'],
  rank: [0, 1, 1],
  parent: [-1, 0, 0],
  first: [200, 200, 150],
  last: [0, 100, 0],
  species: [0, 1, 1],
  tracks: [[], [], []],
});
const data = {
  lineages,
  oldest: 200,
  youngest: 0,
  heads: [0],
  roundAngles: [0, Math.PI / 2],
  fan: {
    angle: [0, 0, Math.PI / 2],
    low: [-0.2, 0, Math.PI / 2],
    high: [0.2, 0, Math.PI / 2],
    round: [1, 2],
  },
};
const view = { zoom: 1, panX: 0, panY: 0 };

describe('fan geometry', () => {
  it('scales to the smaller dimension and applies zoom and pan', () => {
    expect(fanFrame(1000, 500, { zoom: 2, panX: 30, panY: -20 })).toEqual({
      scale: 390,
      cx: 530,
      cy: 230,
      width: 1000,
      height: 500,
    });
  });
  it('picks a line only within its lifetime and the played portion', () => {
    const frame = fanFrame(1000, 1000, view);
    expect(pickFan(data, 0, frame, 500 + 0.4 * 390, 500)).toBe(1);
    expect(pickFan(data, 0, frame, 500 + 0.9 * 390, 500)).toBeUndefined();
    expect(pickFan(data, 190, frame, 500 + 0.4 * 390, 500)).toBeUndefined();
    expect(pickFan(data, 0, frame, 500, 500 + 0.7 * 390)).toBe(2);
    expect(pickFan(data, 0, frame, 500, 500 - 0.7 * 390)).toBeUndefined();
  });
  it('picks rim group names but ignores empty rim angles and distant lines', () => {
    const frame = fanFrame(1000, 1000, view);
    expect(pickFan(data, 0, frame, 950, 500)).toBe(0);
    expect(pickFan(data, 0, frame, 500, 950)).toBeUndefined();
    expect(pickFan(data, 0, frame, 650, 550)).toBeUndefined();
  });
});
