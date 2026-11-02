import { describe, expect, it } from 'vitest';

import {
  crustShare,
  DEFAULT_IMPACT_MODEL,
  DEFAULT_LAND_MODEL,
  DEFAULT_SNOWBALL_MODEL,
  EMERGENCE_MA,
  IMPACTS,
  LAND_CHOICES,
  LAND_MODELS,
  LAND_TODAY,
  landShare,
  MAGMA_AFTER_IMPACT_MA,
  sketchAt,
  SNOWBALL_CHOICES,
  SNOWBALL_EPISODES,
  snowballAt,
  sunBrightness,
} from './sketch';

const choices = {
  impact: DEFAULT_IMPACT_MODEL,
  land: DEFAULT_LAND_MODEL,
  snowball: DEFAULT_SNOWBALL_MODEL,
} as const;

describe('crust growth', () => {
  it('reaches today’s crust today in every model, never shrinking towards today', () => {
    for (const model of LAND_MODELS) {
      expect(crustShare(model, 0)).toBe(1);
      const { crust } = LAND_CHOICES[model];
      for (let index = 1; index < crust.length; index++) {
        const [olderMa, older] = crust[index - 1] ?? [0, 0];
        const [youngerMa, younger] = crust[index] ?? [0, 0];
        expect(youngerMa).toBeLessThan(olderMa);
        expect(younger).toBeGreaterThanOrEqual(older);
      }
    }
  });

  it('interpolates between the read-off points and holds beyond the oldest', () => {
    expect(crustShare('dhuime', 3000)).toBeCloseTo(0.63);
    expect(crustShare('dhuime', 2750)).toBeCloseTo(0.69);
    expect(crustShare('dhuime', 4500)).toBeCloseTo(0.07);
  });

  it('draws land as today’s share scaled by the crust, unless flooded', () => {
    expect(landShare('dhuime', 0)).toBeCloseTo(LAND_TODAY);
    expect(landShare('armstrong', 3000)).toBeCloseTo(LAND_TODAY);
    expect(landShare('flooded', 3000)).toBeCloseTo(0.025);
    expect(landShare('flooded', EMERGENCE_MA)).toBeCloseTo(landShare('dhuime', EMERGENCE_MA));
    expect(landShare('taylor', 4000)).toBe(0);
  });
});

describe('the sketch', () => {
  it('is molten until shortly after the chosen impact', () => {
    for (const impact of ['early', 'intermediate', 'young'] as const) {
      const after = IMPACTS[impact].ma - MAGMA_AFTER_IMPACT_MA;
      expect(sketchAt(after + 0.1, { ...choices, impact }, false)).toMatchObject({
        kind: 'magma',
        questions: ['impact'],
      });
      expect(sketchAt(after - 0.1, { ...choices, impact }, false).kind).toBe('ocean');
    }
  });

  it('keeps the impact question open until the youngest camp’s impact is past', () => {
    expect(sketchAt(4450, choices, false).questions).toEqual(['impact', 'land']);
    expect(sketchAt(4300, choices, false).questions).toEqual(['land']);
  });

  it('offers the land question only where no reconstruction draws the continents', () => {
    expect(sketchAt(3000, choices, false)).toMatchObject({ questions: ['land'] });
    expect(sketchAt(1000, choices, true)).toMatchObject({ land: 0, questions: [] });
  });

  it('draws snowball ice only in the episodes, as far as the chosen model', () => {
    expect(sketchAt(1000, choices, true).iceEdge).toBe(90);
    expect(sketchAt(645, { ...choices, snowball: 'slush' }, true)).toMatchObject({
      iceEdge: SNOWBALL_CHOICES.slush.iceEdge,
      questions: ['snowball'],
    });
    expect(sketchAt(2440, choices, false)).toMatchObject({
      iceEdge: -1,
      questions: ['land', 'snowball'],
    });
  });

  it('lists the episodes youngest first, each with its edges in order', () => {
    for (const { young, old } of SNOWBALL_EPISODES) expect(young).toBeLessThan(old);
    expect(snowballAt(640)?.name).toBe('Marinoan');
    expect(snowballAt(700)?.name).toBe('Sturtian');
    expect(snowballAt(653)).toBeNull();
  });
});

describe('the faint young Sun', () => {
  it('shone about 71% as bright when the Sun formed, as bright as today now', () => {
    expect(sunBrightness(0)).toBe(1);
    expect(sunBrightness(4570)).toBeCloseTo(0.714, 3);
    expect(sunBrightness(2500)).toBeCloseTo(0.82, 2);
  });
});
