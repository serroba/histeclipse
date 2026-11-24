// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { glowTexture } from './glowTexture';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the glow an impact is drawn with', () => {
  it('paints a gradient white at the heart, warm or icy at the edge', () => {
    const stops: [number, string][] = [];
    const fills: number[][] = [];
    const context = {
      createRadialGradient: () => ({
        addColorStop: (at: number, colour: string) => stops.push([at, colour]),
      }),
      fillStyle: null as unknown,
      fillRect: (...box: number[]) => fills.push(box),
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      context as unknown as CanvasRenderingContext2D,
    );
    const warm = glowTexture(false);
    expect(warm.image.width).toBe(64);
    expect(stops[0]).toEqual([0, 'rgba(255,255,255,1)']);
    expect(stops[2]?.[1]).toBe('rgba(255,120,40,0)');
    glowTexture(true);
    expect(stops[5]?.[1]).toBe('rgba(80,150,255,0)');
    expect(fills).toEqual([
      [0, 0, 64, 64],
      [0, 0, 64, 64],
    ]);
  });

  it('is a texture still where the canvas draws nothing', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    expect(glowTexture(false).image).toBeInstanceOf(HTMLCanvasElement);
  });
});
