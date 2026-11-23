// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import type { BoundaryFrame } from '../../data/plateBoundaries';
import { BOUNDARY_STYLES, paintBoundaries } from './boundaryCanvas';
import type { DeepPainter, LayerHost } from '../../globe/layerHost';
import { plateBoundaryLayer } from './plateBoundaryLayer';

const FRAME: BoundaryFrame = {
  ma: 0,
  lines: {
    ridge: [
      [
        [-110, -10],
        [-110, 10],
      ],
    ],
    subduction: [
      [
        [140, 30],
        [142, 40],
      ],
    ],
    transform: [],
    other: [
      [
        [0, 0],
        [10, 0],
      ],
    ],
  },
};

describe('the plate boundaries on deep time’s map (#1160)', () => {
  it('paint again only for a new frame, and go when hidden', () => {
    const shows: (DeepPainter | null)[] = [];
    const host = {
      container: document.createElement('div'),
      deepPaint: () => ({ show: (painter: DeepPainter | null) => shows.push(painter) }),
    } as unknown as LayerHost;
    const layer = plateBoundaryLayer(host);
    layer.update({ key: '0:0', frame: FRAME });
    layer.update({ key: '0:0', frame: FRAME });
    expect(shows).toHaveLength(1);
    expect(host.container.dataset['plateBoundaries']).toBe('0:0');
    layer.update(null);
    expect(shows.at(-1)).toBeNull();
    expect(host.container.dataset['plateBoundaries']).toBe('off');
  });

  it('stroke each kind in its own style, the faint ones first', () => {
    const strokes: string[] = [];
    const context = {
      canvas: { width: 360, height: 180 },
      strokeStyle: '',
      lineWidth: 0,
      lineJoin: '',
      lineCap: '',
      setLineDash: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      stroke() {
        strokes.push(this.strokeStyle);
      },
    };
    const canvas = { getContext: () => context } as unknown as HTMLCanvasElement;
    paintBoundaries(canvas, FRAME);
    expect(strokes).toEqual([
      BOUNDARY_STYLES.other.colour,
      BOUNDARY_STYLES.subduction.colour,
      BOUNDARY_STYLES.ridge.colour,
    ]);
    expect(context.closePath).not.toHaveBeenCalled();
    // The ridge at 110° W, from 10° S to 10° N: x 70, y 100 to 80 on a 360 × 180 map.
    expect(context.moveTo).toHaveBeenCalledWith(70, 100);
    expect(context.lineTo).toHaveBeenCalledWith(70, 80);
  });

  it('paint nothing without a 2D context', () => {
    const canvas = { getContext: () => null } as unknown as HTMLCanvasElement;
    expect(() => {
      paintBoundaries(canvas, FRAME);
    }).not.toThrow();
  });
});
