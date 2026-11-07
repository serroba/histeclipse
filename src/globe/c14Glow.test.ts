import { describe, expect, it } from 'vitest';

import { createC14Glow, GLOW_ROWS } from './c14Glow';

describe('the carbon-14 glow', () => {
  it('starts hidden, shows a rate per row, and hides again', () => {
    const glow = createC14Glow();
    expect(glow.mesh.visible).toBe(false);
    glow.set([0.2, 0.5, 1]);
    expect(glow.mesh.visible).toBe(true);
    const strength = glow.mesh.material.uniforms['strength']?.value as number[];
    expect(strength).toHaveLength(GLOW_ROWS);
    expect(strength.slice(0, 4)).toEqual([0.2, 0.5, 1, 0]);
    glow.set(null);
    expect(glow.mesh.visible).toBe(false);
    glow.dispose();
  });
});
