import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';

import { createImpactShell, FRONT_MS, shellAt } from './impactShell';

describe('a worldwide impact’s shell over the globe (#1167)', () => {
  it('shows nothing before the strike', () => {
    expect(shellAt(-1, 8000, 1).visible).toBe(false);
  });

  it('sends its front to the far side, glowing behind it, then veils the globe and clears', () => {
    const early = shellAt(300, 8800, 1);
    const half = shellAt(FRONT_MS / 2, 8800, 1);
    const out = shellAt(FRONT_MS, 8800, 1);
    expect(early.front).toBeGreaterThan(0);
    expect(half.front).toBeGreaterThan(early.front);
    expect(out.front).toBeCloseTo(Math.PI, 6);
    expect(out.frontGlow).toBe(0);
    expect(half.ember).toBe(1);
    expect(shellAt(7000, 8800, 1).ember).toBe(0);
    expect(out.veil).toBeCloseTo(0.72, 6);
    expect(shellAt(8800, 8800, 1).veil).toBe(0);
  });

  it('reaches only part of the way round for a smaller impact', () => {
    expect(shellAt(FRONT_MS, 8800, 0.5).front).toBeCloseTo(Math.PI / 2, 6);
    expect(shellAt(FRONT_MS, 8800, 0.5).veil).toBeCloseTo(0.36, 6);
  });

  it('draws it, moving with the moment, and lets it go', () => {
    for (const icy of [false, true]) {
      const shell = createImpactShell(new Vector3(0, 2, 0), icy);
      expect(shell.mesh.visible).toBe(false);
      shell.show(shellAt(FRONT_MS / 2, 8800, 1));
      expect(shell.mesh.visible).toBe(true);
      expect(shell.mesh.material.uniforms['front']?.value).toBeGreaterThan(0);
      expect((shell.mesh.material.uniforms['center']?.value as Vector3).y).toBe(1);
      shell.dispose();
    }
  });
});
