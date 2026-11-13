/**
 * The planetary boundaries in 3D (#434): Earth at the centre, the nine boundaries round it, a
 * wedge for each control variable reaching out through three rings: the safe operating space
 * (green, to the boundary), the zone of increasing risk (amber, to the high-risk line), and the
 * high-risk zone (red to purple) beyond.
 * - Safe: the rings and the nine, every wedge at its reference value, Holocene-like or
 *   pre-industrial.
 * - Pressure: each grows to its value in the Planetary Health Check 2026, one boundary after
 *   another, and the count of those crossed goes up to seven of nine.
 * - Compare: Richardson et al.'s (2023) values beside them, a pale bar in each wedge, and a
 *   mark where the two disagree or the report says the change is one of method.
 * Each assessment is drawn against its own boundaries, as each drew its own diagram. Ranges and
 * judgements are drawn faded past their sure part. Not to scale: the reach is the boundaries'
 * own scale, eased past the high-risk line (`data/planetaryBoundaries.ts`).
 *
 * Three.js glue, loaded on demand and covered by the Playwright suite.
 */

import {
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RingGeometry,
  SphereGeometry,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
} from 'three';

import type { BoundaryChapter } from '../../state/viewState';
import {
  MAX_REACH,
  statusOf,
  variableReach,
  type AssessmentId,
  type PlanetaryBoundaries,
} from '../../data/planetaryBoundaries';
import {
  createStoryScene,
  type StoryChapters,
  type StoryKit,
  type StoryScene,
} from '../../story/storyScene';
import { clamp01, ease, within } from '../../util/timing';

/** The chapters the wheel draws: all but the Holocene's, which is a chart (#453). */
type WheelChapter = Exclude<BoundaryChapter, 'holocene'>;
export type BoundaryWheel = StoryScene<WheelChapter>;

export interface BoundaryWheelOptions {
  readonly data: PlanetaryBoundaries;
  readonly earthTextureUrl: string;
}

/** The zones' colours: safe green, the boundary's dark green, amber, the high-risk line, red. */
const ZONE_COLOURS = {
  safe: 0x3fae6a,
  boundary: 0x1d6b3e,
  increasing: 0xf2b134,
  highRiskLine: 0xff7a1a,
  high: 0xd9433b,
  highest: 0x8e3bb8,
} as const;

/** The radius of a reach: Earth is 1; the reference sits just off it. */
function radiusOf(reach: number): number {
  return 1.35 + reach * 0.95;
}

/** The colour at a reach: green inside the boundary, through amber, to red and then purple. */
function colourAt(reach: number): Color {
  const at = (from: number, to: number, x: number) =>
    new Color(from).lerp(new Color(to), clamp01(x));
  if (reach <= 1) return at(ZONE_COLOURS.safe, ZONE_COLOURS.safe, 0);
  if (reach <= 2) return at(ZONE_COLOURS.increasing, ZONE_COLOURS.highRiskLine, reach - 1);
  return at(ZONE_COLOURS.high, ZONE_COLOURS.highest, (reach - 2) / (MAX_REACH - 2));
}

/** When each chapter is complete, ms; in Pressure, when each boundary starts to grow. */
const SAFE_MS = 5000;
const GROW_FROM = 800;
const GROW_STAGGER = 650;
const GROW_MS = 1600;
const PRESSURE_MS = GROW_FROM + 8 * GROW_STAGGER + GROW_MS + 1200;
const COMPARE_MS = 3000;
/** The wheel's reach with its names round it, in Earth radii: what the camera fits in view. */
const WHEEL_RADIUS = radiusOf(MAX_REACH) + 1;
/** Each boundary's share of the circle, and the gap between wedges, radians. */
const SECTOR = (2 * Math.PI) / 9;
const GAP = 0.035;
/** Points along each wedge's arc, and along its length. */
const ARC_STEPS = 10;
const LENGTH_STEPS = 24;

/**
 * A flat wedge from the reference ring out to a reach, between two angles: its points are
 * placed again whenever its reach changes, coloured by the zone each lies in.
 */
interface Wedge {
  readonly mesh: Mesh<BufferGeometry, MeshBasicMaterial>;
  /** Draw it from reach `from` to `to`, at opacity `opacity`. */
  set(from: number, to: number, opacity: number): void;
}

export function createBoundaryWheel(
  container: HTMLElement,
  options: BoundaryWheelOptions,
): BoundaryWheel {
  return createStoryScene<WheelChapter>(container, {
    first: 'safe',
    near: 0.05,
    far: 200,
    build: (kit) => build(kit, options),
  });
}

function build(
  kit: StoryKit<WheelChapter>,
  { data, earthTextureUrl }: BoundaryWheelOptions,
): StoryChapters<WheelChapter> {
  const { scene, camera, controls, own, label, line, mark, during } = kit;
  controls.minDistance = 2.5;
  controls.maxDistance = 30;
  scene.add(new AmbientLight(0xffffff, 0.9));
  const sun = new DirectionalLight(0xffffff, 2);
  sun.position.set(3, 4, 2);
  scene.add(sun);

  // Earth, turning slowly.
  const earthMaterial = own(new MeshStandardMaterial({ color: 0x9ab4d8, roughness: 0.9 }));
  const earth = new Mesh(own(new SphereGeometry(1, 48, 32)), earthMaterial);
  scene.add(earth);
  new TextureLoader().load(earthTextureUrl, (texture) => {
    texture.colorSpace = SRGBColorSpace;
    earthMaterial.map = own(texture);
    earthMaterial.color.set(0xffffff);
    earthMaterial.needsUpdate = true;
    kit.invalidate();
  });

  // The zones, flat round Earth: the safe space, the zone of increasing risk, the high-risk zone.
  const flat = new Group();
  flat.rotation.x = -Math.PI / 2;
  scene.add(flat);
  const zones = (
    [
      [0, 1, ZONE_COLOURS.safe, 0.22],
      [1, 2, ZONE_COLOURS.increasing, 0.12],
      [2, MAX_REACH, ZONE_COLOURS.high, 0.08],
    ] as const
  ).map(([from, to, colour, opacity]) => {
    const material = own(
      new MeshBasicMaterial({
        color: colour,
        transparent: true,
        opacity,
        side: DoubleSide,
        depthWrite: false,
      }),
    );
    const ring = new Mesh(own(new RingGeometry(radiusOf(from), radiusOf(to), 128)), material);
    flat.add(ring);
    return { material, opacity };
  });
  const circle = (reach: number): Vector3[] =>
    Array.from({ length: 129 }, (_, step) => {
      const angle = (step / 128) * 2 * Math.PI;
      return new Vector3(
        Math.cos(angle) * radiusOf(reach),
        0.01,
        -Math.sin(angle) * radiusOf(reach),
      );
    });
  const boundaryLine = line(circle(1), new Color(ZONE_COLOURS.boundary), 3, scene);
  const highRiskLine = line(circle(2), new Color(ZONE_COLOURS.highRiskLine), 1.5, scene);

  /** A wedge between `start` and `end` radians, `lift` above the zones. */
  function wedge(start: number, end: number, lift: number, pale: boolean): Wedge {
    const count = (ARC_STEPS + 1) * (LENGTH_STEPS + 1);
    const positions = new Float32Array(count * 3);
    const colours = new Float32Array(count * 3);
    const geometry = own(new BufferGeometry());
    const positionAttribute = new BufferAttribute(positions, 3);
    const colourAttribute = new BufferAttribute(colours, 3);
    geometry.setAttribute('position', positionAttribute);
    geometry.setAttribute('color', colourAttribute);
    const indices: number[] = [];
    for (let along = 0; along < LENGTH_STEPS; along += 1) {
      for (let across = 0; across < ARC_STEPS; across += 1) {
        const a = along * (ARC_STEPS + 1) + across;
        const b = a + ARC_STEPS + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    geometry.setIndex(indices);
    const material = own(
      new MeshBasicMaterial({
        vertexColors: !pale,
        transparent: true,
        side: DoubleSide,
        depthWrite: false,
      }),
    );
    const mesh = new Mesh(geometry, material);
    scene.add(mesh);
    let drawn = '';
    return {
      mesh,
      set(from, to, opacity) {
        material.opacity = opacity;
        mesh.visible = opacity > 0.001 && to > from;
        const key = `${from.toFixed(4)}:${to.toFixed(4)}`;
        if (key === drawn) return;
        drawn = key;
        for (let along = 0; along <= LENGTH_STEPS; along += 1) {
          const reach = from + ((to - from) * along) / LENGTH_STEPS;
          const radius = radiusOf(reach);
          const colour = colourAt(reach);
          for (let across = 0; across <= ARC_STEPS; across += 1) {
            const angle = start + ((end - start) * across) / ARC_STEPS;
            const index = (along * (ARC_STEPS + 1) + across) * 3;
            positions[index] = Math.cos(angle) * radius;
            positions[index + 1] = lift;
            positions[index + 2] = -Math.sin(angle) * radius;
            colours[index] = colour.r;
            colours[index + 1] = colour.g;
            colours[index + 2] = colour.b;
          }
        }
        positionAttribute.needsUpdate = true;
        colourAttribute.needsUpdate = true;
        geometry.computeBoundingSphere();
      },
    };
  }

  // Each boundary's sector, from the top, clockwise; each variable a wedge within it.
  const anchor = (angle: number, reach: number): Group => {
    const group = new Group();
    group.position.set(Math.cos(angle) * radiusOf(reach), 0.05, -Math.sin(angle) * radiusOf(reach));
    scene.add(group);
    return group;
  };
  const flags = new Set(['forest', 'phosphorusGlobal', 'aragonite']);
  const sectors = data.boundaries.map((boundary, index) => {
    const centre = Math.PI / 2 - index * SECTOR;
    const width = (SECTOR - 2 * GAP) / boundary.variables.length;
    const first = centre + SECTOR / 2 - GAP;
    const name = label(boundary.name, anchor(centre, MAX_REACH + 0.45), 'is-zone');
    // Centred on its place, so the names on either side reach out alike.
    name.center.set(0.5, 0.5);
    const variables = boundary.variables.map((variable, at) => {
      const end = first - at * width;
      const start = end - width + GAP / 2;
      const middle = (start + end) / 2;
      const now = variableReach(variable, 'phc2026');
      const then = variableReach(variable, 'richardson2023');
      const quarter = (end - start) / 4;
      const ghost = wedge(middle - quarter, middle + quarter, 0.03, true);
      during('compare', ghost.mesh);
      const flagged = flags.has(variable.id) || variable.proposed === true;
      const flag = flagged ? label('!', anchor(middle, (now?.low ?? 0) + 0.25), 'is-flag') : null;
      if (flag !== null) during('compare', flag.element);
      return {
        variable,
        now,
        then,
        sure: wedge(start, end, 0.02, false),
        unsure: wedge(start, end, 0.015, false),
        ghost,
      };
    });
    return { boundary, name, variables, crosses: statusOf(boundary, 'phc2026') !== 'within' };
  });

  // How many of the nine are crossed, over Earth.
  const over = new Group();
  scene.add(over);
  const counter = label('', over, 'is-count');
  counter.position.set(0, 1.45, 0);
  counter.center.set(0.5, 1);

  /** Draw every wedge at `grown` (0 to 1) of each boundary's way to its 2026 value. */
  function grow(grown: (sector: number) => number, ghosts: number): void {
    let crossed = 0;
    sectors.forEach(({ variables, crosses }, index) => {
      const share = grown(index);
      if (crosses && share >= 1) crossed += 1;
      for (const { now, then, sure, unsure, ghost } of variables) {
        const low = (now?.low ?? 0) * share;
        const far = now === null ? low : (now.high ?? MAX_REACH) * share;
        // Sure up to its lower value; a range, or a judgement, faded past it.
        const certain = now?.judged === true ? Math.min(low, 2) : low;
        sure.set(0, Math.max(certain, 0.04), 0.92);
        unsure.set(certain, Math.max(far, low), now?.judged === true || far > low ? 0.35 : 0);
        ghost.set(0, then?.low ?? 0, 0.55 * ghosts);
      }
    });
    mark('crossed', String(crossed));
  }

  function assessmentWords(assessment: AssessmentId): number {
    return data.boundaries.filter((boundary) => statusOf(boundary, assessment) !== 'within').length;
  }
  const crossedThen = assessmentWords('richardson2023');
  const crossedNow = assessmentWords('phc2026');

  const { list, items } = kit.legend(
    'The zones',
    [
      {
        name: 'Safe operating space',
        about: 'inside the dark green ring',
        colour: ZONE_COLOURS.safe,
      },
      {
        name: 'Increasing risk',
        about: 'past a boundary, up to the orange line',
        colour: ZONE_COLOURS.increasing,
      },
      { name: 'High risk', about: 'past the orange line', colour: ZONE_COLOURS.high },
      'Faded: a range, or the report’s judgement. Pale bars: 2023. “!”: see the table.',
    ],
    false,
  );
  list.dataset['testid'] = 'boundary-legend';
  const comparing = items[3];
  if (comparing !== undefined) {
    during('compare', comparing);
    // On a phone, the legend's one line: the key to the comparison (the caption gives the zones).
    comparing.classList.add('is-now');
  }

  return {
    ends: { safe: SAFE_MS, pressure: PRESSURE_MS, compare: COMPARE_MS },
    camera(shown, t) {
      // Down from over Earth to the whole wheel, then turning slowly round it.
      const settle = shown === 'safe' ? ease(within(t, 0, 3500)) : 1;
      // Far enough that the wheel and its names fit across the stage, whichever way it is held.
      const across = Math.tan((camera.fov * Math.PI) / 360) * Math.min(camera.aspect, 1);
      const distance =
        4 + (((camera.aspect < 1 ? 1.5 : 1.25) * WHEEL_RADIUS) / across - 4) * settle;
      const elevation = 0.5 + 0.7 * settle;
      const turn = (shown === 'safe' ? 0 : shown === 'pressure' ? t : PRESSURE_MS + t) * 0.000025;
      camera.position.set(
        Math.sin(turn) * Math.cos(elevation) * distance,
        Math.sin(elevation) * distance,
        Math.cos(turn) * Math.cos(elevation) * distance,
      );
      controls.target.set(0, 0, 0);
    },
    frame(_t, dt, playing) {
      if (playing) earth.rotation.y += dt * 0.00008;
    },
    place(shown, t) {
      const rings = shown === 'safe' ? within(t, 300, 2200) : 1;
      zones.forEach(({ material, opacity }) => {
        material.opacity = opacity * rings;
      });
      boundaryLine.material.opacity = rings;
      highRiskLine.material.opacity = rings;
      for (const { name } of sectors)
        name.element.style.opacity = String(shown === 'safe' ? within(t, 1500, 3500) : 1);
      if (shown === 'safe') grow(() => 0, 0);
      else if (shown === 'pressure') {
        grow(
          (index) =>
            ease(
              within(
                t,
                GROW_FROM + index * GROW_STAGGER,
                GROW_FROM + index * GROW_STAGGER + GROW_MS,
              ),
            ),
          0,
        );
      } else grow(() => 1, ease(within(t, 0, 1500)));
      const crossed = Number(kit.container.dataset['crossed'] ?? '0');
      counter.element.textContent =
        shown === 'compare'
          ? `2023: ${String(crossedThen)} of 9 · 2026: ${String(crossedNow)} of 9`
          : shown === 'pressure'
            ? `${String(crossed)} of 9 crossed`
            : 'Pre-industrial';
    },
    restart() {
      grow(() => 0, 0);
    },
  };
}
