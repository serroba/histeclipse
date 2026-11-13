import { Group, Mesh, Vector3 } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { IDENTITY, type Matrix3 } from '../astro/matrix';
import { PLANETS } from '../astro/planets';
import type { Body } from '../state/viewState';
import { BodiesInSpace } from './bodiesInSpace';
import type { MoonMeshes } from './moonMeshes';
import type { PlanetMeshes } from './planetMeshes';
import type { SunMeshes } from './sunMeshes';

const EARTH_RADIUS_KM = 6378.137;
/** A quarter turn about the pole: x → y. */
const QUARTER: Matrix3 = [
  [0, -1, 0],
  [1, 0, 0],
  [0, 0, 1],
];

function space() {
  const sun = new Mesh();
  const sunMeshes = {
    sun,
    place: vi.fn((position: Vector3) => sun.position.copy(position)),
  } as unknown as SunMeshes;
  const moon = new Mesh();
  const placePlanets = vi.fn<PlanetMeshes['place']>();
  const placeMoons = vi.fn<MoonMeshes['place']>();
  const planets = { place: placePlanets } as unknown as PlanetMeshes;
  const moonSystems = { place: placeMoons } as unknown as MoonMeshes;
  const orbits = new Group();
  // Every body its own mesh; the planets apart, as they are placed elsewhere.
  const made = new Map<string, Mesh>([
    ['sun', sun],
    ['moon', moon],
  ]);
  const meshes = new Proxy({} as Record<Body, Mesh>, {
    get: (_, key: string) => made.get(key) ?? made.set(key, new Mesh()).get(key),
  });
  const dataset: DOMStringMap = {};
  const earthUniforms = {};
  const sunPosition = new Vector3();
  const moonPosition = new Vector3();
  const bodies = new BodiesInSpace({
    sunMeshes,
    moon,
    planets,
    moonSystems,
    orbits,
    meshes,
    sunPosition,
    moonPosition,
    earthUniforms,
    dataset,
  });
  return {
    bodies,
    sun,
    moon,
    placePlanets,
    placeMoons,
    orbits,
    meshes,
    dataset,
    earthUniforms,
    sunPosition,
    moonPosition,
  };
}

const SUN_KM: [number, number, number] = [EARTH_RADIUS_KM * 1000, 0, 0];
const MOON_KM: [number, number, number] = [0, 0, EARTH_RADIUS_KM * 60];

describe('BodiesInSpace', () => {
  it('places the Sun, its orbits and the Moon, and shares where they are', () => {
    const world = space();
    world.bodies.place({
      earthFixedToJ2000: IDENTITY,
      sunKm: SUN_KM,
      moonKm: MOON_KM,
      planetsKm: null,
      jdTT: 2_451_545,
    });
    expect(world.sun.position.x).toBeCloseTo(1000);
    expect(world.sunPosition.equals(world.sun.position)).toBe(true);
    expect(world.orbits.position.equals(world.sun.position)).toBe(true);
    // J2000 +z is the scene's +y.
    expect(world.moon.position.y).toBeCloseTo(60);
    expect(world.moon.visible).toBe(true);
    expect(world.moonPosition.equals(world.moon.position)).toBe(true);
    expect(world.earthUniforms).toHaveProperty('moonRadius');
    expect(world.dataset).toMatchObject({ planets: 'off', space: 'moon' });
    expect(world.placePlanets).toHaveBeenCalledWith(
      null,
      world.sun.position,
      world.bodies.sunFrame,
      undefined,
    );
    expect(world.placeMoons).toHaveBeenCalledWith(
      2_451_545,
      null,
      world.sun.position,
      world.bodies.sunFrame,
    );
  });

  it('hides the Moon until its ephemeris loads, and places the planets and their moons', () => {
    const world = space();
    const planetsKm = Object.fromEntries(PLANETS.map((planet) => [planet, SUN_KM])) as never;
    world.bodies.place({
      earthFixedToJ2000: IDENTITY,
      sunKm: SUN_KM,
      moonKm: null,
      planetsKm,
      jdTT: 1,
    });
    expect(world.moon.visible).toBe(false);
    expect(world.dataset).toMatchObject({ planets: 'on', space: 'sun' });
    const [positions, , , turn] = world.placePlanets.mock.calls[0] ?? [];
    expect(Object.keys(positions ?? {})).toEqual([...PLANETS]);
    expect(turn).toEqual({ jdTT: 1, km: planetsKm });
    const [, around] = world.placeMoons.mock.calls[0] ?? [];
    expect(around?.jupiter).toBe(world.meshes.jupiter.position);
  });

  it('says how Earth turned since the last moment, from the second on', () => {
    const world = space();
    expect(world.bodies.turnSince(QUARTER)).toBeNull();
    world.bodies.place({
      earthFixedToJ2000: IDENTITY,
      sunKm: SUN_KM,
      moonKm: null,
      planetsKm: null,
      jdTT: 0,
    });
    const turn = world.bodies.turnSince(QUARTER);
    expect(turn).not.toBeNull();
    expect(world.bodies.turnSince(IDENTITY)).toEqual(IDENTITY);
  });

  it('gives each body its frame: the Moon turned to its map, the rest in J2000', () => {
    const world = space();
    world.bodies.place({
      earthFixedToJ2000: QUARTER,
      sunKm: SUN_KM,
      moonKm: MOON_KM,
      planetsKm: null,
      jdTT: 0,
    });
    expect(world.bodies.frame('moon').position).toBe(world.moon.position);
    expect(world.bodies.frame('moon').rotation.equals(world.moon.quaternion)).toBe(false);
    expect(world.bodies.frame('sun')).toEqual({
      position: world.sun.position,
      rotation: world.bodies.sunFrame,
    });
    expect(world.bodies.frame('mars').position).toBe(world.meshes.mars.position);
    expect(world.bodies.frame('io').rotation).toBe(world.bodies.sunFrame);
    expect(world.bodies.frame('earth').position.length()).toBe(0);
  });

  it('turns J2000 km into the scene, once a moment is shown', () => {
    const world = space();
    expect(world.bodies.spaceToScene()).toBeNull();
    world.bodies.place({
      earthFixedToJ2000: IDENTITY,
      sunKm: SUN_KM,
      moonKm: null,
      planetsKm: null,
      jdTT: 0,
    });
    const toScene = world.bodies.spaceToScene();
    expect(toScene?.([0, 0, EARTH_RADIUS_KM])).toEqual([0, 1, -0]);
  });
});
