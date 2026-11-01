import { describe, expect, it } from 'vitest';

import {
  legendGradient,
  TEMPERATURE_STOPS,
  temperatureMapText,
  temperatureText,
} from './deepTimeBar';

describe('the temperature legend', () => {
  it('places each colour by its temperature', () => {
    const gradient = legendGradient(TEMPERATURE_STOPS);
    expect(gradient).toMatch(/^linear-gradient\(to right, #313695 0\.0%, /);
    expect(gradient).toContain('#e0f3f8 52.9%');
    expect(gradient).toMatch(/#a50026 100\.0%\)$/);
  });

  it('runs its stops from cold to hot', () => {
    const temperatures = TEMPERATURE_STOPS.map(([celsius]) => celsius);
    expect(temperatures).toEqual([...temperatures].sort((a, b) => a - b));
  });

  it('gives every model’s global mean then and today, or where it stops', () => {
    expect(
      temperatureText({
        on: true,
        wanted: 'scotese',
        shown: 'scotese',
        readings: [
          { model: 'scotese', mean: 32.86, today: 14.6, reach: 540 },
          { model: 'cesm', mean: 25.5, today: 13.2, reach: 250 },
        ],
        note: null,
      }),
    ).toBe(
      'Global mean: Scotese 2022 32.9 °C (today 14.6 °C) · CESM, Li et al. 2023 25.5 °C (today 13.2 °C)',
    );
    expect(
      temperatureText({
        on: true,
        wanted: 'cesm',
        shown: 'scotese',
        readings: [
          { model: 'scotese', mean: 11.7, today: null, reach: 540 },
          { model: 'cesm', mean: null, today: 13.2, reach: 250 },
        ],
        note: null,
      }),
    ).toBe(
      'Global mean: Scotese 2022 11.7 °C · CESM, Li et al. 2023 — covers the last 250 million years',
    );
    expect(
      temperatureText({ on: true, wanted: 'scotese', shown: null, readings: [], note: null }),
    ).toBe('Loading temperature maps…');
  });

  it('says which model colours the globe, any stand-in, and its limits', () => {
    const view = { on: true, readings: [], note: null } as const;
    expect(temperatureMapText({ ...view, wanted: 'cesm', shown: 'cesm' })).toMatch(
      /^The globe shows CESM, Li et al\. 2023\. Its grid is about 3\.75°/,
    );
    expect(temperatureMapText({ ...view, wanted: 'cesm', shown: 'scotese' })).toMatch(
      /^The globe shows Scotese 2022\. CESM, Li et al\. 2023 does not reach this far\. A HadCM3L/,
    );
    expect(temperatureMapText({ ...view, wanted: 'scotese', shown: null })).toBe('');
  });
});
