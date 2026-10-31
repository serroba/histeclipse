import { describe, expect, it } from 'vitest';

import { formatPlace, skyCaption } from './caption';

const BABYLON = { latitude: 32.5422, longitude: 44.4209 };

describe('skyCaption', () => {
  it('says where the observer stands and faces', () => {
    expect(skyCaption({ place: BABYLON, azimuth: 180, uncertaintySeconds: 2 })).toBe(
      'Standing at 32.54° N, 44.42° E, facing S.',
    );
  });

  it('warns how far ΔT could turn the sky in the distant past', () => {
    // About ±31 minutes in 3000 BCE: the sky could be turned by nearly 8°.
    const text = skyCaption({ place: BABYLON, azimuth: 0, uncertaintySeconds: 1859 });
    expect(text).toContain('facing N.');
    expect(text).toBe(
      'Standing at 32.54° N, 44.42° E, facing N. ΔT ±31 min: the sky may be turned up to ±7.8°.',
    );
  });

  it('writes southern and western places with their hemispheres', () => {
    expect(formatPlace({ latitude: -33.8688, longitude: -70.6693 })).toBe('33.87° S, 70.67° W');
  });
});
