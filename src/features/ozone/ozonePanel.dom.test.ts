// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import history from '../../../public/data/ozone/history.json';
import type { OzoneHistory } from '../../data/ozone';
import type { LayerHost } from '../../globe/layerHost';
import { ozoneCharts } from './chartModel';
import { ozoneLayer, paintHole } from './ozoneLayer';
import { ozonePanel } from './ozonePanel';

const record = history as unknown as OzoneHistory;

describe('the ozone panel', () => {
  it('Given a year, Then two charts with the year marked, the year in words and the credits; null hides it', () => {
    const container = document.createElement('div');
    const panel = ozonePanel({ container } as unknown as LayerHost);
    const root = container.querySelector<HTMLElement>('.ozone-panel');
    expect(root?.hidden).toBe(true);
    const charts = ozoneCharts(record, 2006);
    panel.update({ charts, text: 'The spring of 2006.', map: null, surface: false });
    const key = root?.querySelector<HTMLElement>('.ozone-key');
    expect(key?.hidden).toBe(true);
    expect(root?.hidden).toBe(false);
    expect(root?.querySelectorAll('figure')).toHaveLength(2);
    expect(root?.querySelectorAll('.ozone-cursor')).toHaveLength(2);
    expect(root?.textContent).toContain('The spring of 2006.');
    expect(root?.textContent).toContain('NASA Ozone Watch');
    const figure = root?.querySelector('figure');
    panel.update({
      charts,
      text: 'Again.',
      map: 'Globe: ozone in October 2006, Dobson units.',
      surface: false,
    });
    // With a map on the globe, the key to its colours: the scale's five amounts, the hole, gaps.
    expect(key?.hidden).toBe(false);
    expect(key?.textContent).toContain('Globe: ozone in October 2006, Dobson units.');
    expect([...(key?.querySelectorAll('li') ?? [])].map((item) => item.textContent)).toEqual([
      '220',
      '265',
      '310',
      '355',
      '400',
      'Under 220: the hole, left open',
      'Grey: no value',
    ]);
    expect(key?.querySelectorAll('.ozone-swatch')).toHaveLength(5);
    expect(root?.textContent).toContain('MSR-2 reanalysis (KNMI)');
    expect(root?.querySelector('figure')).toBe(figure);
    // With the surface on the globe, the key says what its opening is; with the map again,
    // the map's key.
    panel.update({ charts, text: 'A day.', map: 'Globe: the ozone layer.', surface: true });
    expect(key?.textContent).toContain('Open: no height holds that much ozone');
    expect(key?.textContent).not.toContain('Grey: no value');
    expect(root?.textContent).toContain('CAMS reanalysis');
    panel.update({ charts, text: 'A year.', map: 'A map.', surface: false });
    expect(key?.textContent).toContain('Grey: no value');
    panel.update({
      charts: ozoneCharts(record, 1900),
      text: 'Outside.',
      map: null,
      surface: false,
    });
    expect(root?.querySelectorAll('.ozone-cursor')).toHaveLength(0);
    panel.update(null);
    expect(root?.hidden).toBe(true);
  });
});

describe('the cap on the globe', () => {
  it('Given an area, Then its slot paints it, once per area, and null takes it away', () => {
    const shown: unknown[] = [];
    const container = document.createElement('div');
    const layer = ozoneLayer({
      container,
      historyPaint: () => ({ show: (painter: unknown) => shown.push(painter) }),
    } as unknown as LayerHost);
    layer.update({ capMkm2: 24 });
    layer.update({ capMkm2: 24 });
    expect(shown).toHaveLength(1);
    // Its painter paints the cap on the map it is given.
    const getContext = vi.fn(() => null);
    (shown[0] as (canvas: unknown) => void)({ getContext });
    expect(getContext).toHaveBeenCalledWith('2d');
    expect(container.dataset['ozone']).toBe('24.0');
    layer.update(null);
    expect(shown.at(-1)).toBeNull();
    expect(container.dataset['ozone']).toBe('off');
  });

  it('Given an October’s map, Then it is coloured once and stretched over the map it is given; with no context to colour on, nothing is painted', () => {
    const shown: unknown[] = [];
    const container = document.createElement('div');
    const layer = ozoneLayer({
      container,
      historyPaint: () => ({ show: (painter: unknown) => shown.push(painter) }),
    } as unknown as LayerHost);
    // Two pixels: 310 Dobson units, and deep in the hole.
    const pixels = new Uint8ClampedArray([105, 105, 105, 255, 20, 20, 20, 255]);
    const put = vi.fn();
    const drawn = vi.fn();
    const colouring = {
      drawImage: drawn,
      getImageData: () => ({ data: pixels }),
      putImageData: put,
    };
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(colouring as unknown as CanvasRenderingContext2D);
    const image = { width: 2, height: 1 } as unknown as HTMLImageElement;
    const map = { year: 2006, image, encoding: { offsetDU: 100, stepDU: 2 } };
    layer.update({ map });
    layer.update({ map });
    expect(shown).toHaveLength(1);
    expect(container.dataset['ozone']).toBe('map:2006');
    expect(drawn).toHaveBeenCalledWith(image, 0, 0);
    // Coloured in place: pale grey at 310, clear in the hole.
    expect([...pixels.slice(0, 4)]).toEqual([221, 220, 219, 199]);
    expect(pixels[7]).toBe(0);
    expect(put).toHaveBeenCalledOnce();
    const stretched = vi.fn();
    (shown[0] as (canvas: unknown) => void)({
      width: 720,
      height: 360,
      getContext: () => ({ drawImage: stretched }),
    });
    expect(stretched).toHaveBeenCalledWith(expect.anything(), 0, 0, 720, 360);
    (shown[0] as (canvas: unknown) => void)({ getContext: () => null });

    getContext.mockReturnValue(null);
    layer.update({ map: { ...map, year: 2007 } });
    expect(shown.at(-1)).toBeNull();
    getContext.mockRestore();
  });

  it('Given a canvas, Then the cap is painted from its edge to the pole, and no context paints nothing', () => {
    const fills: number[][] = [];
    const context = {
      createLinearGradient: () => ({ addColorStop: () => undefined }),
      fillRect: (...box: number[]) => fills.push(box),
      beginPath: () => undefined,
      moveTo: () => undefined,
      lineTo: () => undefined,
      stroke: () => undefined,
    };
    const canvas = { width: 360, height: 180, getContext: () => context };
    paintHole(canvas as unknown as HTMLCanvasElement, 24);
    const [x, y, , height] = fills[0] ?? [];
    expect(x).toBe(0);
    expect(y).toBeCloseTo(154.6, 0);
    expect((y ?? 0) + (height ?? 0)).toBe(180);
    paintHole({ getContext: () => null } as unknown as HTMLCanvasElement, 24);
    expect(fills).toHaveLength(1);
  });
});
