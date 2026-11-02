import { describe, expect, it } from 'vitest';

import { EARTH_FRAGMENT } from './scene';

describe('the Earth shader', () => {
  it('samples no more textures than every WebGL GPU allows a shader', () => {
    // WebGL guarantees 16 units per fragment shader (Chrome on a Mac reports exactly 16); the
    // headless browser in the end-to-end suite allows 32, so it would not catch a seventeenth.
    const samplers = EARTH_FRAGMENT.match(/\buniform\s+sampler2D\b/g) ?? [];
    expect(samplers.length).toBeLessThanOrEqual(16);
  });
});
