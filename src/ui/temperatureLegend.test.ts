import { describe, expect, it } from 'vitest';

import {
  CHANGE_KEY,
  CHANGE_STOPS,
  celsiusText,
  legendGradient,
  scaleTicks,
  TEMPERATURE_KEY,
  TEMPERATURE_STOPS,
  temperatureMapText,
  temperatureText,
} from './temperatureLegend';

describe('the temperature legend', () => {
  it('places each colour by its temperature', () => {
    const gradient = legendGradient(TEMPERATURE_STOPS);
    expect(gradient).toMatch(/^linear-gradient\(to right, #313695 0\.0%, /);
    expect(gradient).toContain('#e0f3f8 52.9%');
    expect(gradient).toMatch(/#a50026 100\.0%\)$/);
  });

  it('names every colour of the scale, at its own temperature', () => {
    expect(TEMPERATURE_KEY.map(({ celsius }) => celsius)).toEqual(
      TEMPERATURE_STOPS.map(([celsius]) => celsius),
    );
    expect(TEMPERATURE_KEY.find(({ celsius }) => celsius === 15)?.label).toContain(
      'today’s global mean',
    );
  });

  it('places the ticks along the scale, in °C with a true minus', () => {
    expect(scaleTicks(TEMPERATURE_STOPS, [-40, 0, 45])).toEqual([
      { celsius: -40, at: 0 },
      { celsius: 0, at: 40 / 85 },
      { celsius: 45, at: 1 },
    ]);
    expect(celsiusText(-40)).toBe('−40 °C');
    expect(celsiusText(15)).toBe('15 °C');
  });

  it('runs its stops from cold to hot', () => {
    const temperatures = TEMPERATURE_STOPS.map(([celsius]) => celsius);
    expect(temperatures).toEqual([...temperatures].sort((a, b) => a - b));
  });

  it('runs the change scale from colder to warmer, through today', () => {
    const changes = CHANGE_STOPS.map(([celsius]) => celsius);
    expect(changes).toEqual([...changes].sort((a, b) => a - b));
    expect(changes).toContain(0);
    expect(CHANGE_KEY.every(({ celsius }) => changes.includes(celsius))).toBe(true);
    expect(celsiusText(4, true)).toBe('+4 °C');
    expect(celsiusText(0, true)).toBe('0 °C');
    expect(celsiusText(-10, true)).toBe('−10 °C');
  });

  const base = { on: true, show: 'change', changing: false, note: null } as const;

  it('gives every model’s mean then and today, saying which are of land, or where each stops', () => {
    expect(
      temperatureText({
        ...base,
        wanted: 'krapp',
        shown: 'krapp',
        readings: [
          { model: 'krapp', mean: 4.06, today: 13.0, reach: 0.8, coverage: 'land' },
          { model: 'scotese', mean: 14.6, today: 14.6, reach: 540, coverage: 'global' },
        ],
      }),
    ).toBe(
      'Mean: Krapp et al. 2021, land 4.1 °C (today 13.0 °C) · Scotese 2022 14.6 °C (today 14.6 °C)',
    );
    expect(
      temperatureText({
        ...base,
        wanted: 'cesm',
        shown: 'scotese',
        readings: [
          { model: 'krapp', mean: null, today: 13.0, reach: 0.8, coverage: 'land' },
          { model: 'scotese', mean: 11.7, today: null, reach: 540, coverage: 'global' },
          { model: 'cesm', mean: null, today: 13.2, reach: 250, coverage: 'global' },
        ],
      }),
    ).toBe(
      'Mean: Krapp et al. 2021, land — covers the last 800,000 years · Scotese 2022 11.7 °C · CESM, Li et al. 2023 — covers the last 250 million years',
    );
    expect(temperatureText({ ...base, wanted: 'scotese', shown: null, readings: [] })).toBe(
      'Loading temperature maps…',
    );
  });

  it('says which model colours the globe, any stand-in, its limits, and if by change', () => {
    const view = { ...base, readings: [] } as const;
    expect(temperatureMapText({ ...view, wanted: 'cesm', shown: 'cesm' })).toMatch(
      /^The globe shows CESM, Li et al\. 2023\. Its grid is about 3\.75°/,
    );
    expect(temperatureMapText({ ...view, wanted: 'cesm', shown: 'scotese' })).toMatch(
      /^The globe shows Scotese 2022\. CESM, Li et al\. 2023 does not reach this far\. A HadCM3L/,
    );
    expect(
      temperatureMapText({ ...view, wanted: 'krapp', shown: 'krapp', changing: true }),
    ).toMatch(
      /^The globe shows Krapp et al\. 2021\. A statistical emulator.*land only.*Coloured by the change from today’s map\.$/,
    );
    expect(temperatureMapText({ ...view, wanted: 'scotese', shown: null })).toBe('');
  });
});
