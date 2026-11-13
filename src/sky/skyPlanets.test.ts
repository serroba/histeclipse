import type { Vector3 } from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDENTITY, type Vector3 as Vec3 } from '../astro/matrix';
import { SkyPlanets } from './skyPlanets';

beforeEach(() => {
  // Labels are plain records here: no DOM in unit tests.
  vi.stubGlobal('document', {
    createElement: () => ({ className: '', textContent: '', hidden: true }),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function planets() {
  const dataset: DOMStringMap = {};
  const layer = { append: vi.fn() } as unknown as HTMLElement;
  return { made: new SkyPlanets({ uniforms: {}, labelLayer: layer, dataset }), dataset };
}

/** Straight up, and a little off it, in the horizon frame (J2000 with the identity turn). */
const UP: Vec3 = [0, 0, 1];
const NEAR_UP: Vec3 = [0.001, 0, 1];
const STILL: Vec3 = [0, 0, 0];
const moment = { horizon: IDENTITY, limit: 6, sunHere: null, moonHere: null, motion: STILL };

describe('SkyPlanets', () => {
  it('names the five naked-eye planets, hidden until placed', () => {
    const { made } = planets();
    expect(made.labels.map(({ name }) => name)).toEqual([
      'Mercury',
      'Venus',
      'Mars',
      'Jupiter',
      'Saturn',
    ]);
    expect(made.labels.every(({ shown }) => !shown)).toBe(true);
  });

  it('shows a bright planet overhead, leaves out those not given, and reports each', () => {
    const { made, dataset } = planets();
    made.place({ ...moment, planets: [{ name: 'Venus', direction: UP, magnitude: -4 }] });
    expect(made.labels.find(({ name }) => name === 'Venus')?.shown).toBe(true);
    expect(made.labels.find(({ name }) => name === 'Mars')?.shown).toBe(false);
    expect(dataset['planets']).toBe('Venus:90.00:0.00:-4.0:seen');
  });

  it('hides a planet behind the Moon, and one too faint or below the horizon', () => {
    const { made, dataset } = planets();
    made.place({
      ...moment,
      moonHere: [0, 0, 384_400],
      planets: [
        { name: 'Jupiter', direction: UP, magnitude: -2 },
        { name: 'Saturn', direction: [1, 0, 0.5], magnitude: 9 },
        { name: 'Mars', direction: [1, 0, -1], magnitude: 0 },
      ],
    });
    expect(made.labels.every(({ shown }) => !shown)).toBe(true);
    expect(dataset['planets']).toContain('Jupiter:90.00:0.00:-2.0:covered');
    expect(dataset['planets']).toContain(':unseen');
  });

  it('gives planets close together on screen one name', () => {
    const { made } = planets();
    made.place({
      ...moment,
      planets: [
        { name: 'Jupiter', direction: UP, magnitude: -2 },
        { name: 'Saturn', direction: NEAR_UP, magnitude: 0.5 },
        { name: 'Mars', direction: [1, 0, 1], magnitude: 0 },
      ],
    });
    for (const entry of made.labels) entry.label.hidden = !entry.shown;
    // Overhead and just off it land on the same pixel; Mars far across the screen.
    const screen = ({ x }: Vector3): readonly [number, number] => [x > 1 ? 0.8 : 0, 0];
    made.shareNames(screen, 800, 600);
    const label = (name: string) => made.labels.find((entry) => entry.name === name)?.label;
    expect(label('Jupiter')?.textContent).toBe('Jupiter & Saturn');
    expect(label('Saturn')?.hidden).toBe(true);
    expect(label('Mars')?.textContent).toBe('Mars');
    expect(label('Venus')?.hidden).toBe(true);
  });

  it('skips a name behind the viewer, which keeps its own', () => {
    const { made } = planets();
    made.place({ ...moment, planets: [{ name: 'Mars', direction: UP, magnitude: 0 }] });
    const mars = made.labels.find(({ name }) => name === 'Mars');
    if (mars !== undefined) mars.label.hidden = false;
    made.shareNames(() => null, 800, 600);
    expect(mars?.label.textContent).toBe('Mars');
    expect(mars?.label.hidden).toBe(false);
  });
});
