import { describe, expect, it } from 'vitest';

import { eclipseNote, formatPlace, planetNote, skyCaption } from './caption';

const BABYLON = { latitude: 32.5422, longitude: 44.4209 };

describe('skyCaption', () => {
  it('names the place when it has a name', () => {
    expect(
      skyCaption({ place: BABYLON, placeName: 'Babylon', azimuth: 270, uncertaintySeconds: 2 }),
    ).toBe('Standing in Babylon (32.54° N, 44.42° E), facing W.');
  });

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

describe('eclipseNote', () => {
  const quiet = { sunVisible: 1, sunAltitude: 40, moonSunlight: 1, moonAltitude: 30 };

  it('says nothing without an eclipse in sight', () => {
    expect(eclipseNote(quiet)).toBe('');
    // The Sun is eclipsed, but below the horizon here.
    expect(eclipseNote({ ...quiet, sunVisible: 0, sunAltitude: -5 })).toBe('');
    expect(eclipseNote({ ...quiet, moonSunlight: 0, moonAltitude: -5 })).toBe('');
  });

  it('describes a solar eclipse from here', () => {
    expect(eclipseNote({ ...quiet, sunVisible: 0 })).toBe(
      'Totality: the Moon hides the whole Sun.',
    );
    expect(eclipseNote({ ...quiet, sunVisible: 0.094 })).toBe('The Moon covers 91% of the Sun.');
    // Never "100%" short of totality, nor "0%" once the Moon has touched the Sun.
    expect(eclipseNote({ ...quiet, sunVisible: 0.001 })).toBe('The Moon covers 99% of the Sun.');
    expect(eclipseNote({ ...quiet, sunVisible: 0.999 })).toBe('The Moon covers 1% of the Sun.');
  });

  it('describes a lunar eclipse while the Moon is up', () => {
    expect(eclipseNote({ ...quiet, moonSunlight: 0 })).toContain('darkest shadow');
    expect(eclipseNote({ ...quiet, moonSunlight: 0.4 })).toBe(
      'Earth’s shadow is falling on the Moon.',
    );
  });
});

describe('planetNote', () => {
  it('says nothing while every planet is within half an arcminute', () => {
    expect(planetNote(-586)).toBe('');
    expect(planetNote(2024)).toBe('');
  });

  it('gives the error budget of the planets that drift in the remote past', () => {
    expect(planetNote(-2500)).toBe(
      'This far back, planet positions are good to Jupiter ±3′, Saturn ±6′.',
    );
    expect(planetNote(-1500)).toBe(
      'This far back, planet positions are good to Jupiter ±1′, Saturn ±2.5′.',
    );
  });
});
