/**
 * A cosmic-ray shower making carbon-14, played once (#269): two rays race in; the one aimed at
 * the equator is bent back out by the field (unless it is weak), the one aimed near the pole
 * strikes the air and bursts into a shower; a neutron turns a nitrogen atom into carbon-14,
 * which joins oxygen, falls through the air and is taken in by a plant. Every particle is
 * labelled, the rays with their energies. An illustration, far from scale. Built in Earth-fixed
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
  rayLabels,
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

/** A text label as a texture, white on a dark rounded pill, and its width over its height. */
function labelTexture(text: string): { texture: CanvasTexture; aspect: number } {
  const height = 64;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const font = '600 40px system-ui, sans-serif';
  if (context !== null) context.font = font;
  const width = Math.ceil((context?.measureText(text).width ?? text.length * 22) + 36);
  canvas.width = width;
  canvas.height = height;
  if (context !== null) {
    context.fillStyle = 'rgba(8, 12, 28, 0.78)';
    context.beginPath();
    context.roundRect(0, 0, width, height, 18);
    context.fill();
    context.font = font;
    context.fillStyle = '#ffffff';
    context.textBaseline = 'middle';
    context.fillText(text, 18, height / 2 + 2);
  }
  return { texture: new CanvasTexture(canvas), aspect: width / height };
}

/** A small plant, drawn: a stem and four leaves, rooted at the bottom middle. */
function plantTexture(): CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (context !== null) {
    context.strokeStyle = '#4f8a3c';
    context.lineWidth = 6;
    context.beginPath();
    context.moveTo(64, 126);
    context.lineTo(64, 40);
    context.stroke();
    context.fillStyle = '#6fbf4f';
    for (const [x, y, angle] of [
      [64, 92, -0.6],
      [64, 92, 0.6 + Math.PI],
      [64, 62, -0.5],
      [64, 62, 0.5 + Math.PI],
    ] as const) {
      context.save();
      context.translate(x, y);
      context.rotate(angle);
      context.beginPath();
      context.ellipse(22, 0, 22, 9, 0, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
    context.beginPath();
    context.ellipse(64, 30, 9, 16, 0, 0, Math.PI * 2);
    context.fill();
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
  const textures: CanvasTexture[] = [texture];
  /** A label that faces the camera, `height` tall, drawn over everything; `before` puts it to
   * the left of its point rather than the right. */
  const label = (text: string, height: number, before = false): Sprite => {
    const made = labelTexture(text);
    textures.push(made.texture);
    const material = new SpriteMaterial({
      map: made.texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    materials.push(material);
    const sprite = new Sprite(material);
    sprite.scale.set(height * made.aspect, height, 1);
    sprite.center.set(before ? 1 : 0, 0);
    sprite.renderOrder = 10;
    sprite.visible = false;
    group.add(sprite);
    return sprite;
  };
  /** Put a label just beside what it names, up and to the east of it. */
  const pin = (sprite: Sprite, at: Vector3, up: Vector3, east: Vector3, gap: number): void => {
    sprite.position.copy(at).addScaledVector(up, gap).addScaledVector(east, gap);
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
  const rayWords = rayLabels(spec.dipole);
  const rays = [
    {
      from: polarFrom,
      bend: polarBend,
      to: strike,
      head: dot(rayColor, 0.08),
      tail: trail(rayColor),
      label: label(rayWords.polar, 0.12),
      frame: polar,
    },
    {
      from: equatorFrom,
      bend: equatorBend,
      to: equatorTo,
      head: dot(rayColor, 0.08),
      tail: trail(rayColor),
      label: label(rayWords.equator, 0.12, true),
      frame: equator,
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
  // It falls at a slant to the ground, a little south, where a plant takes it in.
  const ground = polar.up
    .clone()
    .multiplyScalar(1.003)
    .add(polar.north.clone().multiplyScalar(-0.05));
  const leaf = ground.clone().addScaledVector(polar.up, 0.006);
  const plantMaterial = new SpriteMaterial({
    map: plantTexture(),
    transparent: true,
    depthWrite: false,
  });
  materials.push(plantMaterial);
  if (plantMaterial.map !== null) textures.push(plantMaterial.map as CanvasTexture);
  const plant = new Sprite(plantMaterial);
  plant.center.set(0.5, 0);
  plant.scale.setScalar(0.016);
  plant.position.copy(ground);
  plant.visible = false;
  group.add(plant);
  const carbonViolet = new Color(0.72, 0.48, 1);
  const small = 0.009;
  const labels = {
    neutron: label('neutron', small),
    nitrogen: label('¹⁴N nitrogen', small),
    carbon: label('¹⁴C carbon-14', small),
    proton: label('proton', small),
    oxygens: [label('O', small), label('O', small)],
    dioxide: label('¹⁴CO₂ carbon dioxide', small),
    plant: label('plant', small),
  };

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
        ray.label.visible = t > 300 && t < AT.shower;
        pin(
          ray.label,
          at,
          ray.frame.up,
          ray === rays[1] ? ray.frame.east.clone().negate() : ray.frame.east,
          0.06,
        );
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
      labels.neutron.visible = neutron.visible;
      pin(labels.neutron, neutron.position, polar.up, polar.east, 0.008);
      nitrogen.visible = t >= AT.shower && t < SHOWER_MS;
      const turned = t >= AT.capture + 1000;
      nitrogen.material.color.copy(turned ? carbonViolet : new Color(0.35, 0.6, 1));
      nitrogen.scale.setScalar(turned ? 0.024 : 0.02);
      const flying = through(t, AT.capture + 1000, 1000);
      proton.visible = turned && flying < 1;
      proton.position.copy(meet.clone().add(polar.east.clone().multiplyScalar(0.08 * flying)));
      labels.proton.visible = proton.visible;
      pin(labels.proton, proton.position, polar.up, polar.east, 0.008);
      // Two oxygen atoms join it; the molecule falls at a slant to the plant, which takes it in.
      const joining = through(t, AT.dioxide, 1400);
      const falling = through(t, AT.fall, 2800);
      const taking = through(t, AT.plant + 300, 1500);
      const centre = meet
        .clone()
        .lerp(leaf, falling ** 1.4)
        .lerp(leaf, ease(taking));
      nitrogen.position.copy(centre);
      // Taken in, the atoms shrink into the leaf.
      const shrink = 1 - 0.85 * ease(taking);
      nitrogen.scale.setScalar((turned ? 0.024 : 0.02) * shrink);
      for (const [i, oxygen] of oxygens.entries()) {
        oxygen.visible = t >= AT.dioxide && t < SHOWER_MS;
        const from = oxygenFrom[i] ?? meet;
        const offset = (oxygenTo[i] ?? new Vector3()).clone().multiplyScalar(shrink);
        oxygen.position.copy(from.clone().lerp(centre.clone().add(offset), ease(joining)));
        oxygen.scale.setScalar(0.017 * shrink);
      }
      // Its labels: the atoms until they join, then the molecule as it falls.
      const atoms = t < AT.fall;
      labels.nitrogen.visible = nitrogen.visible && !turned;
      labels.carbon.visible = turned && atoms;
      pin(labels.nitrogen, nitrogen.position, polar.up, polar.east, 0.008);
      pin(labels.carbon, nitrogen.position, polar.up, polar.east, 0.008);
      for (const [i, oxygenLabel] of labels.oxygens.entries()) {
        const oxygen = oxygens[i];
        if (oxygen === undefined) continue;
        oxygenLabel.visible = oxygen.visible && atoms && joining < 0.8;
        pin(oxygenLabel, oxygen.position, polar.up, polar.east, 0.007);
      }
      labels.dioxide.visible = !atoms && taking < 0.6;
      pin(labels.dioxide, centre, polar.up, polar.east, 0.008);
      // The plant, waiting at the ground, glows violet for a moment as it takes the carbon in.
      plant.visible = t >= AT.fall;
      plantMaterial.color.setRGB(1, 1, 1).lerp(carbonViolet, Math.sin(Math.PI * taking) * 0.6);
      labels.plant.visible = plant.visible;
      pin(labels.plant, ground, polar.up, polar.north.clone().negate(), 0.008);
      // Fade out at the end.
      const leaving = 1 - through(t, SHOWER_MS - 700, 700);
      nitrogen.material.opacity = leaving;
      for (const oxygen of oxygens) oxygen.material.opacity = leaving;
      plantMaterial.opacity = leaving;
      return t < SHOWER_MS;
    },
    dispose() {
      group.removeFromParent();
      for (const made of textures) made.dispose();
      for (const material of materials) material.dispose();
      for (const material of lineMaterials) material.dispose();
      for (const geometry of geometries) geometry.dispose();
    },
  };
}
