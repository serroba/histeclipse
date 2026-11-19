// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { pixelsOf } from './pixels';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('a packed map’s bytes', () => {
  it('Given no 2D canvas, Then none', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    expect(pixelsOf(document.createElement('canvas'))).toBeNull();
  });

  it('Given a canvas, Then the bytes, read once per image', () => {
    const bytes = new Uint8ClampedArray([1, 2, 3, 4]);
    const getImageData = vi.fn(() => ({ data: bytes }));
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
      getImageData,
    } as unknown as CanvasRenderingContext2D);
    const image = Object.assign(document.createElement('canvas'), { width: 1, height: 1 });
    expect(pixelsOf(image)).toBe(bytes);
    expect(pixelsOf(image)).toBe(bytes);
    expect(getImageData).toHaveBeenCalledOnce();
  });
});
