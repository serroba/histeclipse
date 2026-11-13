import { type BufferAttribute, Vector2 } from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Figure } from './look';
import { SkyFigures } from './skyFigures';

interface FakeLabel {
  className: string;
  textContent: string;
  hidden: boolean;
  dataset: Record<string, string>;
  remove: () => void;
  getBoundingClientRect: () => DOMRect;
}

let made: FakeLabel[] = [];
/** Where each name lands on screen, by its text: a box 50 by 10 from there. */
let at: Record<string, number> = {};

beforeEach(() => {
  made = [];
  at = {};
  // Labels are plain records here: no DOM in unit tests.
  vi.stubGlobal('document', {
    createElement: () => {
      const label: FakeLabel = {
        className: '',
        textContent: '',
        hidden: true,
        dataset: {},
        remove: vi.fn(),
        getBoundingClientRect: () => {
          const x = at[label.textContent] ?? 0;
          return { left: x, right: x + 50, top: 0, bottom: 10 } as DOMRect;
        },
      };
      made.push(label);
      return label;
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// Three stars up high, and one star that is below the horizon.
const STARS = new Float32Array([0, 100, 0, 10, 100, 0, 0, 100, 10, 0, -100, 0]);
const BIG: Figure = { name: 'Orion', rank: 1, lines: [[0, 1, 2]] };
const SMALL: Figure = { name: 'Lyra', rank: 2, lines: [[0, 1]], native: 'Lyre' };
const LOW: Figure = { name: 'Crux', rank: 1, lines: [[3, 3]] };

function figures(start: 'famous' | 'all' | 'none' = 'all') {
  const invalidate = vi.fn();
  const sky = new SkyFigures({
    projection: {
      skyScale: { value: new Vector2(1, 1) },
      skyShift: { value: new Vector2() },
      skyClip: { value: 0 },
      skyViewport: { value: new Vector2(1, 1) },
    },
    labelLayer: { append: vi.fn() } as unknown as HTMLElement,
    stars: STARS,
    modern: [BIG, SMALL, LOW],
    figures: start,
    invalidate,
  });
  return { sky, invalidate };
}

const positions = (sky: SkyFigures): number =>
  (sky.lines.geometry.getAttribute('position') as BufferAttribute).count;

describe('SkyFigures', () => {
  it('draws each line in pieces, and names each figure, in its own script too', () => {
    const { sky, invalidate } = figures();
    // Orion's two lines, Lyra's one and Crux's one: 4 lines of 8 pieces, 2 points each.
    expect(positions(sky)).toBe(4 * 8 * 2);
    expect(made.map(({ textContent }) => textContent)).toEqual(['Orion', 'Lyra · Lyre', 'Crux']);
    expect(invalidate).toHaveBeenCalled();
  });

  it('draws the famous figures alone, or none, and says which names are shown', () => {
    const { sky } = figures('famous');
    expect(positions(sky)).toBe(3 * 8 * 2);
    expect(made.map(({ dataset }) => dataset['shown'])).toEqual(['true', 'false', 'true']);
    sky.setFigures('famous');
    sky.setFigures('none');
    expect(positions(sky)).toBe(0);
  });

  it('turns to another culture and back, its names made anew', () => {
    const { sky } = figures();
    const other: Figure[] = [{ name: 'Plough', rank: 1, lines: [[0, 2]] }];
    sky.setCulture(other);
    sky.setCulture(other);
    expect(made.slice(0, 3).every(({ remove }) => vi.mocked(remove).mock.calls.length === 1)).toBe(
      true,
    );
    expect(made.at(-1)?.textContent).toBe('Plough');
    sky.setCulture(null);
    expect(made.at(-1)?.textContent).toBe('Crux');
  });

  it('draws a star missing from the catalogue at the centre, not as nothing', () => {
    const invalidate = vi.fn();
    const sky = new SkyFigures({
      projection: {
        skyScale: { value: new Vector2(1, 1) },
        skyShift: { value: new Vector2() },
        skyClip: { value: 0 },
        skyViewport: { value: new Vector2(1, 1) },
      },
      labelLayer: { append: vi.fn() } as unknown as HTMLElement,
      stars: STARS,
      modern: [{ name: 'Lost', rank: 1, lines: [[1, 99]] }],
      figures: 'all',
      invalidate,
    });
    const line = (sky.lines.geometry.getAttribute('position') as BufferAttribute).array;
    // The last piece ends at the missing star, taken as the centre.
    expect([...line.slice(-3)]).toEqual([0, 0, 0]);
    expect(line[0]).toBe(10);
  });

  it('fades the lines as the Sun rises', () => {
    const { sky } = figures();
    const opacity = (sky.lines.material as unknown as { uniforms: { opacity: { value: number } } })
      .uniforms.opacity;
    sky.setSunAltitude(-30);
    expect(opacity.value).toBeCloseTo(0.4);
    sky.setSunAltitude(10);
    expect(opacity.value).toBeCloseTo(0.12);
  });

  it('places the biggest names first, leaves out overlaps and those low in the sky', () => {
    const { sky } = figures();
    at = { Orion: 0, 'Lyra · Lyre': 30, Crux: 200 };
    const place = vi.fn((label: HTMLElement, _position: unknown, show: boolean) => {
      label.hidden = !show;
    });
    const kept = vi.fn(() => [{ left: 500, right: 550, top: 0, bottom: 10 } as DOMRect]);
    sky.placeNames(place, kept);
    expect(place).toHaveBeenCalledTimes(3);
    const byName = (text: string) => made.find(({ textContent }) => textContent === text);
    expect(byName('Orion')?.hidden).toBe(false);
    expect(byName('Lyra · Lyre')?.hidden).toBe(true);
    // Crux's stars are below the horizon, so its name is not shown at all.
    expect(byName('Crux')?.hidden).toBe(true);
  });

  it('leaves out a name that would overlap a planet’s', () => {
    const { sky } = figures();
    at = { Orion: 0 };
    sky.placeNames(
      (label, _position, show) => {
        label.hidden = !show;
      },
      () => [{ left: 10, right: 60, top: 0, bottom: 10 } as DOMRect],
    );
    expect(made.find(({ textContent }) => textContent === 'Orion')?.hidden).toBe(true);
  });
});
