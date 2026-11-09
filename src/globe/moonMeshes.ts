/**
 * The moons of Mars, Jupiter and Saturn in the space view (#335): each at its true size, lit
 * by the Sun, going round its planet as its orbit (`astro/moonOrbits.ts`) says, its path drawn
 * faintly while its planet is in view. Each moon is painted one colour, roughly its own; they
 * are spheres, though Phobos, Deimos and Hyperion are not.
 */

import {
  BufferGeometry,
  DataTexture,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineLoop,
  Mesh,
  type Quaternion,
  RGBAFormat,
  type Scene,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
} from 'three';

import {
  MOONS,
  moonPosition,
  type MoonName,
  type MoonOrbits,
  type MoonPlanet,
} from '../astro/moonOrbits';
import { PLANET_FRAGMENT, PLANET_VERTEX } from './planetMeshes';
import { EARTH_RADIUS_KM, sceneFromKm } from './spaceFrame';

/** Mean radii, km, as JPL gives them (Solar System Dynamics, planetary satellite physical parameters). */
export const MOON_RADIUS_KM: Readonly<Record<MoonName, number>> = {
  phobos: 11.08,
  deimos: 6.2,
  io: 1821.49,
  europa: 1560.8,
  ganymede: 2631.2,
  callisto: 2410.3,
  mimas: 198.2,
  enceladus: 252.1,
  tethys: 531.1,
  dione: 561.4,
  rhea: 763.5,
  titan: 2574.76,
  hyperion: 135.0,
  iapetus: 734.3,
};

/** Each moon's colour, roughly as it looks: Io's sulphur, Titan's haze, Callisto's dark ice. */
const MOON_COLOURS: Readonly<Record<MoonName, string>> = {
  phobos: '#6b5e55',
  deimos: '#857565',
  io: '#d8c27a',
  europa: '#d9cbb4',
  ganymede: '#9b8f80',
  callisto: '#6e6458',
  mimas: '#b9b9b6',
  enceladus: '#f2f4f5',
  tethys: '#d8d8d4',
  dione: '#c8c8c4',
  rhea: '#c4c2bc',
  titan: '#d9a05b',
  hyperion: '#a99a86',
  iapetus: '#8a7a68',
};

export const MOON_NAMES: Readonly<Record<MoonName, string>> = {
  phobos: 'Phobos',
  deimos: 'Deimos',
  io: 'Io',
  europa: 'Europa',
  ganymede: 'Ganymede',
  callisto: 'Callisto',
  mimas: 'Mimas',
  enceladus: 'Enceladus',
  tethys: 'Tethys',
  dione: 'Dione',
  rhea: 'Rhea',
  titan: 'Titan',
  hyperion: 'Hyperion',
  iapetus: 'Iapetus',
};

/** Points along each drawn orbit. */
const PATH_POINTS = 128;

export interface MoonMeshes {
  readonly meshes: Readonly<Record<MoonName, Mesh>>;
  /** The orbits to place the moons by; null hides them. */
  setOrbits(orbits: MoonOrbits | null): void;
  /**
   * Place each planet's moons about it at `jdTT` (TT), the planets at `planets` (scene
   * positions, null to hide all), lit from `sun`; `j2000ToScene` turns J2000 directions into
   * the scene's.
   */
  place(
    jdTT: number,
    planets: Readonly<Record<MoonPlanet, Vector3>> | null,
    sun: Vector3,
    j2000ToScene: Quaternion,
  ): void;
  /** Draw the paths of one planet's moons (the planet in view), or of none. */
  showPaths(planet: MoonPlanet | null): void;
}

function colourTexture(hex: string): DataTexture {
  const value = Number.parseInt(hex.slice(1), 16);
  const texture = new DataTexture(
    new Uint8Array([(value >> 16) & 255, (value >> 8) & 255, value & 255, 255]),
    1,
    1,
    RGBAFormat,
  );
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function createMoonMeshes(scene: Scene): MoonMeshes {
  const planets = Object.keys(MOONS) as MoonPlanet[];
  // Each planet's moons ride in a group at the planet, turned as J2000 is in the scene.
  const systems = Object.fromEntries(
    planets.map((planet) => {
      const group = new Group();
      group.visible = false;
      scene.add(group);
      return [planet, group];
    }),
  ) as Record<MoonPlanet, Group>;
  const toSun = new Map<MoonName, Vector3>();
  const paths = new Map<MoonName, LineLoop<BufferGeometry, LineBasicMaterial>>();
  const meshes = Object.fromEntries(
    planets.flatMap((planet) =>
      MOONS[planet].map((name) => {
        const direction = new Vector3(1, 0, 0);
        toSun.set(name, direction);
        const mesh = new Mesh(
          new SphereGeometry(MOON_RADIUS_KM[name] / EARTH_RADIUS_KM, 24, 16),
          new ShaderMaterial({
            uniforms: {
              map: { value: colourTexture(MOON_COLOURS[name]) },
              toSun: { value: direction },
            },
            vertexShader: PLANET_VERTEX,
            fragmentShader: PLANET_FRAGMENT,
          }),
        );
        mesh.name = name;
        const geometry = new BufferGeometry();
        geometry.setAttribute(
          'position',
          new Float32BufferAttribute(new Float32Array(PATH_POINTS * 3), 3),
        );
        const path = new LineLoop(
          geometry,
          new LineBasicMaterial({
            color: '#c8d2e0',
            transparent: true,
            opacity: 0.25,
            depthWrite: false,
          }),
        );
        paths.set(name, path);
        systems[planet].add(mesh, path);
        return [name, mesh];
      }),
    ),
  ) as Record<MoonName, Mesh<SphereGeometry, ShaderMaterial>>;

  let orbits: MoonOrbits | null = null;
  let placedAt: number | null = null;
  // The last placing, to place the moons again as soon as their orbits come.
  let lastPlacing: Parameters<MoonMeshes['place']> | null = null;
  let pathsOf: MoonPlanet | null = null;
  // The moment each path was drawn for: redrawn once the orbit has turned a little.
  const drawnAt = new Map<MoonName, number>();
  const world = new Vector3();

  function drawPath(name: MoonName, jdTT: number, orbit: MoonOrbits[MoonName]): void {
    const path = paths.get(name);
    if (path === undefined) return;
    const days = 360 / orbit.longitude[1];
    const attribute = path.geometry.getAttribute('position');
    for (let k = 0; k < PATH_POINTS; k += 1) {
      const [x, y, z] = sceneFromKm(moonPosition(orbit, jdTT + (days * k) / PATH_POINTS));
      attribute.setXYZ(k, x, y, z);
    }
    attribute.needsUpdate = true;
    path.geometry.computeBoundingSphere();
    drawnAt.set(name, jdTT);
  }

  function refreshPaths(): void {
    for (const planet of planets) {
      for (const name of MOONS[planet]) {
        const path = paths.get(name);
        if (path === undefined) continue;
        path.visible = pathsOf === planet && orbits !== null && placedAt !== null;
        // A path a day old is still the moon's path, near enough.
        if (
          path.visible &&
          orbits !== null &&
          placedAt !== null &&
          Math.abs((drawnAt.get(name) ?? -Infinity) - placedAt) > 1
        ) {
          drawPath(name, placedAt, orbits[name]);
        }
      }
    }
  }

  return {
    meshes,
    setOrbits(next) {
      orbits = next;
      drawnAt.clear();
      if (lastPlacing !== null) this.place(...lastPlacing);
      refreshPaths();
    },
    showPaths(planet) {
      if (planet === pathsOf) return;
      pathsOf = planet;
      refreshPaths();
    },
    place(jdTT, planetPositions, sun, j2000ToScene) {
      lastPlacing = [jdTT, planetPositions, sun, j2000ToScene];
      placedAt = jdTT;
      for (const planet of planets) {
        const system = systems[planet];
        system.visible = orbits !== null && planetPositions !== null;
        if (orbits === null || planetPositions === null) continue;
        system.position.copy(planetPositions[planet]);
        system.quaternion.copy(j2000ToScene);
        system.updateMatrixWorld();
        for (const name of MOONS[planet]) {
          const orbit = orbits[name];
          meshes[name].position.set(...sceneFromKm(moonPosition(orbit, jdTT)));
          meshes[name].getWorldPosition(world);
          toSun.get(name)?.copy(sun).sub(world).normalize();
        }
      }
      refreshPaths();
    },
  };
}
