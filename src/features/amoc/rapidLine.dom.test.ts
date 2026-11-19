// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { LayerHost } from '../../globe/layerHost';
import { lineOnMap, rapidLine } from './rapidLine';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the RAPID line on the globe (#925)', () => {
  it('Given a map, Then the line at 26.5°N from Florida to Africa', () => {
    const { x1, x2, y } = lineOnMap(3600, 1800);
    expect(x1).toBeCloseTo(999, 0);
    expect(x2).toBeCloseTo(1665, 0);
    expect(y).toBeCloseTo(635, 0);
  });

  it('Given it on, Then its slot paints a line, once; off takes it away', () => {
    const shown: (((canvas: HTMLCanvasElement) => void) | null)[] = [];
    const container = document.createElement('div');
    const layer = rapidLine({
      container,
      historyPaint: () => ({
        show: (painter: ((c: HTMLCanvasElement) => void) | null) => shown.push(painter),
      }),
    } as unknown as LayerHost);
    layer.update(true);
    layer.update(true);
    expect(shown).toHaveLength(1);
    expect(container.dataset['amocLine']).toBe('on');
    const stroke = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      setLineDash: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke,
    } as unknown as CanvasRenderingContext2D);
    const canvas = Object.assign(document.createElement('canvas'), { width: 3600, height: 1800 });
    shown[0]?.(canvas);
    expect(stroke).toHaveBeenCalledOnce();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    shown[0]?.(canvas);
    layer.update(false);
    expect(shown.at(-1)).toBeNull();
    expect(container.dataset['amocLine']).toBe('off');
  });
});
