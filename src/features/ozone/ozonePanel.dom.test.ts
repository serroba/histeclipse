// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import history from '../../../public/data/ozone/history.json';
import type { OzoneHistory } from '../../data/ozone';
import type { LayerHost } from '../../globe/layerHost';
import { ozoneCharts } from './chartModel';
import { ozoneLayer, paintHole } from './ozoneLayer';
import { ozonePanel } from './ozonePanel';

const record = history as unknown as OzoneHistory;

describe('the ozone panel', () => {
  it('Given a year, Then two charts with the year marked, the year in words and the credits; null hides it', () => {
    const container = document.createElement('div');
    const panel = ozonePanel({ container } as unknown as LayerHost);
    const root = container.querySelector<HTMLElement>('.ozone-panel');
    expect(root?.hidden).toBe(true);
    const charts = ozoneCharts(record, 2006);
    panel.update({ charts, text: 'The spring of 2006.' });
    expect(root?.hidden).toBe(false);
    expect(root?.querySelectorAll('figure')).toHaveLength(2);
    expect(root?.querySelectorAll('.ozone-cursor')).toHaveLength(2);
    expect(root?.textContent).toContain('The spring of 2006.');
    expect(root?.textContent).toContain('NASA Ozone Watch');
    const figure = root?.querySelector('figure');
    panel.update({ charts, text: 'Again.' });
    expect(root?.querySelector('figure')).toBe(figure);
    panel.update({ charts: ozoneCharts(record, 1900), text: 'Outside.' });
    expect(root?.querySelectorAll('.ozone-cursor')).toHaveLength(0);
    panel.update(null);
    expect(root?.hidden).toBe(true);
  });
});

describe('the cap on the globe', () => {
  it('Given an area, Then its slot paints it, once per area, and null takes it away', () => {
    const shown: unknown[] = [];
    const container = document.createElement('div');
    const layer = ozoneLayer({
      container,
      historyPaint: () => ({ show: (painter: unknown) => shown.push(painter) }),
    } as unknown as LayerHost);
    layer.update(24);
    layer.update(24);
    expect(shown).toHaveLength(1);
    // Its painter paints the cap on the map it is given.
    const getContext = vi.fn(() => null);
    (shown[0] as (canvas: unknown) => void)({ getContext });
    expect(getContext).toHaveBeenCalledWith('2d');
    expect(container.dataset['ozone']).toBe('24.0');
    layer.update(null);
    expect(shown.at(-1)).toBeNull();
    expect(container.dataset['ozone']).toBe('off');
  });

  it('Given a canvas, Then the cap is painted from its edge to the pole, and no context paints nothing', () => {
    const fills: number[][] = [];
    const context = {
      createLinearGradient: () => ({ addColorStop: () => undefined }),
      fillRect: (...box: number[]) => fills.push(box),
      beginPath: () => undefined,
      moveTo: () => undefined,
      lineTo: () => undefined,
      stroke: () => undefined,
    };
    const canvas = { width: 360, height: 180, getContext: () => context };
    paintHole(canvas as unknown as HTMLCanvasElement, 24);
    const [x, y, , height] = fills[0] ?? [];
    expect(x).toBe(0);
    expect(y).toBeCloseTo(154.6, 0);
    expect((y ?? 0) + (height ?? 0)).toBe(180);
    paintHole({ getContext: () => null } as unknown as HTMLCanvasElement, 24);
    expect(fills).toHaveLength(1);
  });
});
