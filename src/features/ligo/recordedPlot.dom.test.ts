// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';

import * as v from 'valibot';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GW170817_SCHEMA } from './recorded';
import { createRecordedPlot } from './recordedPlot';

const data = v.parse(
  GW170817_SCHEMA,
  JSON.parse(readFileSync('public/data/gw170817.json', 'utf8')) as unknown,
);

describe('what LIGO and Virgo recorded, drawn (#1000)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('paints each map into its canvas, and moves the cursor and clock with the wave', () => {
    const put = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      createImageData: (width: number, height: number) => ({
        data: new Uint8ClampedArray(width * height * 4),
      }),
      putImageData: put,
    } as unknown as CanvasRenderingContext2D);
    const plot = createRecordedPlot(data, 4.43);
    expect(put).toHaveBeenCalledTimes(3);
    const painted = put.mock.calls[0]?.[0] as { data: Uint8ClampedArray };
    expect(painted.data.every((value, index) => index % 4 !== 3 || value === 255)).toBe(true);
    plot.setTime(4.43);
    const cursor = plot.root.querySelector('.strain-cursor');
    expect(Number(cursor?.getAttribute('x1'))).toBeCloseTo((8 / 8.484_375) * 600, 0);
    expect(plot.root.querySelector('[data-testid="strain-clock"]')?.textContent).toBe(
      '12:41:04.430 UTC',
    );
    plot.setTime(100);
    expect(cursor?.getAttribute('x1')).toBe('600.0');
  });

  it('still lays out its panels where a canvas cannot be drawn on', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const plot = createRecordedPlot(data, 4.43);
    expect(plot.root.querySelectorAll('canvas')).toHaveLength(3);
    expect(plot.root.textContent).toContain('30 to 500 Hz');
  });
});
