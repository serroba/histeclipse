import { readFile } from 'node:fs/promises';

import { describe, expect, it, vi } from 'vitest';

import { defaultViewState, withLayer, type ViewState } from '../../state/viewState';
import { createMeasured, MEASURED_NOTE } from './measured';

const base = defaultViewState(new Date('2026-01-01T00:00:00Z'));
const ice: ViewState = {
  ...base,
  ma: 0,
  deepScale: 'ice',
  layers: withLayer(base.layers, 'temperature', true),
};

function setUp(shown = true) {
  const prefetch = vi.fn();
  const refresh = vi.fn();
  const fetchJson = vi.fn(
    async (url: string) => new Response(await readFile(`public${url}`, 'utf8')),
  );
  const measured = createMeasured(
    { base: '/', fetchJson, notify: vi.fn(), refresh, prefetch },
    () => shown,
  );
  return { measured, prefetch, refresh, fetchJson };
}

describe('the measured warming on the ice-age globe, from 1850 on the chart (#1283)', () => {
  it('Given the chart before 1850, Then Krapp et al.’s maps stay, and nothing is fetched', () => {
    const { measured, fetchJson } = setUp();
    measured.at(-9000);
    expect(measured.surface(ice)).toBeNull();
    measured.at(1700);
    expect(measured.surface(ice)).toBeNull();
    expect(fetchJson).not.toHaveBeenCalled();
  });

  it('Given the chart in the industrial era, Then the measured maps are fetched ahead, and from 1850 colour the globe as the change', async () => {
    const { measured, prefetch, refresh } = setUp();
    measured.at(1800);
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalled();
    });
    measured.at(1820);
    expect(prefetch).toHaveBeenCalledTimes(1);
    expect(prefetch.mock.calls[0]?.[0]).toContain('/data/warming/2024.png');
    expect(measured.surface(ice)).toBeNull();
    measured.at(1950);
    expect(measured.surface(ice)).toMatchObject({
      younger: '/data/warming/1950.png',
      older: '/data/warming/1950.png',
      change: true,
    });
    // The chart drawing on past 1950, which the view keeps as today.
    measured.at(2022);
    expect(measured.surface(ice)).toMatchObject({
      younger: '/data/warming/2024.png',
      older: '/data/warming/2020.png',
    });
    measured.at(2030);
    expect(prefetch).toHaveBeenCalledTimes(1);
  });

  it('Given °C instead of the change, or no chart, Then the measured maps do not colour it', async () => {
    const { measured, refresh } = setUp();
    measured.at(1900);
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalled();
    });
    expect(measured.surface(ice)).not.toBeNull();
    expect(measured.surface({ ...ice, temperatureShow: 'actual' })).toBeNull();
    measured.at(null);
    expect(measured.surface(ice)).toBeNull();
    expect(setUp(false).measured.surface(ice)).toBeNull();
  });

  it('says what it shows: measured, against 1850–1900, not today', () => {
    expect(MEASURED_NOTE).toContain('Berkeley Earth');
    expect(MEASURED_NOTE).toContain('1850–1900');
  });
});
