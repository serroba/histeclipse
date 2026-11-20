import { describe, expect, it } from 'vitest';

import { placeText } from './here';

describe('why here', () => {
  it('says a place in degrees', () => {
    expect(placeText({ latitude: 36.36, longitude: -43.15 })).toBe('36.4°N 43.1°W');
    expect(placeText({ latitude: -12, longitude: 130 })).toBe('12.0°S 130.0°E');
  });
});
