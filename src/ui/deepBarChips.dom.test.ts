// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import { createAirChip, createSeaLevelChip, createTemperatureChip } from './deepBarChips';
import type { TemperatureView } from './temperatureLegend';

const why = (): HTMLElement => document.createElement('button');

const TEMPERATURE: TemperatureView = {
  on: true,
  wanted: 'krapp',
  shown: 'krapp',
  show: 'change',
  changing: true,
  readings: [],
  note: null,
};

describe('the deep-time bar’s own notes', () => {
  it('Given Sea level, Then its chart reports a moment picked on it, beside its legend', () => {
    const onKa = vi.fn();
    const chip = createSeaLevelChip({ onKa });
    chip.render({ on: true, index: null }, 0.02, 2.6);
    expect(chip.chart).toBeInstanceOf(HTMLElement);
    expect(chip.legend).toBeInstanceOf(HTMLElement);
  });

  it('Given Temperature, Then its legend draws the models', () => {
    const chip = createTemperatureChip(why(), {
      onTemperatureModel: vi.fn(),
      onTemperatureShow: vi.fn(),
    });
    chip.render(TEMPERATURE);
    expect(chip.legend).toBeInstanceOf(HTMLElement);
  });

  it('Given Air, Then its note draws, over all of Earth’s history as elsewhere', () => {
    const chip = createAirChip(why(), { onCo2Archive: vi.fn(), redraw: vi.fn() });
    chip.render({ on: false }, 'all', 540, 100);
    chip.render({ on: false }, 'eons', 4568, 3000);
    expect(chip.note).toBeInstanceOf(HTMLElement);
  });
});
