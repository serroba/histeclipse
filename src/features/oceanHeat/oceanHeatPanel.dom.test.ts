// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import index from '../../../public/data/ocean-heat-map/index.json';
import type { OceanHeatMap } from '../../data/oceanHeat';
import type { LayerHost } from '../../globe/layerHost';
import { colouredMap, oceanHeatLayer } from './oceanHeatLayer';
import { oceanHeatPanel } from './oceanHeatPanel';

const maps = index.maps as unknown as readonly OceanHeatMap[];

describe('the ocean heat panel', () => {
  it('Given the maps, Then a picker of three, the bound, the words; picking reports it; null hides it', () => {
    const container = document.createElement('div');
    const pick = vi.fn();
    const panel = oceanHeatPanel(pick)({ container } as unknown as LayerHost);
    const root = container.querySelector<HTMLElement>('.ocean-heat-panel');
    panel.update({ maps, shown: '0-700m-1960-2025', text: 'Shown.' });
    expect(root?.hidden).toBe(false);
    const picker = root?.querySelector('select');
    expect([...(picker?.options ?? [])].map((option) => option.textContent)).toEqual([
      '0-700 m, 1960–2025',
      '0-2000 m, 1960–2025',
      '0-2000 m, 2005–2025',
    ]);
    expect(picker?.value).toBe('0-700m-1960-2025');
    expect(root?.textContent).toContain('−3 · 0 · +3');
    expect(root?.textContent).toContain('Heat content, not temperature.');
    const options = picker?.options[0];
    panel.update({ maps, shown: 'gone', text: 'Again.' });
    expect(picker?.options[0]).toBe(options);
    expect(root?.querySelector('.ocean-heat-bound')?.textContent).toBe('');
    if (picker !== undefined && picker !== null) {
      picker.value = '0-2000m-2005-2025';
      picker.dispatchEvent(new Event('change'));
    }
    expect(pick).toHaveBeenCalledWith('0-2000m-2005-2025');
    panel.update(null);
    expect(root?.hidden).toBe(true);
  });
});

describe('the painted map', () => {
  it('Given a map, Then its slot paints it, once per map, and null takes it away', () => {
    const shown: unknown[] = [];
    const container = document.createElement('div');
    const layer = oceanHeatLayer({
      container,
      historyPaint: () => ({ show: (painter: unknown) => shown.push(painter) }),
    } as unknown as LayerHost);
    const image = Object.assign(document.createElement('canvas'), { width: 2, height: 1 });
    const packed = { image, bound: 3 };
    layer.update(packed);
    layer.update(packed);
    expect(container.dataset['oceanHeat']).toBe('on');
    layer.update(null);
    expect(shown.at(-1)).toBeNull();
    expect(container.dataset['oceanHeat']).toBe('off');
  });

  it('Given no 2D context, Then the map is not coloured', () => {
    const image = Object.assign(document.createElement('canvas'), { width: 2, height: 1 });
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    expect(colouredMap({ image, bound: 3 })).toBeNull();
    spy.mockRestore();
  });
});
