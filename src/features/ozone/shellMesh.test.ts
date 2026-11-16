import { describe, expect, it } from 'vitest';

import { ozoneColour } from '../../data/ozoneMaps';
import { shellRadius, type ShellField } from '../../data/ozoneShell';
import { shellMesh } from './shellMesh';

/** A field of `rows` by `columns`, the layer from 20 to 26 km everywhere but where `open`. */
function field(
  rows: number,
  columns: number,
  open: (row: number, column: number) => boolean = () => false,
): ShellField {
  const cells = rows * columns;
  const lowerKm = new Float32Array(cells).fill(20);
  const upperKm = new Float32Array(cells).fill(26);
  const du = new Float32Array(cells).fill(310);
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      if (!open(row, column)) continue;
      lowerKm[row * columns + column] = Number.NaN;
      upperKm[row * columns + column] = Number.NaN;
      du[row * columns + column] = 120;
    }
  }
  return { rows, columns, lowerKm, upperKm, du };
}

/** The distance of point `index` from the centre. */
function radius(positions: Float32Array, index: number): number {
  return Math.hypot(
    positions[index * 3] ?? 0,
    positions[index * 3 + 1] ?? 0,
    positions[index * 3 + 2] ?? 0,
  );
}

describe('the mesh of a day’s ozone surface (#804)', () => {
  it('Given a whole layer, Then two closed faces, the lower inside the upper, with no wall but at the poles’ points', () => {
    const mesh = shellMesh(field(5, 8));
    // Three times finer: 13 rows of 24 columns and one more, for each face.
    const face = 13 * 25;
    expect(mesh.positions).toHaveLength(face * 2 * 3);
    expect(radius(mesh.positions, 6 * 25)).toBeCloseTo(shellRadius(20), 5);
    expect(radius(mesh.positions, face + 6 * 25)).toBeCloseTo(shellRadius(26), 5);
    // Every square of both faces, two triangles each; and the walls at the two poles' rows,
    // where the squares end: flat to nothing, all their points at the pole.
    const squares = 12 * 24;
    expect(mesh.triangles).toHaveLength((squares * 4 + 24 * 2 * 2) * 3);
    expect(Math.max(...mesh.triangles)).toBeLessThan(face * 2);
  });

  it('Given the round, Then the last column’s points are the first’s again, and the top row is at the North Pole', () => {
    const mesh = shellMesh(field(5, 8));
    const row = 6 * 25;
    for (const axis of [0, 1, 2]) {
      expect(mesh.positions[(row + 24) * 3 + axis]).toBeCloseTo(
        mesh.positions[row * 3 + axis] ?? Number.NaN,
        5,
      );
    }
    // +Y is north: the first row at the pole, the equator's row at no height above it.
    expect(mesh.positions[1]).toBeCloseTo(shellRadius(20), 5);
    expect(mesh.positions[row * 3 + 1]).toBeCloseTo(0, 5);
    // Longitude 0° along +X.
    expect(mesh.positions[row * 3]).toBeCloseTo(shellRadius(20), 5);
  });

  it('Given each point, Then its colour is its total ozone’s on the scale', () => {
    const mesh = shellMesh(field(5, 8));
    const [r, g, b] = ozoneColour(310);
    expect(mesh.colours[0]).toBeCloseTo(r / 255, 5);
    expect(mesh.colours[1]).toBeCloseTo(g / 255, 5);
    expect(mesh.colours[2]).toBeCloseTo(b / 255, 5);
  });

  it('Given an opening about the South Pole, Then no triangles there, and a wall joins the faces round its edge', () => {
    const whole = shellMesh(field(7, 8));
    const holed = shellMesh(field(7, 8, (row) => row >= 5));
    expect(holed.triangles.length).toBeLessThan(whole.triangles.length);
    // No triangle has a corner in the opening: its points were never placed.
    for (const index of holed.triangles) expect(radius(holed.positions, index)).toBeGreaterThan(1);
    // A wall triangle joins a lower point to an upper one: the whole layer has them only at
    // the poles, where they are flat to nothing; the holed one has them standing at the edge.
    const face = holed.positions.length / 6;
    let standing = 0;
    for (let at = 0; at < holed.triangles.length; at += 3) {
      const corners = [holed.triangles[at], holed.triangles[at + 1], holed.triangles[at + 2]].map(
        (corner) => corner ?? 0,
      );
      const lower = corners.filter((corner) => corner < face);
      if (lower.length === 0 || lower.length === 3) continue;
      const [a = 0, b = 0] = lower.length === 2 ? lower : corners.filter((c) => c >= face);
      const apart = Math.hypot(
        (holed.positions[a * 3] ?? 0) - (holed.positions[b * 3] ?? 0),
        (holed.positions[a * 3 + 1] ?? 0) - (holed.positions[b * 3 + 1] ?? 0),
        (holed.positions[a * 3 + 2] ?? 0) - (holed.positions[b * 3 + 2] ?? 0),
      );
      if (apart > 1e-6) standing += 1;
    }
    // Round the opening: two triangles for each of the 24 columns.
    expect(standing).toBe(48);
  });

  it('Given low ozone at the opening’s edge, Then its colour is the scale’s lowest, not clear', () => {
    const low = field(5, 8);
    low.du.fill(150);
    const [r, g, b] = ozoneColour(220);
    const mesh = shellMesh(low);
    expect([mesh.colours[0], mesh.colours[1], mesh.colours[2]]).toEqual([
      expect.closeTo(r / 255, 5),
      expect.closeTo(g / 255, 5),
      expect.closeTo(b / 255, 5),
    ]);
  });
});
