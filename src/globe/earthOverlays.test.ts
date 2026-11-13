import type { IUniform } from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { ArrivalGrid } from '../data/dispersal';
import { EarthOverlays } from './earthOverlays';
import { DEEP_PAINT_ORDER, HISTORY_PAINT_ORDER } from './layerHost';

const calls: string[] = [];
// The map is a canvas: a stand-in here, its clearing and the settled land's painting recorded.
vi.mock('./empireCanvas', () => ({
  createEmpireCanvas: () => ({ width: 2, height: 1 }),
  clearOverlay: () => calls.push('clear'),
  paintSettled: (_canvas: unknown, _grid: unknown, ka: number) =>
    calls.push(`settled ${String(ka)}`),
}));

function overlays() {
  calls.length = 0;
  const uniforms: Record<string, IUniform> = {};
  const invalidate = vi.fn();
  const dataset: DOMStringMap = {};
  const made = new EarthOverlays({ uniforms: () => uniforms, invalidate, dataset });
  return { made, uniforms, invalidate, dataset };
}

const GRID = { columns: 1, rows: 1 } as unknown as ArrivalGrid;

describe('EarthOverlays', () => {
  it('paints history’s parts in order, each told whether the states are drawn over it', () => {
    const { made, uniforms, invalidate } = overlays();
    const states = made.history.add(HISTORY_PAINT_ORDER.states);
    const first = made.history.add(-1);
    first.show((_canvas, over) => calls.push(`first ${String(over)}`));
    expect(uniforms['empiresActive']?.value).toBe(1);
    expect(uniforms['overlayMap']?.value).toBe(made.texture);
    states.show((_canvas, over) => calls.push(`states ${String(over)}`));
    expect(calls).toEqual(['clear', 'first false', 'clear', 'first true', 'states true']);
    expect(invalidate).toHaveBeenCalledTimes(2);
  });

  it('turns a map off when nothing is left on it, without painting', () => {
    const { made, uniforms } = overlays();
    const slot = made.deep.add(DEEP_PAINT_ORDER.settled + 1);
    slot.show(() => calls.push('outline'));
    calls.length = 0;
    slot.show(null);
    expect(uniforms['iceOutlinesActive']?.value).toBe(0);
    expect(calls).toEqual([]);
  });

  it('shades the settled land in whole thousands of years, once for each', () => {
    const { made, uniforms, dataset } = overlays();
    made.setSettled({ scenario: 'early', grid: GRID, ka: 44.6 });
    expect(dataset['settled']).toBe('early 45');
    expect(uniforms['iceOutlinesActive']?.value).toBe(1);
    made.setSettled({ scenario: 'early', grid: GRID, ka: 45.2 });
    expect(calls).toEqual(['clear', 'settled 45']);
    made.setSettled(null);
    expect(dataset['settled']).toBe('off');
    expect(uniforms['iceOutlinesActive']?.value).toBe(0);
  });
});
