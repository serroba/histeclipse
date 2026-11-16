/**
 * The mesh of a day's ozone surface (#804), worked out from its numbers: two faces, the lower
 * and the upper, each a grid of points raised to the surface's height, and a wall joining them
 * round every opening, so the layer reads as a solid shell with a hole through it. A column of
 * air with no surface has no point; a triangle is drawn only where all three of its corners
 * have one.
 *
 * A day's mesh is made for every day that plays, so a mesher keeps what does not change from
 * day to day (where each point lies on the unit sphere, the colour of each amount of ozone) and
 * the buffers it fills, rather than working them out and allocating them anew each time (#819).
 */

import { ozoneColour } from '../../data/ozoneMaps';
import { finerField, shellRadius, type ShellField } from '../../data/ozoneShell';
import { geoToVector } from '../../globe/geo';

/** How many points the mesh has for each of the field's, each way: one a degree. */
const FINER = 3;
/** The colours' steps, Dobson units: a half is finer than any eye tells on the scale. */
const COLOUR_STEP = 0.5;
const COLOUR_FROM = 220;
const COLOUR_TO = 420;

export interface ShellMesh {
  /** Each point from Earth's centre, Earth radii: x, y, z. */
  readonly positions: Float32Array;
  /** Each point's colour by its total ozone: red, green, blue, 0 to 1. */
  readonly colours: Float32Array;
  /** The corners of each triangle, as points' numbers: a view of `room`'s start. */
  readonly triangles: Uint32Array;
  /** The whole buffer the triangles are in, which is the same one from day to day until it
   * must grow. */
  readonly room: Uint32Array;
}

/** The colour of each amount of ozone on the surface: the scale's, at 220 for the hole's edge. */
function colourTable(): Float32Array {
  const steps = Math.round((COLOUR_TO - COLOUR_FROM) / COLOUR_STEP) + 1;
  const table = new Float32Array(steps * 3);
  for (let step = 0; step < steps; step += 1) {
    const [r, g, b] = ozoneColour(COLOUR_FROM + step * COLOUR_STEP);
    table.set([r / 255, g / 255, b / 255], step * 3);
  }
  return table;
}

/** Where each point of a face lies on the unit sphere: x, y, z; the rows from the North Pole. */
function unitPoints(rows: number, across: number, columns: number): Float32Array {
  const units = new Float32Array(rows * across * 3);
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < across; column += 1) {
      const place = {
        latitude: 90 - (row * 180) / (rows - 1),
        longitude: (column * 360) / columns,
      };
      units.set(geoToVector(place), (row * across + column) * 3);
    }
  }
  return units;
}

/** Make a mesher: a day's field to its mesh, the buffers its own and reused. */
export function createShellMesher(): (coarse: ShellField) => ShellMesh {
  const colours = colourTable();
  let units: Float32Array = new Float32Array(0);
  let positions = new Float32Array(0);
  let shade = new Float32Array(0);
  let room: Uint32Array = new Uint32Array(0);
  let size = '';

  return (coarse) => {
    const field = finerField(coarse, FINER);
    const { rows, columns } = field;
    const across = columns + 1;
    const face = rows * across;
    if (size !== `${String(rows)}x${String(columns)}`) {
      size = `${String(rows)}x${String(columns)}`;
      units = unitPoints(rows, across, columns);
      positions = new Float32Array(face * 2 * 3);
      shade = new Float32Array(face * 2 * 3);
      room = new Uint32Array(face * 6 * 3);
    }
    const there = new Uint8Array(face);
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < across; column += 1) {
        const cell = row * columns + (column % columns);
        const lower = Number(field.lowerKm[cell]);
        const upper = Number(field.upperKm[cell]);
        const point = row * across + column;
        if (Number.isNaN(lower) || Number.isNaN(upper)) continue;
        there[point] = 1;
        placed(positions, units, point, face, lower, upper);
        const at = Math.max(Number(field.du[cell]), COLOUR_FROM);
        const step = Math.min(Math.round((at - COLOUR_FROM) / COLOUR_STEP), colours.length / 3 - 1);
        shade.set(colours.subarray(step * 3, step * 3 + 3), point * 3);
        shade.copyWithin((face + point) * 3, point * 3, point * 3 + 3);
      }
    }
    const built = triangles(there, rows, columns, face, room);
    room = built.room;
    return {
      positions,
      colours: shade,
      triangles: room.subarray(0, built.count),
      room,
    };
  };
}

/** Put a point's two places, at the lower and the upper height, in `positions`. */
function placed(
  positions: Float32Array,
  units: Float32Array,
  point: number,
  face: number,
  lower: number,
  upper: number,
): void {
  const [x = 0, y = 0, z = 0] = units.subarray(point * 3, point * 3 + 3);
  const low = shellRadius(lower);
  const high = shellRadius(upper);
  positions.set([x * low, y * low, z * low], point * 3);
  positions.set([x * high, y * high, z * high], (face + point) * 3);
}

/** The triangles over the points that are there, in `room` (grown if it is too small). */
function triangles(
  there: Uint8Array,
  rows: number,
  columns: number,
  face: number,
  start: Uint32Array,
): { readonly room: Uint32Array; readonly count: number } {
  const across = columns + 1;
  let room = start;
  let count = 0;
  /** Room for `more` corners, the buffer doubled if it is too small. */
  const reserve = (more: number): void => {
    if (count + more <= room.length) return;
    const grown = new Uint32Array(room.length * 2);
    grown.set(room);
    room = grown;
  };
  /** A triangle of the three points' numbers. */
  const triangle = (a: number, b: number, c: number): void => {
    room[count] = a;
    room[count + 1] = b;
    room[count + 2] = c;
    count += 3;
  };
  /** Whether the square of points with `row`, `column` at its north-west corner is whole. */
  const whole = (row: number, column: number): boolean => {
    if (row < 0 || row >= rows - 1) return false;
    const at = row * across + (((column % columns) + columns) % columns);
    return (
      there[at] === 1 &&
      there[at + 1] === 1 &&
      there[at + across] === 1 &&
      there[at + across + 1] === 1
    );
  };
  /** A wall between the faces along the edge from point `a` to point `b`. */
  const wall = (a: number, b: number): void => {
    triangle(a, b, face + a);
    triangle(b, face + b, face + a);
  };
  for (let row = 0; row < rows - 1; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      if (!whole(row, column)) continue;
      const a = row * across + column;
      const b = a + 1;
      const c = a + across;
      const d = c + 1;
      // The most a square adds: its four triangles and a wall (two) on each of its four sides.
      reserve(36);
      triangle(a, c, b);
      triangle(b, c, d);
      triangle(face + a, face + b, face + c);
      triangle(face + b, face + d, face + c);
      // Where the square beside it is missing, the shell's edge: closed with a wall.
      if (!whole(row - 1, column)) wall(a, b);
      if (!whole(row + 1, column)) wall(c, d);
      if (!whole(row, column - 1)) wall(a, c);
      if (!whole(row, column + 1)) wall(b, d);
    }
  }
  return { room, count };
}
