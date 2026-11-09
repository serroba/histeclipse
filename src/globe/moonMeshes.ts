/**
 * The moons of Mars, Jupiter and Saturn in the space view (#335): each at its true size, lit
 * by the Sun, going round its planet as its orbit (`astro/moonOrbits.ts`) says, its path drawn
 * faintly while its planet is in view. Each is painted one colour, roughly its own, until its
 * mission map comes. They keep one face to their planet, as all these moons do but tumbling
 * Hyperion: longitude 0 towards the planet, north along the orbit's pole, so the side a moon
 * leads with is centred on 90° west, as the IAU counts it. They are spheres, though Phobos,
 * Deimos and Hyperion are not.
 */

import {
  BufferGeometry,
  Matrix4,
  DataTexture,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineLoop,
  Mesh,
  type Quaternion,
  type Texture,
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
import { MOON_RADIUS_KM } from './moonLook';
import { EARTH_RADIUS_KM, sceneFromKm } from './spaceFrame';

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
  /** Whether the moons are placed: their orbits in, and the planets. */
  ready(): boolean;
  /** Wrap a moon in its mission map; null goes back to its painted colour. */
  setMap(moon: MoonName, map: Texture | null): void;
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
  const maps = new Map<MoonName, { value: Texture }>();
  const colours = new Map<MoonName, Texture>();
  const paths = new Map<MoonName, LineLoop<BufferGeometry, LineBasicMaterial>>();
  const meshes = Object.fromEntries(
    planets.flatMap((planet) =>
      MOONS[planet].map((name) => {
        const direction = new Vector3(1, 0, 0);
        toSun.set(name, direction);
        const colour = colourTexture(MOON_COLOURS[name]);
        colours.set(name, colour);
        const map: { value: Texture } = { value: colour };
        maps.set(name, map);
        const mesh = new Mesh(
          new SphereGeometry(MOON_RADIUS_KM[name] / EARTH_RADIUS_KM, 64, 32),
          new ShaderMaterial({
            uniforms: {
              map,
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
  const towardPlanet = new Vector3();
  const pole = new Vector3();
  const ahead = new Vector3();
  const basis = new Matrix4();

  /** Turn a moon to keep its face to its planet: longitude 0 towards it, north up its orbit. */
  function face(mesh: Mesh, orbit: MoonOrbits[MoonName], jdTT: number): void {
    towardPlanet.copy(mesh.position).negate().normalize();
    // A minute on, to know which way it goes round.
    ahead.set(...sceneFromKm(moonPosition(orbit, jdTT + 1 / 1440))).sub(mesh.position);
    pole.crossVectors(mesh.position, ahead);
    pole.addScaledVector(towardPlanet, -pole.dot(towardPlanet)).normalize();
    ahead.crossVectors(towardPlanet, pole);
    mesh.quaternion.setFromRotationMatrix(basis.makeBasis(towardPlanet, pole, ahead));
  }

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
    setMap(moon, map) {
      const uniform = maps.get(moon);
      const colour = colours.get(moon);
      if (uniform === undefined || colour === undefined) return;
      uniform.value = map ?? colour;
    },
    ready() {
      return orbits !== null && lastPlacing !== null && lastPlacing[1] !== null;
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
          face(meshes[name], orbit, jdTT);
          meshes[name].getWorldPosition(world);
          toSun.get(name)?.copy(sun).sub(world).normalize();
        }
      }
      refreshPaths();
    },
  };
}
