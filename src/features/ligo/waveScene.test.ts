import { Texture, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';

import { WAVE_CHAPTERS } from '../../state/slices/display';
import { JOURNEY_MS } from './journey';
import { chirp, GW150914_STAND_IN } from './strain';
import { mergerMs } from './wavePlay';
import { aimsFor, createWaveScene } from './waveScene';

const wave = chirp(GW150914_STAND_IN);

describe('what the wave view draws, chapter by chapter (#831, #833)', () => {
  it('shows one chapter at a time, the source first', () => {
    const drawn = createWaveScene();
    const visible = (): boolean[] =>
      drawn.scene.children.filter((child) => child.type === 'Group').map((group) => group.visible);
    expect(visible()).toEqual([true, false, false, false]);
    for (const [index, chapter] of WAVE_CHAPTERS.entries()) {
      drawn.show(chapter);
      expect(visible()).toEqual(WAVE_CHAPTERS.map((_, other) => other === index));
      expect(drawn.set(wave, 5000, 0.41).text.length).toBeGreaterThan(0);
    }
    drawn.scalePoints(2);
    drawn.dressEarth(new Texture());
    drawn.dispose();
  });

  it('plays the wave in its chapters, and keeps the journey’s own clock in the journey', () => {
    const drawn = createWaveScene();
    drawn.show('space');
    expect(drawn.set(wave, mergerMs(wave), 0.41).t).toBeCloseTo(0, 9);
    expect(drawn.stillMs(wave)).toBe(mergerMs(wave));
    drawn.show('journey');
    expect(drawn.set(wave, 0, 0.41)).toEqual({
      text: expect.stringContaining('billion years to go') as string,
      t: null,
    });
    expect(drawn.stillMs(wave)).toBe(JOURNEY_MS.travel + JOURNEY_MS.arrive);
    expect(drawn.lengthMs(wave)).toBeGreaterThan(JOURNEY_MS.travel);
    drawn.dispose();
  });

  it('looks at the detector from above, north up, and at the journey from beside the path', () => {
    const heading = new Vector3(0.3, 0.6, -0.74).normalize();
    const detectors = new Vector3(0, 0.6, 0.8);
    const aims = aimsFor(heading, detectors);
    expect(aims.detector.from.y).toBeGreaterThan(0.7);
    // Livingston's arms point west-south-west and south-south-east: their middle lies south.
    expect(aims.detector.target.z).toBeGreaterThan(0.5);
    expect(Math.abs(aims.journey.from.dot(heading))).toBeLessThan(0.5);
    // Seen from over the detectors' side of Earth.
    expect(aims.journey.from.dot(detectors)).toBeGreaterThan(0.3);
  });
});
