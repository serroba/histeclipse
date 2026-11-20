// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fieldFromImage } from './fieldImage';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('a month’s currents read from its image (#927)', () => {
  it('Given a canvas, Then the field, read once per image; none without a canvas', () => {
    const getImageData = vi.fn(() => ({ data: new Uint8ClampedArray([255, 0, 128, 255]) }));
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
      getImageData,
    } as unknown as CanvasRenderingContext2D);
    const image = Object.assign(document.createElement('canvas'), { width: 1, height: 1 });
    const field = fieldFromImage(image, 0.5);
    expect(field?.u[0]).toBeCloseTo(0.5);
    expect(fieldFromImage(image, 0.5)).toBe(field);
    expect(getImageData).toHaveBeenCalledOnce();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const other = Object.assign(document.createElement('canvas'), { width: 1, height: 1 });
    expect(fieldFromImage(other, 0.5)).toBeNull();
  });
});
