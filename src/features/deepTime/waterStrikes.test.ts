import { describe, expect, it } from 'vitest';

import { WATER_STRIKE_LIST } from '../../deepTime/sketch';
import type { ImpactSpec } from '../../globe/impactAnimation';
import { defaultViewState, type ViewState } from '../../state/viewState';
import { createWaterStrikes, inView, strikeSpec } from './waterStrikes';

const BASE = defaultViewState(new Date('2026-06-15T12:00:00Z'));

/** The first strike, and a view looking straight at it. */
const [STRIKE] = WATER_STRIKE_LIST;
if (STRIKE === undefined) throw new Error('no strikes');
const LOOKING: ViewState = {
  ...BASE,
  water: 'delivered',
  camera: { ...BASE.camera, target: { latitude: STRIKE.lat, longitude: STRIKE.lon } },
};

/** Strikes played over two frames, from just before the first strike to just after it. */
function played(state: ViewState, lessMotion = false, playing = true): ImpactSpec[] {
  const specs: ImpactSpec[] = [];
  const strikes = createWaterStrikes((spec) => specs.push(spec), lessMotion);
  strikes.show(state, (STRIKE?.ma ?? 0) + 0.01, playing);
  strikes.show(state, (STRIKE?.ma ?? 0) - 0.01, playing);
  return specs;
}

describe('the delivered water’s strikes (#1142)', () => {
  it('Given delivered water, playing past a strike in view, Then it plays, icy', () => {
    const specs = played(LOOKING);
    expect(specs).toHaveLength(1);
    expect(specs[0]).toMatchObject({ icy: true, place: { latitude: STRIKE.lat } });
  });

  it('Given water from Earth’s own rock, less motion, a pause, or another focus, Then none', () => {
    expect(played({ ...LOOKING, water: 'inherited' })).toEqual([]);
    expect(played(LOOKING, true)).toEqual([]);
    expect(played(LOOKING, false, false)).toEqual([]);
    expect(played({ ...LOOKING, focus: 'moon' })).toEqual([]);
  });

  it('Given the strike on the far side, Then it does not play', () => {
    const far: ViewState = {
      ...LOOKING,
      camera: {
        ...LOOKING.camera,
        target: { latitude: -STRIKE.lat, longitude: STRIKE.lon + 180 },
      },
    };
    expect(played(far)).toEqual([]);
  });

  it('measures the side in view as an angle on the globe', () => {
    const place = { ...STRIKE, lat: 0, lon: 0 };
    expect(inView(place, { latitude: 0, longitude: 60 })).toBe(true);
    expect(inView(place, { latitude: 0, longitude: 80 })).toBe(false);
    expect(strikeSpec(place).craterKm).toBeGreaterThan(0);
  });
});
