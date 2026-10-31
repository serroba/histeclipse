import { describe, expect, it } from 'vitest';

import { errorMessage } from './errors';

describe('errorMessage', () => {
  it('uses the message of an Error', () => {
    expect(errorMessage(new RangeError('out of range'))).toBe('out of range');
  });

  it.each([
    ['a string', 'a string'],
    [42, '42'],
    [null, 'null'],
  ])('stringifies %o', (thrown, expected) => {
    expect(errorMessage(thrown)).toBe(expected);
  });
});
