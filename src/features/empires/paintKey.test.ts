import { describe, expect, it } from 'vitest';

import { standingKey } from './paintKey';

const rows = [
  { from: -3000, to: -2500 },
  { from: -2700, to: -1000 },
];
const file = { rows };

describe('standingKey', () => {
  it('stays the same while the same rows stand, year after year', () => {
    expect(standingKey(file, rows, -2900)).toBe(standingKey(file, rows, -2800));
    expect(standingKey(file, rows, -2600)).toBe(standingKey(file, rows, -2550));
  });

  it('changes as a row comes or goes', () => {
    expect(standingKey(file, rows, -2800)).not.toBe(standingKey(file, rows, -2650));
    expect(standingKey(file, rows, -2650)).not.toBe(standingKey(file, rows, -2400));
  });

  it('is empty with no file, and the same with none standing', () => {
    expect(standingKey(null, rows, -2800)).toBe('');
    expect(standingKey(file, rows, -9000)).toBe(standingKey(file, rows, -8000));
  });

  it('tells files apart, though the same rows stand in each', () => {
    const other = { rows };
    expect(standingKey(file, rows, -2800)).not.toBe(standingKey(other, rows, -2800));
  });
});
