import { InstancedMesh, Matrix4, ShaderMaterial, Vector3, type Object3D } from 'three';
import { describe, expect, it } from 'vitest';

import {
  createSpaceGrid,
  gridPositions,
  MASSES,
  ringAtRest,
  SHEETS,
  sheetPoints,
  STACK_DEPTH,
} from './spaceGrid';
import { sheets } from './wavePlay';

const stack = sheets(SHEETS, STACK_DEPTH);

function find<T extends Object3D>(root: Object3D, kind: new (...args: never[]) => T): T[] {
  const found: T[] = [];
  root.traverse((object) => {
    if (object instanceof kind) found.push(object);
  });
  return found;
}

describe('the space the wave comes through', () => {
  it('lays the ring of masses at rest on a circle', () => {
    const ring = ringAtRest();
    expect(ring).toHaveLength(MASSES);
    for (const [x, y] of ring) expect(Math.hypot(x, y)).toBeCloseTo(1, 12);
  });

  it('draws the ring’s sheet as a grid of lines, flat at the ring', () => {
    const grid = gridPositions();
    expect(grid.length % 6).toBe(0);
    for (let index = 2; index < grid.length; index += 3) expect(grid[index]).toBe(0);
  });

  it('puts the sheets behind as points, each knowing its sheet', () => {
    const { positions, sheets: which } = sheetPoints(stack.depths);
    expect(positions.length).toBe(which.length * 3);
    expect(Math.min(...which)).toBe(1);
    expect(Math.max(...which)).toBe(SHEETS - 1);
    expect(positions[positions.length - 1]).toBeCloseTo(-STACK_DEPTH, 6);
  });

  it('asks for the stack it was made for', () => {
    expect(() => createSpaceGrid([0, -1])).toThrow('sheets');
  });

  it('moves the ring’s masses by the ring sheet’s strain, and hands the rest to the shader', () => {
    const grid = createSpaceGrid(stack.depths);
    const strains = stack.depths.map((_, index) => ({ plus: 0.2 + index * 0.01, cross: 0 }));
    grid.set(strains);

    const [masses] = find(grid.group, InstancedMesh);
    if (masses === undefined) throw new Error('no masses');
    const at = new Vector3();
    at.setFromMatrixPosition(masses.getMatrixAt(0, new Matrix4()));
    // The mass on +x is stretched out by ½h₊.
    expect(at.x).toBeCloseTo(1.1, 6);
    expect(at.y).toBeCloseTo(0, 6);

    const shaders = grid.group.children.flatMap((child) =>
      'material' in child && child.material instanceof ShaderMaterial ? [child.material] : [],
    );
    expect(shaders).toHaveLength(2);
    for (const shader of shaders) {
      expect(shader.uniforms['plusOf']?.value).toEqual(strains.map((strain) => strain.plus));
      expect(shader.defines['SHEETS']).toBe(SHEETS);
    }
    grid.dispose();
  });
});
