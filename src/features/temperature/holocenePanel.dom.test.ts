// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import holocene from '../../../public/data/holocene-temperature.json';
import type { HoloceneTemperature } from '../../data/holoceneTemperature';
import type { LayerHost } from '../../globe/layerHost';
import { defaultViewState, withLayer, type ViewState } from '../../state/viewState';
import type { Capability, FeatureContext } from '../feature';

// The chart itself is SVG glue the Playwright suite covers: here, what it is asked, and its year.
const charts = vi.hoisted(() => ({
  made: [] as { onYear: (year: number) => void; held: number[]; disposed: boolean }[],
}));
vi.mock('../../story/holoceneChart', () => ({
  createHoloceneChart: (_stage: HTMLElement, _data: unknown, onYear: (year: number) => void) => {
    const chart = { onYear, held: [] as number[], disposed: false };
    charts.made.push(chart);
    // Drawn, it names its first year at once.
    onYear(-798_050);
    return {
      holdAt: (year: number) => {
        chart.held.push(year);
        onYear(year);
        return year;
      },
      dispose: () => {
        chart.disposed = true;
      },
    };
  },
}));

const { holocenePanel } = await import('./holocenePanel');
const { temperatureFeature } = await import('.');

const data = {} as HoloceneTemperature;

describe('temperature over 800,000 years beside the globe (#434)', () => {
  it('Given a view, Then the chart held at its year, its echoes not taken for the reader’s moves', () => {
    charts.made.length = 0;
    const container = document.createElement('div');
    const moveTo = vi.fn();
    const panel = holocenePanel(moveTo)({ container } as unknown as LayerHost);
    const root = container.querySelector<HTMLElement>('.holocene-panel');
    expect(root?.hidden).toBe(true);
    panel.update({ data, year: -19_050 });
    expect(root?.hidden).toBe(false);
    panel.update({ data, year: -9_050 });
    expect(charts.made).toHaveLength(1);
    expect(charts.made[0]?.held).toEqual([-19_050, -9_050]);
    expect(moveTo).not.toHaveBeenCalled();
    // Dragged by the reader: the view goes there.
    charts.made[0]?.onYear(-120_000);
    expect(moveTo).toHaveBeenCalledWith(-120_000);
    panel.update(null);
    expect(root?.hidden).toBe(true);
    panel.dispose?.();
    expect(charts.made[0]?.disposed).toBe(true);
  });

  it('Given the cursor moved, Then the feature takes the view to that moment of deep time', async () => {
    charts.made.length = 0;
    const container = document.createElement('div');
    const change = vi.fn();
    const refresh = vi.fn();
    const context = {
      base: '/',
      fetchJson: () => Promise.resolve(new Response(JSON.stringify(holocene))),
      notify: vi.fn(),
      refresh,
      change,
      globe: {
        addLayer: (factory: (host: LayerHost) => unknown) =>
          factory({ container } as unknown as LayerHost),
      },
      temperatureMaps: { setTemperature: vi.fn(), prefetch: vi.fn() },
      deepTime: { again: vi.fn() },
    } as unknown as FeatureContext<Capability>;
    const shown = temperatureFeature.mount(context, context);
    const base = defaultViewState(new Date('2026-01-01T00:00:00Z'));
    const ice: ViewState = {
      ...base,
      ma: 0.021,
      deepScale: 'ice',
      layers: withLayer(base.layers, 'temperature', true),
    };
    shown.show?.(ice, 0);
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalled();
    });
    shown.show?.(ice, 0);
    expect(charts.made[0]?.held).toEqual([-19_050]);
    expect(change).not.toHaveBeenCalled();
    charts.made[0]?.onYear(-120_050);
    const update = change.mock.calls[0]?.[0] as (state: ViewState) => ViewState;
    expect(update(ice).ma).toBe(0.122);
    // A move to the moment already shown changes nothing.
    charts.made[0]?.onYear(-19_050);
    const again = change.mock.calls[1]?.[0] as (state: ViewState) => ViewState;
    expect(again(ice)).toBe(ice);
  });
});
