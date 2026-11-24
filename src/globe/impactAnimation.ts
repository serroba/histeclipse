/**
 * An impact, played once: the impactor coming in along its approach, a flash where it strikes,
 * a ring of blast and ejecta spreading out, and the crater left behind. An illustration, scaled
 * to the crater: the flash, the impactor, its trail, the ring and how long it lasts all grow
 * with the crater's width, Chicxulub's the yardstick, a small crater kept large enough to see
 * (#314). The approach is a study's where one exists and an assumption otherwise, and the
 * ring's reach is illustrative. An impact that reached the whole Earth, Chicxulub's size and up,
 * plays longer and goes further (#1167): a fireball, a front of hot ejecta running over the globe
 * to the far side, the sky glowing behind it, then a veil of dust and soot that slowly clears.
 * Built in Earth-fixed coordinates, to hang on the globe.
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
import { clamp01, easeOut } from '../util/timing';
import { geoToVector } from './geo';
import { createImpactShell } from './impactShell';
import { APPROACH, impactSizes, RING } from './impactSizes';
import { localFrame } from './motion';

export interface ImpactSpec {
  readonly place: GeoPoint;
  /** The final crater's diameter, km. */
  readonly craterKm: number;
  /** Where the impactor came from: degrees clockwise from north, and above the horizon. */
  readonly fromAzimuth: number;
  readonly angleDegrees: number;
  /** An icy body, drawn pale blue rather than fiery: early Earth's water arriving (#1142). */
  readonly icy?: boolean;
  /** How far its effects reached around the Earth, 0 to 1 (`worldwideReach`); 0 if left out. */
  readonly worldwide?: number;
}

/** An impact's colours: its trail, its spreading blast and its crater's rim. */
const FIERY = [new Color(1, 0.7, 0.35), new Color(1, 0.62, 0.3), new Color(1, 0.85, 0.6)] as const;
const ICY = [new Color(0.6, 0.85, 1), new Color(0.5, 0.78, 1), new Color(0.78, 0.92, 1)] as const;

/** An impact playing, as whoever played it holds it: to carry it where its crater goes. */
export interface PlayingImpact {
  /** Carry it, crater and all, to `place`: where the plates have the crater as time runs on. */
  moveTo(place: GeoPoint): void;
}

export interface ImpactAnimation extends PlayingImpact {
  readonly group: Group;
  /** Whether it reaches the whole globe: a long play, which shorter ones should not push out. */
  readonly worldwide: boolean;
  /** Advance to `now` (ms); false once it has played out. */
  update(now: number): boolean;
  dispose(): void;
}

/** A soft round glow, white at the heart and orange at the edge, or pale blue for ice. */
function glowTexture(icy: boolean): CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (context !== null) {
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.3, icy ? 'rgba(170,215,255,0.9)' : 'rgba(255,214,140,0.9)');
    gradient.addColorStop(1, icy ? 'rgba(80,150,255,0)' : 'rgba(255,120,40,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  }
  return new CanvasTexture(canvas);
}

/** The direction the impactor came from, as a unit vector in Earth-fixed coordinates. */
function approachDirection(place: GeoPoint, fromAzimuth: number, angleDegrees: number): Vector3 {
  const { up, east, north } = localFrame(place);
  const azimuth = (fromAzimuth * Math.PI) / 180;
  const elevation = (angleDegrees * Math.PI) / 180;
  const level = north
    .clone()
    .multiplyScalar(Math.cos(azimuth))
    .add(east.clone().multiplyScalar(Math.sin(azimuth)));
  return level.multiplyScalar(Math.cos(elevation)).add(up.multiplyScalar(Math.sin(elevation)));
}

export function createImpactAnimation(spec: ImpactSpec): ImpactAnimation {
  // Timed by the frames' own clock, from the first frame it is drawn in; a frame that comes very
  // late (a large map loading) pauses it rather than skipping to the end.
  const clock = frameClock();
  const sizes = impactSizes(spec.craterKm, spec.worldwide);
  const { worldwide } = sizes;
  // A smaller impact plays the same story quicker; a worldwide one's veil takes longer to clear.
  const pace = 0.5 + 0.5 * Math.min(sizes.strength, 1);
  const group = new Group();
  const ground = new Vector3(...geoToVector(spec.place, 1.002));
  const up = ground.clone().normalize();
  const from = approachDirection(spec.place, spec.fromAzimuth, spec.angleDegrees);
  const origin = ground.clone().add(from.clone().multiplyScalar(0.7));

  const icy = spec.icy === true;
  const glow = glowTexture(icy);
  const [trailColor, blastColor, rimColor] = icy ? ICY : FIERY;
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
    color: trailColor,
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
  const blast = ring(0.82, blastColor);
  const crater = ring(0.88, rimColor);
  crater.scale.setScalar(craterRadius);

  group.add(trail, head, flash, blast, crater);

  // For a worldwide impact, a shell over the whole globe: the ejecta's front and the veil.
  const shell = worldwide > 0 ? createImpactShell(up, worldwide, icy) : null;
  if (shell !== null) group.add(shell.mesh);
  group.name = 'impact';

  const trailPositions = trailGeometry.getAttribute('position');
  function setTrail(at: Vector3, length: number): void {
    const tail = at.clone().add(from.clone().multiplyScalar(length));
    trailPositions.setXYZ(0, at.x, at.y, at.z);
    trailPositions.setXYZ(1, tail.x, tail.y, tail.z);
    trailPositions.needsUpdate = true;
  }

  // Built at its place; moved by turning the whole about the Earth's centre, from there to here.
  const struckAt = up.clone();
  const toward = new Vector3();

  return {
    group,
    worldwide: worldwide > 0,
    moveTo(place) {
      toward.set(...geoToVector(place, 1)).normalize();
      group.quaternion.setFromUnitVectors(struckAt, toward);
    },
    update(now) {
      // Time as for an impact Chicxulub's size: a smaller one runs through it faster.
      const t = clock.tick(now) / pace;
      // The approach, quickening as it falls.
      const falling = clamp01(t / APPROACH);
      const at = origin.clone().lerp(ground, falling ** 1.6);
      head.position.copy(at);
      head.visible = falling < 1;
      trail.visible = falling < 1;
      setTrail(at, sizes.trail * (1 - falling * 0.5));
      // The flash.
      const flashing = clamp01((t - APPROACH) / sizes.flashMs);
      flash.visible = t >= APPROACH && flashing < 1;
      flash.scale.setScalar(sizes.flash * (0.07 + 0.93 * easeOut(flashing)));
      flash.material.opacity = 1 - flashing;
      // The ring spreading and fading.
      const spreading = clamp01((t - APPROACH) / RING);
      blast.visible = t >= APPROACH && spreading < 1;
      blast.scale.setScalar(Math.max(0.001, blastRadius * easeOut(spreading)));
      blast.material.opacity = 0.9 * (1 - spreading);
      // The crater, settling in after the flash and fading at the end.
      const end = sizes.totalMs / pace;
      const settled = clamp01((t - APPROACH - sizes.flashMs) / 600);
      const leaving = clamp01((t - (end - 800)) / 800);
      crater.material.opacity = 0.95 * settled * (1 - leaving);
      shell?.update(t - APPROACH, end - APPROACH);
      return t < end;
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
      shell?.dispose();
    },
  };
}
