/**
 * The five naked-eye planets as meshes in the space view, at their true sizes, squashed at the
 * poles as they are, turned to their poles, lit by the Sun; Saturn with its rings. Looks come
 * from `planetLook.ts`.
 */

import {
  CanvasTexture,
  DataTexture,
  DoubleSide,
  LinearFilter,
  Mesh,
  Quaternion,
  RedFormat,
  RingGeometry,
  type Scene,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  UnsignedByteType,
  Vector3,
} from 'three';

import { PLANETS, type PlanetName } from '../astro/planets';
import {
  colourAt,
  planetRadius,
  poleVector,
  polarRatio,
  ringOpacity,
  SATURN_RINGS_KM,
} from './planetLook';
import { EARTH_RADIUS_KM, toScene } from './spaceFrame';

const PLANET_VERTEX = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec2 vUv;
  varying vec3 vNormal;
  void main() {
    vUv = uv;
    vNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    #include <logdepthbuf_vertex>
  }
`;

// Sunlit by a plain Lambert law, with a faint night side so the disc stays findable.
const PLANET_FRAGMENT = /* glsl */ `
  #include <logdepthbuf_pars_fragment>
  uniform sampler2D map;
  uniform vec3 toSun;
  varying vec2 vUv;
  varying vec3 vNormal;
  void main() {
    #include <logdepthbuf_fragment>
    float light = max(dot(normalize(vNormal), toSun), 0.0);
    vec3 colour = texture2D(map, vUv).rgb;
    gl_FragColor = vec4(colour * (0.03 + 0.97 * light), 1.0);
    #include <colorspace_fragment>
  }
`;

const RING_VERTEX = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying float vRadius;
  void main() {
    vRadius = length(position.xz);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    #include <logdepthbuf_vertex>
  }
`;

// Opacity by distance from Saturn, from a strip baked from ringOpacity(); brighter when the
// Sun shines more steeply on the ring plane.
const RING_FRAGMENT = /* glsl */ `
  #include <logdepthbuf_pars_fragment>
  uniform sampler2D opacity;
  uniform float inner;
  uniform float outer;
  uniform vec3 toSun;
  uniform vec3 normal;
  varying float vRadius;
  void main() {
    #include <logdepthbuf_fragment>
    float alpha = texture2D(opacity, vec2((vRadius - inner) / (outer - inner), 0.5)).r;
    float light = 0.2 + 0.8 * sqrt(abs(dot(normal, toSun)));
    gl_FragColor = vec4(vec3(0.86, 0.79, 0.64) * light, alpha);
    #include <colorspace_fragment>
  }
`;

export interface PlanetMeshes {
  readonly meshes: Readonly<Record<PlanetName, Mesh>>;
  /**
   * Place the planets (scene positions in Earth radii, null to hide them), lit from `sun`, with
   * `j2000ToScene` turning J2000 directions in scene axes into the scene's.
   */
  place(
    positions: Readonly<Record<PlanetName, Vector3>> | null,
    sun: Vector3,
    j2000ToScene: Quaternion,
  ): void;
}

/** A map of latitude bands: north at the top, as SphereGeometry's v runs. */
function bandTexture(planet: PlanetName): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 180;
  const context = canvas.getContext('2d');
  if (context !== null) {
    for (let row = 0; row < canvas.height; row += 1) {
      context.fillStyle = colourAt(planet, 89.5 - row);
      context.fillRect(0, row, canvas.width, 1);
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function ringTexture(): DataTexture {
  const size = 512;
  const data = new Uint8Array(size);
  const span = SATURN_RINGS_KM.outer - SATURN_RINGS_KM.inner;
  for (let index = 0; index < size; index += 1) {
    data[index] = Math.round(
      255 * ringOpacity(SATURN_RINGS_KM.inner + ((index + 0.5) / size) * span),
    );
  }
  const texture = new DataTexture(data, size, 1, RedFormat, UnsignedByteType);
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export function createPlanetMeshes(scene: Scene): PlanetMeshes {
  const up = new Vector3(0, 1, 0);
  const tilts = new Map<PlanetName, Quaternion>();
  const toSun = new Map<PlanetName, Vector3>();
  function planetMesh(planet: PlanetName): Mesh {
    const radius = planetRadius(planet);
    const geometry = new SphereGeometry(
      radius,
      planet === 'jupiter' || planet === 'saturn' ? 64 : 32,
      32,
    );
    geometry.scale(1, polarRatio(planet), 1);
    const direction = new Vector3(1, 0, 0);
    toSun.set(planet, direction);
    const mesh = new Mesh(
      geometry,
      new ShaderMaterial({
        uniforms: { map: { value: bandTexture(planet) }, toSun: { value: direction } },
        vertexShader: PLANET_VERTEX,
        fragmentShader: PLANET_FRAGMENT,
      }),
    );
    mesh.visible = false;
    tilts.set(
      planet,
      new Quaternion().setFromUnitVectors(up, new Vector3(...toScene(poleVector(planet)))),
    );
    scene.add(mesh);
    return mesh;
  }
  const meshes: Record<PlanetName, Mesh> = {
    mercury: planetMesh('mercury'),
    venus: planetMesh('venus'),
    mars: planetMesh('mars'),
    jupiter: planetMesh('jupiter'),
    saturn: planetMesh('saturn'),
  };

  // The rings lie in Saturn's equator: the mesh's x–z plane.
  const inner = SATURN_RINGS_KM.inner / EARTH_RADIUS_KM;
  const outer = SATURN_RINGS_KM.outer / EARTH_RADIUS_KM;
  const ringGeometry = new RingGeometry(inner, outer, 256, 1);
  ringGeometry.rotateX(-Math.PI / 2);
  const ringNormal = new Vector3(0, 1, 0);
  const ringUniforms = {
    opacity: { value: ringTexture() },
    inner: { value: inner },
    outer: { value: outer },
    toSun: { value: new Vector3(1, 0, 0) },
    normal: { value: ringNormal },
  };
  const rings = new Mesh(
    ringGeometry,
    new ShaderMaterial({
      uniforms: ringUniforms,
      vertexShader: RING_VERTEX,
      fragmentShader: RING_FRAGMENT,
      side: DoubleSide,
      transparent: true,
      depthWrite: false,
    }),
  );
  meshes.saturn.add(rings);

  return {
    meshes,
    place(positions, sun, j2000ToScene) {
      for (const planet of PLANETS) {
        const mesh = meshes[planet];
        if (positions === null) {
          mesh.visible = false;
          continue;
        }
        mesh.position.copy(positions[planet]);
        mesh.quaternion.copy(j2000ToScene).multiply(tilts.get(planet) ?? new Quaternion());
        toSun.get(planet)?.copy(sun).sub(mesh.position).normalize();
        mesh.visible = true;
      }
      ringUniforms.toSun.value.copy(toSun.get('saturn') ?? ringUniforms.toSun.value);
      ringNormal.set(0, 1, 0).applyQuaternion(meshes.saturn.quaternion);
    },
  };
}
