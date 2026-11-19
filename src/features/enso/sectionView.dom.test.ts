// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { rowSpans, sectionFigure } from './sectionView';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the equatorial Pacific from below (#895)', () => {
  it('Given uneven depths, Then each row drawn as deep as it reaches, the surface to the deepest', () => {
    const spans = rowSpans([0, 10, 20, 40]);
    expect(spans[0]).toEqual({ top: 0, bottom: 5 / 40 });
    expect(spans[2]).toEqual({ top: 15 / 40, bottom: 30 / 40 });
    expect(spans[3]).toEqual({ top: 30 / 40, bottom: 1 });
    expect(rowSpans([])).toEqual([]);
  });

  it('Given a section, Then a row drawn for each depth, once; null hides the figure', () => {
    const drawImage = vi.fn();
    const pixels = { data: new Uint8ClampedArray(16) };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage,
      clearRect: vi.fn(),
      getImageData: () => pixels,
      putImageData: vi.fn(),
      imageSmoothingEnabled: true,
    } as unknown as CanvasRenderingContext2D);
    const figure = sectionFigure();
    const image = Object.assign(document.createElement('canvas'), { width: 2, height: 3 });
    const view = { packed: { image, bound: 4 }, levels: [1, 50, 100], at: 1997 * 12 + 11 };
    figure.draw(view, 'Under the equator, December 1997');
    expect(figure.root.hidden).toBe(false);
    expect(figure.root.textContent).toContain('Under the equator, December 1997');
    // The image drawn into the coloured copy, then one slice a depth onto the figure.
    expect(drawImage).toHaveBeenCalledTimes(1 + 3);
    figure.draw(view, 'Again');
    expect(drawImage).toHaveBeenCalledTimes(4);
    figure.draw(null, '');
    expect(figure.root.hidden).toBe(true);
  });

  it('Given no 2D canvas, Then nothing drawn, and no error', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const figure = sectionFigure();
    const image = Object.assign(document.createElement('canvas'), { width: 2, height: 3 });
    figure.draw({ packed: { image, bound: 4 }, levels: [1, 2], at: 0 }, 'x');
    expect(figure.root.hidden).toBe(false);
  });
});
