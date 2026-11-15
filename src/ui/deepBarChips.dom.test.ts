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

describe('the deep-time bar’s own chips', () => {
  it('Given Sea level, Then its button says whether it is on and toggles it; its chart reports a moment', () => {
    const onSeaLevel = vi.fn();
    const onKa = vi.fn();
    const chip = createSeaLevelChip({ onSeaLevel, onKa });
    expect(chip.button.textContent).toBe('Sea level');
    chip.render({ on: false }, 0.02, 2.6);
    chip.button.click();
    expect(onSeaLevel).toHaveBeenLastCalledWith(true);
    chip.render({ on: true, index: null }, 0.02, 2.6);
    expect(chip.button.getAttribute('aria-pressed')).toBe('true');
    chip.button.click();
    expect(onSeaLevel).toHaveBeenLastCalledWith(false);
    expect(chip.chart).toBeInstanceOf(HTMLElement);
    expect(chip.legend).toBeInstanceOf(HTMLElement);
  });

  it('Given Temperature, Then it is pressed when on, disabled where no map draws, and toggles', () => {
    const onTemperature = vi.fn();
    const chip = createTemperatureChip(why(), {
      onTemperature,
      onModel: vi.fn(),
      onShow: vi.fn(),
    });
    chip.render(TEMPERATURE, false);
    expect(chip.button.getAttribute('aria-pressed')).toBe('true');
    expect(chip.button.disabled).toBe(false);
    chip.button.click();
    expect(onTemperature).toHaveBeenLastCalledWith(false);
    chip.render({ ...TEMPERATURE, on: false }, true);
    expect(chip.button.disabled).toBe(true);
    expect(chip.legend).toBeInstanceOf(HTMLElement);
  });

  it('Given Air, Then it hides over all of Earth’s history, and toggles elsewhere', () => {
    const onAir = vi.fn();
    const chip = createAirChip(why(), { onAir, onCo2Archive: vi.fn(), redraw: vi.fn() });
    expect(chip.button.hidden).toBe(true);
    chip.render({ on: false }, 'all', 540, 100);
    expect(chip.button.hidden).toBe(false);
    chip.button.click();
    expect(onAir).toHaveBeenLastCalledWith(true);
    chip.render({ on: false }, 'eons', 4568, 3000);
    expect(chip.button.hidden).toBe(true);
    expect(chip.note).toBeInstanceOf(HTMLElement);
  });
});
