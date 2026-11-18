import { describe, expect, it } from 'vitest';

import { chirp, GW150914_STAND_IN } from './strain';
import { AIMS, createWaveScene, WAVE_CHAPTERS } from './waveScene';

describe('what the wave view draws, chapter by chapter (#831)', () => {
  it('shows one chapter at a time, space first', () => {
    const drawn = createWaveScene();
    const visible = (): boolean[] =>
      drawn.scene.children.filter((child) => child.type === 'Group').map((group) => group.visible);
    expect(visible()).toEqual([true, false]);
    drawn.show('detector');
    expect(visible()).toEqual([false, true]);
    drawn.set(chirp(GW150914_STAND_IN), 0);
    drawn.show('space');
    drawn.set(chirp(GW150914_STAND_IN), 0);
    drawn.scalePoints(2);
    drawn.dispose();
  });

  it('looks at the detector from above, north up the screen', () => {
    expect(WAVE_CHAPTERS).toEqual(['space', 'detector']);
    const { from, target } = AIMS.detector;
    expect(from.y).toBeGreaterThan(0.7);
    expect(from.x).toBe(0);
    // Livingston's arms point west-south-west and south-south-east: their middle lies south.
    expect(target.z).toBeGreaterThan(0.5);
  });
});
