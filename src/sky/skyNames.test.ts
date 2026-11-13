import { Vector3 } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { fakeContainer, fakeElement, useFakeDocument } from '../test/fakes';
import type { SkyFigures } from './skyFigures';
import { SkyNames } from './skyNames';
import type { PlanetLabel, SkyPlanets } from './skyPlanets';

const page = useFakeDocument();

/** Straight ahead is the scene's −z here: things in front land at their x and y, the rest behind. */
const screenPoint = (position: Vector3): readonly [number, number] | null =>
  position.z < 0 ? [position.x / 40, position.y / 40] : null;

function names() {
  const dataset: DOMStringMap = {};
  const layer = fakeContainer();
  return { sky: new SkyNames({ layer, screenPoint, dataset }), dataset };
}

function others(planetLabels: PlanetLabel[] = []) {
  const shareNames = vi.fn();
  const placeNames = vi.fn();
  return {
    planets: { labels: planetLabels, shareNames } as unknown as SkyPlanets,
    figures: { placeNames } as unknown as SkyFigures,
    shareNames,
    placeNames,
  };
}

const byText = page.byText;

describe('SkyNames', () => {
  it('names the compass points along the horizon, the one ahead shown', () => {
    const { sky } = names();
    const { planets, figures } = others();
    sky.place({ width: 800, height: 600, sun: null, planets, figures });
    // The scene's −z is north: N is ahead, S behind.
    expect(byText('N')?.hidden).toBe(false);
    expect(byText('N')?.style.transform).toBe('translate(400px, 300px)');
    expect(byText('S')?.hidden).toBe(true);
  });

  it('reports where the Sun is on screen, or that it is down', () => {
    const { sky, dataset } = names();
    const { planets, figures } = others();
    sky.place({ width: 800, height: 600, sun: new Vector3(20, 0, -40), planets, figures });
    expect(dataset['sunAt']).toBe('600,300');
    sky.place({ width: 800, height: 600, sun: null, planets, figures });
    expect(dataset['sunAt']).toBe('off');
    sky.place({ width: 800, height: 600, sun: new Vector3(0, 0, 40), planets, figures });
    expect(dataset['sunAt']).toBe('off');
  });

  it('points out marks, each set in place of the last', () => {
    const { sky } = names();
    const { planets, figures } = others();
    sky.setMarks([{ name: 'Regulus', azimuth: 0, altitude: 10 }]);
    const first = byText('Regulus');
    sky.setMarks([{ name: 'Spica', azimuth: 180, altitude: 10 }]);
    expect(first?.remove).toHaveBeenCalled();
    sky.place({ width: 800, height: 600, sun: null, planets, figures });
    // Due south is behind the view here.
    expect(byText('Spica')?.hidden).toBe(true);
  });

  it('places the planets’ names, then lets them share, then the figures’ clear of them', () => {
    const { sky } = names();
    const venus = Object.assign(fakeElement(), { textContent: 'Venus', hidden: true });
    const label = venus as unknown as HTMLElement;
    const { planets, figures, shareNames, placeNames } = others([
      { name: 'Venus', label, position: new Vector3(0, 10, -40), shown: true },
      {
        name: 'Mars',
        label: Object.assign(fakeElement(), { hidden: true }) as unknown as HTMLElement,
        position: new Vector3(0, 0, -40),
        shown: false,
      },
    ]);
    sky.place({ width: 800, height: 600, sun: null, planets, figures });
    expect(venus.hidden).toBe(false);
    expect(shareNames).toHaveBeenCalledWith(screenPoint, 800, 600);
    const [place, kept] = placeNames.mock.calls[0] as [
      (label: HTMLElement, position: Vector3, show: boolean) => void,
      () => DOMRect[],
    ];
    expect(kept()).toHaveLength(1);
    const far = fakeElement() as unknown as HTMLElement;
    place(far, new Vector3(100, 0, -40), true);
    expect(far.hidden).toBe(true);
  });
});
