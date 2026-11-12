/**
 * An impact, played once: the impactor coming in along its approach, a flash where it strikes,
 * a ring of blast and ejecta spreading out, and the crater left behind. An illustration, scaled
 * to the crater: the flash, the impactor, its trail, the ring and how long it lasts all grow
 * with the crater's width, Chicxulub's the yardstick, a small crater kept large enough to see
 * (#314). The approach is a study's where one exists and an assumption otherwise, and the
 * ring's reach is illustrative. Built in Earth-fixed coordinates, to hang on the globe.
 *
 * Three.js glue, covered by the Playwright suite.
 */

import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  RingGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three';

import type { GeoPoint } from '../state/viewState';
import { frameClock } from '../util/frameClock';
import { geoToVector } from './geo';

export interface ImpactSpec {
  readonly place: GeoPoint;
  /** The final crater's diameter, km. */
  readonly craterKm: number;
  /** Where the impactor came from: degrees clockwise from north, and above the horizon. */
  readonly fromAzimuth: number;
  readonly angleDegrees: number;
}

export interface ImpactAnimation {
  readonly group: Group;
  /** Advance to `now` (ms); false once it has played out. */
  update(now: number): boolean;
  dispose(): void;
}

const EARTH_KM = 6371;
/** Milliseconds, for an impact Chicxulub's size: the approach, the flash, the ring, the whole. */
const APPROACH = 1400;
const FLASH = 700;
const RING = 2800;
const TOTAL = 5200;
/** Chicxulub's crater, km: the yardstick the others are drawn against. */
const YARDSTICK_KM = 180;

/** How large an impact is drawn, in Earth radii, and how long it lasts, ms. */
export interface ImpactSizes {
  /** Its crater's width against Chicxulub's: 1 for Chicxulub, capped for the very largest. */
  readonly strength: number;
  readonly head: number;
  readonly trail: number;
  readonly flash: number;
  readonly craterRadius: number;
  readonly blastRadius: number;
  readonly totalMs: number;
}

/**
 * An impact's sizes, in proportion to its crater: the flash, impactor and trail grow with the
 * crater's width, so Chicxulub's flash is eighteen times a 10 km crater's; each has a floor,
 * so the smallest still show. A smaller one plays out sooner.
 */
export function impactSizes(craterKm: number): ImpactSizes {
  const strength = Math.min(Math.max(craterKm, 0) / YARDSTICK_KM, 1.7);
  const craterRadius = Math.max(craterKm / 2 / EARTH_KM, 0.002);
  return {
    strength,
    head: Math.max(0.012, 0.05 * strength),
    trail: Math.max(0.04, 0.12 * strength),
    flash: Math.max(0.02, 0.3 * strength),
    craterRadius,
    // The blast's reach is illustrative: four crater radii, and never too small to see.
    blastRadius: Math.max(craterRadius * 4, 0.015),
    totalMs: TOTAL * (0.5 + 0.5 * Math.min(strength, 1)),
  };
}

/** A soft round glow, white at the heart and orange at the edge. */
function glowTexture(): CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (context !== null) {
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.3, 'rgba(255,214,140,0.9)');
    gradient.addColorStop(1, 'rgba(255,120,40,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  }
  return new CanvasTexture(canvas);
}

/** The direction the impactor came from, as a unit vector in Earth-fixed coordinates. */
function approachDirection(place: GeoPoint, fromAzimuth: number, angleDegrees: number): Vector3 {
  const up = new Vector3(...geoToVector(place)).normalize();
  const pole = new Vector3(0, 1, 0);
  const east = new Vector3().crossVectors(pole, up);
  if (east.lengthSq() < 1e-9) east.set(1, 0, 0);
  east.normalize();
  const north = new Vector3().crossVectors(up, east).normalize();
  const azimuth = (fromAzimuth * Math.PI) / 180;
  const elevation = (angleDegrees * Math.PI) / 180;
  const level = north
    .clone()
    .multiplyScalar(Math.cos(azimuth))
    .add(east.clone().multiplyScalar(Math.sin(azimuth)));
  return level.multiplyScalar(Math.cos(elevation)).add(up.multiplyScalar(Math.sin(elevation)));
}

const ease = (t: number): number => 1 - (1 - t) ** 3;
const clamp = (t: number): number => Math.min(1, Math.max(0, t));

export function createImpactAnimation(spec: ImpactSpec): ImpactAnimation {
  // Timed by the frames' own clock, from the first frame it is drawn in; a frame that comes very
  // late (a large map loading) pauses it rather than skipping to the end.
  const clock = frameClock();
  const sizes = impactSizes(spec.craterKm);
  // A smaller impact plays the same story quicker.
  const pace = sizes.totalMs / TOTAL;
  const group = new Group();
  const ground = new Vector3(...geoToVector(spec.place, 1.002));
  const up = ground.clone().normalize();
  const from = approachDirection(spec.place, spec.fromAzimuth, spec.angleDegrees);
  const origin = ground.clone().add(from.clone().multiplyScalar(0.7));

  const glow = glowTexture();
  const glowMaterial = (opacity: number): SpriteMaterial =>
    new SpriteMaterial({
      map: glow,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: AdditiveBlending,
    });

  // The impactor: a bright head with a trail behind it.
  const head = new Sprite(glowMaterial(1));
  head.scale.setScalar(sizes.head);
  const trailGeometry = new BufferGeometry();
  trailGeometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(6), 3));
  const trailMaterial = new LineBasicMaterial({
    color: new Color(1, 0.7, 0.35),
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const trail = new Line(trailGeometry, trailMaterial);

  // The flash where it strikes.
  const flash = new Sprite(glowMaterial(0));
  flash.position.copy(ground);
  flash.scale.setScalar(0.001);

  // Rings lying flat on the ground: the blast and ejecta spreading, and the crater left.
  const flat = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), up);
  const ring = (inner: number, color: Color): Mesh<RingGeometry, MeshBasicMaterial> => {
    const mesh = new Mesh(
      new RingGeometry(inner, 1, 96),
      new MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0,
        side: DoubleSide,
        depthWrite: false,
      }),
    );
    mesh.position.copy(ground);
    mesh.quaternion.copy(flat);
    mesh.scale.setScalar(0.001);
    return mesh;
  };
  const { craterRadius, blastRadius } = sizes;
  const blast = ring(0.82, new Color(1, 0.62, 0.3));
  const crater = ring(0.88, new Color(1, 0.85, 0.6));
  crater.scale.setScalar(craterRadius);

  group.add(trail, head, flash, blast, crater);
  group.name = 'impact';

  const trailPositions = trailGeometry.getAttribute('position');
  function setTrail(at: Vector3, length: number): void {
    const tail = at.clone().add(from.clone().multiplyScalar(length));
    trailPositions.setXYZ(0, at.x, at.y, at.z);
    trailPositions.setXYZ(1, tail.x, tail.y, tail.z);
    trailPositions.needsUpdate = true;
  }

  return {
    group,
    update(now) {
      // Time as for an impact Chicxulub's size: a smaller one runs through it faster.
      const t = clock.tick(now) / pace;
      // The approach, quickening as it falls.
      const falling = clamp(t / APPROACH);
      const at = origin.clone().lerp(ground, falling ** 1.6);
      head.position.copy(at);
      head.visible = falling < 1;
      trail.visible = falling < 1;
      setTrail(at, sizes.trail * (1 - falling * 0.5));
      // The flash.
      const flashing = clamp((t - APPROACH) / FLASH);
      flash.visible = t >= APPROACH && flashing < 1;
      flash.scale.setScalar(sizes.flash * (0.07 + 0.93 * ease(flashing)));
      flash.material.opacity = 1 - flashing;
      // The ring spreading and fading.
      const spreading = clamp((t - APPROACH) / RING);
      blast.visible = t >= APPROACH && spreading < 1;
      blast.scale.setScalar(Math.max(0.001, blastRadius * ease(spreading)));
      blast.material.opacity = 0.9 * (1 - spreading);
      // The crater, settling in after the flash and fading at the end.
      const settled = clamp((t - APPROACH - FLASH) / 600);
      const leaving = clamp((t - (TOTAL - 800)) / 800);
      crater.material.opacity = 0.95 * settled * (1 - leaving);
      return t < TOTAL;
    },
    dispose() {
      group.removeFromParent();
      glow.dispose();
      trailGeometry.dispose();
      trailMaterial.dispose();
      for (const mesh of [blast, crater]) {
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
      head.material.dispose();
      flash.material.dispose();
    },
  };
}
