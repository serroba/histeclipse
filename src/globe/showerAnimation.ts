/**
 * A cosmic-ray shower making carbon-14, played once (#269): two rays race in; the one aimed at
 * the equator is bent back out by the field (unless it is weak), the one aimed near the pole
 * strikes the air and bursts into a shower; a neutron turns a nitrogen atom into carbon-14,
 * which joins oxygen and drifts down. An illustration, far from scale. Built in Earth-fixed
 * coordinates, to hang on the globe; the steps and captions are in `showerSteps.ts`.
 *
 * Three.js glue, covered by the Playwright suite.
 */

import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  Color,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  LineSegments,
  NormalBlending,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three';

import type { GeoPoint } from '../state/viewState';
import { frameClock } from '../util/frameClock';
import { geoToVector } from './geo';
import {
  BURST_DELAY,
  SHOWER_MS,
  SHOWER_STEPS,
  stepAt,
  turnedAway,
  type ShowerStep,
} from './showerSteps';

export interface ShowerSpec {
  /** Where the ray near the pole strikes; the other is aimed at the equator below it. */
  readonly place: GeoPoint;
  /** The field's dipole, ×10²² A m². */
  readonly dipole: number;
  /** Told each step as it begins. */
  readonly onStep: (step: ShowerStep | null) => void;
}

export interface ShowerAnimation {
  readonly group: Group;
  /** Advance to `now` (ms); false once it has played out. */
  update(now: number): boolean;
  dispose(): void;
}

/** Where each step begins, ms. */
const AT = Object.fromEntries(SHOWER_STEPS.map(({ step, at }) => [step, at])) as Record<
  ShowerStep,
  number
>;
/** Points along each ray's drawn track. */
const TRACK_POINTS = 32;
/** Secondary particles drawn in the shower. */
const SECONDARIES = 18;

/** A soft round dot, white, tinted by its material. */
function dotTexture(): CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (context !== null) {
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.45, 'rgba(255,255,255,0.85)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  }
  return new CanvasTexture(canvas);
}

const clamp = (t: number): number => Math.min(1, Math.max(0, t));
const ease = (t: number): number => 1 - (1 - t) ** 3;
/** How far through [from, from + length] ms `t` is, 0 to 1. */
const through = (t: number, from: number, length: number): number => clamp((t - from) / length);

/** A point on the quadratic curve from `a` through control `c` to `b`. */
function curve(a: Vector3, c: Vector3, b: Vector3, t: number): Vector3 {
  const u = 1 - t;
  return a
    .clone()
    .multiplyScalar(u * u)
    .add(c.clone().multiplyScalar(2 * u * t))
    .add(b.clone().multiplyScalar(t * t));
}

/** Up, east and north at a place on the unit globe. */
function frame(place: GeoPoint): { up: Vector3; east: Vector3; north: Vector3 } {
  const up = new Vector3(...geoToVector(place)).normalize();
  const east = new Vector3().crossVectors(new Vector3(0, 1, 0), up);
  if (east.lengthSq() < 1e-9) east.set(1, 0, 0);
  east.normalize();
  const north = new Vector3().crossVectors(up, east).normalize();
  return { up, east, north };
}

export function createShowerAnimation(spec: ShowerSpec): ShowerAnimation {
  const clock = frameClock();
  const group = new Group();
  group.name = 'shower';
  const texture = dotTexture();
  const materials: SpriteMaterial[] = [];
  const dot = (color: Color, size: number, additive = true): Sprite => {
    const material = new SpriteMaterial({
      map: texture,
      color,
      transparent: true,
      depthWrite: false,
      blending: additive ? AdditiveBlending : NormalBlending,
    });
    materials.push(material);
    const sprite = new Sprite(material);
    sprite.scale.setScalar(size);
    sprite.visible = false;
    group.add(sprite);
    return sprite;
  };
  const geometries: BufferGeometry[] = [];
  const lineMaterials: LineBasicMaterial[] = [];
  const trail = (color: Color): Line<BufferGeometry, LineBasicMaterial> => {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      'position',
      new Float32BufferAttribute(new Float32Array(TRACK_POINTS * 3), 3),
    );
    geometries.push(geometry);
    const material = new LineBasicMaterial({
      color,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    lineMaterials.push(material);
    const line = new Line(geometry, material);
    line.visible = false;
    group.add(line);
    return line;
  };
  /** Draw the path a ray has taken so far, `along` 0 to 1 of the way. */
  const setTrack = (
    line: Line,
    ray: { from: Vector3; bend: Vector3; to: Vector3 },
    along: number,
  ): void => {
    const positions = line.geometry.getAttribute('position');
    for (let i = 0; i < TRACK_POINTS; i += 1) {
      const point = curve(ray.from, ray.bend, ray.to, (along * i) / (TRACK_POINTS - 1));
      positions.setXYZ(i, point.x, point.y, point.z);
    }
    positions.needsUpdate = true;
  };

  const rayColor = new Color(0.75, 0.9, 1);
  const polar = frame(spec.place);
  const equator = frame({ latitude: 0, longitude: spec.place.longitude });
  const away = turnedAway(spec.dipole);

  // The ray near the pole: in from far out, a little curved, to a strike high in the air.
  const strike = polar.up.clone().multiplyScalar(1.07);
  const polarFrom = polar.up
    .clone()
    .multiplyScalar(1.85)
    .add(polar.east.clone().multiplyScalar(0.35));
  const polarBend = polar.up
    .clone()
    .multiplyScalar(1.6)
    .add(polar.east.clone().multiplyScalar(0.05));
  // The ray at the equator: bent back out by the field, or let in where it is weak.
  const equatorFrom = equator.up
    .clone()
    .multiplyScalar(1.85)
    .add(equator.east.clone().multiplyScalar(0.35));
  const equatorTo = away
    ? equator.up.clone().multiplyScalar(1.8).add(equator.east.clone().multiplyScalar(-0.6))
    : equator.up.clone().multiplyScalar(1.07);
  const equatorBend = away
    ? equator.up.clone().multiplyScalar(1.15)
    : equator.up.clone().multiplyScalar(1.6).add(equator.east.clone().multiplyScalar(0.05));
  const rays = [
    {
      from: polarFrom,
      bend: polarBend,
      to: strike,
      head: dot(rayColor, 0.08),
      tail: trail(rayColor),
    },
    {
      from: equatorFrom,
      bend: equatorBend,
      to: equatorTo,
      head: dot(rayColor, 0.08),
      tail: trail(rayColor),
    },
  ];

  // The shower: secondaries spreading down from the strike in a cone toward the ground.
  const showerGeometry = new BufferGeometry();
  const ends = Array.from({ length: SECONDARIES }, (_, i) => {
    const turn = (i / SECONDARIES) * Math.PI * 2;
    const spread = 0.012 + (0.03 * ((i * 7) % 5)) / 4;
    return polar.up
      .clone()
      .multiplyScalar(1.004)
      .add(polar.east.clone().multiplyScalar(Math.cos(turn) * spread))
      .add(polar.north.clone().multiplyScalar(Math.sin(turn) * spread));
  });
  showerGeometry.setAttribute(
    'position',
    new Float32BufferAttribute(new Float32Array(SECONDARIES * 6), 3),
  );
  geometries.push(showerGeometry);
  const showerMaterial = new LineBasicMaterial({
    color: new Color(1, 0.85, 0.55),
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  lineMaterials.push(showerMaterial);
  const shower = new LineSegments(showerGeometry, showerMaterial);
  shower.visible = false;
  group.add(shower);
  const flash = dot(new Color(1, 1, 1), 0.02);
  flash.position.copy(strike);

  // The neutron, the nitrogen it meets, the proton knocked out, and the oxygen joining.
  const meet = polar.up.clone().multiplyScalar(1.03).add(polar.north.clone().multiplyScalar(0.02));
  const neutron = dot(new Color(1, 1, 1), 0.012);
  const nitrogen = dot(new Color(0.35, 0.6, 1), 0.02, false);
  nitrogen.position.copy(meet);
  const proton = dot(new Color(1, 0.85, 0.3), 0.012);
  const oxygens = [
    dot(new Color(1, 0.3, 0.3), 0.017, false),
    dot(new Color(1, 0.3, 0.3), 0.017, false),
  ];
  const oxygenFrom = [
    meet.clone().add(polar.east.clone().multiplyScalar(0.05)),
    meet.clone().add(polar.east.clone().multiplyScalar(-0.05)),
  ];
  const oxygenTo = [
    polar.east.clone().multiplyScalar(0.016),
    polar.east.clone().multiplyScalar(-0.016),
  ];
  const drifted = polar.up
    .clone()
    .multiplyScalar(1.008)
    .add(polar.north.clone().multiplyScalar(-0.09));
  const carbonViolet = new Color(0.72, 0.48, 1);

  let shown: ShowerStep | null | undefined;
  const showerPositions = showerGeometry.getAttribute('position');

  return {
    group,
    update(now) {
      const t = clock.tick(now);
      const step = stepAt(t);
      if (step !== shown) {
        shown = step;
        spec.onStep(step);
      }
      // The rays, the one at the pole quickening in, the other bent away or let in.
      for (const [i, ray] of rays.entries()) {
        const going = through(t, i * 200, AT.shower - 400);
        const at = curve(ray.from, ray.bend, ray.to, ease(going));
        ray.head.visible = t < AT.shower + 300;
        // The track stays a while, fading, so the bend can be seen.
        ray.tail.visible = t < AT.capture;
        ray.tail.material.opacity = 0.85 * (1 - through(t, AT.shower + 300, 1500));
        ray.head.position.copy(at);
        setTrack(ray.tail, ray, ease(going));
      }
      // The shower: a flash at the strike, then the cone spreading down and fading.
      const bursting = through(t, AT.shower + BURST_DELAY, 1400);
      flash.visible = t >= AT.shower + BURST_DELAY && bursting < 1;
      flash.scale.setScalar(0.02 + 0.09 * ease(bursting));
      flash.material.opacity = 1 - bursting;
      shower.visible = t >= AT.shower + BURST_DELAY && t < AT.dioxide;
      for (const [i, end] of ends.entries()) {
        const tip = strike.clone().lerp(end, ease(bursting));
        showerPositions.setXYZ(i * 2, strike.x, strike.y, strike.z);
        showerPositions.setXYZ(i * 2 + 1, tip.x, tip.y, tip.z);
      }
      showerPositions.needsUpdate = true;
      showerMaterial.opacity = 0.9 * (1 - through(t, AT.capture + 600, 1200));
      // The neutron finds the nitrogen, which turns to carbon-14; the proton flies off.
      const finding = through(t, AT.capture, 1000);
      neutron.visible = t >= AT.capture && finding < 1;
      neutron.position.copy(strike.clone().lerp(meet, ease(finding)));
      nitrogen.visible = t >= AT.shower && t < SHOWER_MS;
      const turned = t >= AT.capture + 1000;
      nitrogen.material.color.copy(turned ? carbonViolet : new Color(0.35, 0.6, 1));
      nitrogen.scale.setScalar(turned ? 0.024 : 0.02);
      const flying = through(t, AT.capture + 1000, 1000);
      proton.visible = turned && flying < 1;
      proton.position.copy(meet.clone().add(polar.east.clone().multiplyScalar(0.08 * flying)));
      // Two oxygen atoms join it, then the molecule drifts down and away.
      const joining = through(t, AT.dioxide, 1400);
      const drifting = through(t, AT.drift, 2200);
      const centre = meet.clone().lerp(drifted, ease(drifting));
      nitrogen.position.copy(centre);
      for (const [i, oxygen] of oxygens.entries()) {
        oxygen.visible = t >= AT.dioxide && t < SHOWER_MS;
        const from = oxygenFrom[i] ?? meet;
        const offset = oxygenTo[i] ?? new Vector3();
        oxygen.position.copy(from.clone().lerp(centre.clone().add(offset), ease(joining)));
      }
      // Fade out at the end.
      const leaving = 1 - through(t, SHOWER_MS - 700, 700);
      nitrogen.material.opacity = leaving;
      for (const oxygen of oxygens) oxygen.material.opacity = leaving;
      return t < SHOWER_MS;
    },
    dispose() {
      group.removeFromParent();
      texture.dispose();
      for (const material of materials) material.dispose();
      for (const material of lineMaterials) material.dispose();
      for (const geometry of geometries) geometry.dispose();
    },
  };
}
