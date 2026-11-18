// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import type { LayerHost } from '../../globe/layerHost';
import { coloured, ensoMapLayer } from './ensoMapLayer';

describe('the painted sea temperature', () => {
  it('Given a month, Then its slot paints it, once per month, and null takes it away', () => {
    const shown: (((canvas: HTMLCanvasElement) => void) | null)[] = [];
    const container = document.createElement('div');
    const layer = ensoMapLayer({
      container,
      historyPaint: () => ({
        show: (painter: ((canvas: HTMLCanvasElement) => void) | null) => shown.push(painter),
      }),
    } as unknown as LayerHost);
    const image = Object.assign(document.createElement('canvas'), { width: 2, height: 1 });
    const packed = { image, bound: 4 };
    layer.update(packed);
    layer.update(packed);
    expect(container.dataset['ensoSst']).toBe('on');
    expect(shown).toHaveLength(1);
    shown[0]?.(document.createElement('canvas'));
    layer.update(null);
    expect(shown.at(-1)).toBeNull();
    expect(container.dataset['ensoSst']).toBe('off');
  });

  it('Given no 2D context, Then the month is not coloured, and nothing is painted', () => {
    const image = Object.assign(document.createElement('canvas'), { width: 2, height: 1 });
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    expect(coloured({ image, bound: 4 })).toBeNull();
    const shown: unknown[] = [];
    const layer = ensoMapLayer({
      container: document.createElement('div'),
      historyPaint: () => ({ show: (painter: unknown) => shown.push(painter) }),
    } as unknown as LayerHost);
    layer.update({ image, bound: 4 });
    expect(shown).toEqual([null]);
    spy.mockRestore();
  });
});
