import { describe, expect, it } from 'vitest';

import {
  clock,
  EARTH_DISTANCE_SUN_RADII,
  electronVolts,
  elapsedAt,
  JOURNEY_FACTS,
  kilometresAt,
  RED_NM,
  SUN_OVER_EARTH,
  terahertz,
  TRAVEL_S,
} from './sunlightJourney';

describe("sunlight's journey to Earth", () => {
  it('takes 8 minutes 19 seconds', () => {
    expect(clock(TRAVEL_S)).toBe('8 min 19 s');
    expect(clock(elapsedAt(0))).toBe('0 s');
    expect(clock(elapsedAt(0.5))).toBe('4 min 10 s');
    expect(elapsedAt(2)).toBe(TRAVEL_S);
  });

  it('crosses 150 million km', () => {
    expect(kilometresAt(1) / 1e6).toBeCloseTo(149.6, 1);
    expect(kilometresAt(-1)).toBe(0);
  });

  it('carries red light of 680 nm: 441 THz, 1.8 eV, as the story says', () => {
    expect(Math.round(terahertz(RED_NM))).toBe(441);
    expect(electronVolts(RED_NM).toFixed(1)).toBe('1.8');
  });

  it('says what is drawn short: 215 Sun radii away, 109 times smaller', () => {
    expect(Math.round(EARTH_DISTANCE_SUN_RADII)).toBe(215);
    expect(Math.round(SUN_OVER_EARTH)).toBe(109);
    expect(JOURNEY_FACTS.join(' ')).toContain('8 min 19 s');
    expect(JOURNEY_FACTS.join(' ')).toContain('680 nm, 441 THz, 1.8 eV');
    expect(JOURNEY_FACTS.join(' ')).toContain('215 Sun radii away');
  });
});
