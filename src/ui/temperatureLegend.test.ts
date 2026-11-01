import { describe, expect, it } from 'vitest';

import { legendGradient, TEMPERATURE_STOPS, temperatureText } from './deepTimeBar';

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

  it('gives the global mean then and today', () => {
    expect(temperatureText({ on: true, mean: 32.86, today: 14.6, note: null })).toBe(
      'Global mean 32.9 °C (today 14.6 °C)',
    );
    expect(temperatureText({ on: true, mean: 20, today: null, note: null })).toBe(
      'Global mean 20.0 °C',
    );
    expect(temperatureText({ on: true, mean: null, today: null, note: null })).toBe(
      'Loading temperature maps…',
    );
  });
});
