/**
 * Space as the wave finds it (#829), in three.js: a ring of free test masses, the sheet of space
 * they float in drawn as a grid, and sheets of points behind it the wave has already passed
 * through. The grid and the points are moved in the vertex shader, each sheet by its own strain
 * (`wavePlay.ts`), so a phone draws thousands of them; the ring's few masses are moved here, by
 * the same formula (`strain.ts`). A faint circle stays where the ring was at rest.
 *
 * Builds objects only: the view (`waveView.ts`) draws them.
 */

import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  InstancedMesh,
  LineLoop,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  MeshStandardMaterial,
  Points,
  ShaderMaterial,
  SphereGeometry,
} from 'three';

import { displacementInPlane, type Polarisations } from './strain';

/** The stack's sheets, the first holding the ring and its grid. */
export const SHEETS = 9;
/** How far back the stack goes, in the ring's radii. */
export const STACK_DEPTH = 4;
/** The test masses round the ring. */
export const MASSES = 24;
/** The grid's lines across each way, and how far out it reaches, in ring radii. */
const GRID_LINES = 17;
const GRID_REACH = 1.6;
/** Points across each sheet behind. */
const SHEET_POINTS = 13;

const COLOURS = {
  grid: 0x6d86b8,
  sheet: 0x7ea6ff,
  mass: 0xffc861,
  rest: 0x8a93a6,
} as const;

const VERTEX = /* glsl */ `
  uniform float plusOf[SHEETS];
  uniform float crossOf[SHEETS];
  uniform float pointSize;
  attribute float sheet;
  varying float fade;
  void main() {
    // The farther back a sheet, the fainter: the stack reads as layers, not a cloud.
    fade = 1.0 - 0.85 * sheet / float(SHEETS - 1);
    int k = int(sheet + 0.5);
    float hp = plusOf[k];
    float hc = crossOf[k];
    vec3 moved = position;
    moved.x += 0.5 * (hp * position.x + hc * position.y);
    moved.y += 0.5 * (hc * position.x - hp * position.y);
    vec4 seen = modelViewMatrix * vec4(moved, 1.0);
    gl_Position = projectionMatrix * seen;
    gl_PointSize = pointSize / max(0.1, -seen.z);
  }
`;

const FRAGMENT = /* glsl */ `
  uniform vec3 colour;
  uniform float opacity;
  uniform bool round;
  varying float fade;
  void main() {
    if (round && length(gl_PointCoord - 0.5) > 0.5) discard;
    gl_FragColor = vec4(colour, opacity * fade);
  }
`;

/** A material that moves each vertex by its sheet's strain. */
function strainMaterial(colour: number, opacity: number, round: boolean): ShaderMaterial {
  return new ShaderMaterial({
    defines: { SHEETS },
    uniforms: {
      plusOf: { value: new Array<number>(SHEETS).fill(0) },
      crossOf: { value: new Array<number>(SHEETS).fill(0) },
      pointSize: { value: 30 },
      colour: { value: new Color(colour) },
      opacity: { value: opacity },
      round: { value: round },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
  });
}

/** The grid of the ring's sheet: lines each way, as segments, all in sheet 0. */
export function gridPositions(): Float32Array {
  const values: number[] = [];
  for (let index = 0; index < GRID_LINES; index += 1) {
    const at = -GRID_REACH + (2 * GRID_REACH * index) / (GRID_LINES - 1);
    values.push(at, -GRID_REACH, 0, at, GRID_REACH, 0, -GRID_REACH, at, 0, GRID_REACH, at, 0);
  }
  return new Float32Array(values);
}

/** The points of the sheets behind the ring, and which sheet each is in. */
export function sheetPoints(depths: readonly number[]): {
  readonly positions: Float32Array;
  readonly sheets: Float32Array;
} {
  const behind = depths.slice(1);
  const perSheet = SHEET_POINTS * SHEET_POINTS;
  const positions = new Float32Array(behind.length * perSheet * 3);
  const sheets = new Float32Array(behind.length * perSheet);
  behind.forEach((z, index) => {
    for (let i = 0; i < SHEET_POINTS; i += 1) {
      for (let j = 0; j < SHEET_POINTS; j += 1) {
        const n = index * perSheet + i * SHEET_POINTS + j;
        positions[3 * n] = -GRID_REACH + (2 * GRID_REACH * i) / (SHEET_POINTS - 1);
        positions[3 * n + 1] = -GRID_REACH + (2 * GRID_REACH * j) / (SHEET_POINTS - 1);
        positions[3 * n + 2] = z;
        sheets[n] = index + 1;
      }
    }
  });
  return { positions, sheets };
}

/** Where each mass sits at rest, round the ring of radius 1. */
export function ringAtRest(): [number, number][] {
  return Array.from({ length: MASSES }, (_, index) => {
    const angle = (2 * Math.PI * index) / MASSES;
    return [Math.cos(angle), Math.sin(angle)];
  });
}

export interface SpaceGrid {
  readonly group: Group;
  /** Move everything for these strains, one per sheet, the ring's first. */
  set(strains: readonly Polarisations[]): void;
  /** Points as wide on every screen: the renderer's device pixels per CSS pixel. */
  scalePoints(pixelRatio: number): void;
  dispose(): void;
}

export function createSpaceGrid(depths: readonly number[]): SpaceGrid {
  if (depths.length !== SHEETS) throw new Error(`the stack has ${String(SHEETS)} sheets`);
  const group = new Group();
  const owned: { dispose(): void }[] = [];
  const own = <T extends { dispose(): void }>(item: T): T => {
    owned.push(item);
    return item;
  };

  const gridGeometry = own(new BufferGeometry());
  const grid = gridPositions();
  gridGeometry.setAttribute('position', new BufferAttribute(grid, 3));
  gridGeometry.setAttribute('sheet', new BufferAttribute(new Float32Array(grid.length / 3), 1));
  const gridMaterial = own(strainMaterial(COLOURS.grid, 0.55, false));
  const gridLines = new LineSegments(gridGeometry, gridMaterial);
  gridLines.frustumCulled = false;

  const behind = sheetPoints(depths);
  const pointsGeometry = own(new BufferGeometry());
  pointsGeometry.setAttribute('position', new BufferAttribute(behind.positions, 3));
  pointsGeometry.setAttribute('sheet', new BufferAttribute(behind.sheets, 1));
  const pointsMaterial = own(strainMaterial(COLOURS.sheet, 0.8, true));
  const points = new Points(pointsGeometry, pointsMaterial);
  points.frustumCulled = false;

  const rest = ringAtRest();
  const restGeometry = own(new BufferGeometry());
  restGeometry.setAttribute(
    'position',
    new BufferAttribute(new Float32Array(rest.flatMap(([x, y]) => [x, y, 0])), 3),
  );
  const restLine = new LineLoop(
    restGeometry,
    own(new LineBasicMaterial({ color: COLOURS.rest, transparent: true, opacity: 0.6 })),
  );

  const masses = new InstancedMesh(
    own(new SphereGeometry(0.055, 16, 12)),
    own(
      new MeshStandardMaterial({
        color: COLOURS.mass,
        emissive: new Color(COLOURS.mass).multiplyScalar(0.25),
        roughness: 0.35,
        metalness: 0.2,
      }),
    ),
    MASSES,
  );
  own(masses);
  group.add(points, gridLines, restLine, masses);

  const placed = new Matrix4();
  const materials: readonly ShaderMaterial[] = [gridMaterial, pointsMaterial];
  function set(strains: readonly Polarisations[]): void {
    for (const material of materials) {
      const plus = material.uniforms['plusOf']?.value as number[];
      const crossed = material.uniforms['crossOf']?.value as number[];
      strains.forEach((strain, index) => {
        plus[index] = strain.plus;
        crossed[index] = strain.cross;
      });
    }
    const ring = strains[0] ?? { plus: 0, cross: 0 };
    rest.forEach(([x, y], index) => {
      const [dx, dy] = displacementInPlane(ring, x, y);
      masses.setMatrixAt(index, placed.makeTranslation(x + dx, y + dy, 0));
    });
    masses.instanceMatrix.needsUpdate = true;
  }
  set(depths.map(() => ({ plus: 0, cross: 0 })));

  return {
    group,
    set,
    scalePoints(pixelRatio) {
      const size = pointsMaterial.uniforms['pointSize'];
      if (size !== undefined) size.value = 30 * pixelRatio;
    },
    dispose() {
      for (const item of owned) item.dispose();
    },
  };
}
