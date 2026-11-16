/**
 * The mesh of a day's ozone surface (#804), worked out from its numbers: two faces, the lower
 * and the upper, each a grid of points raised to the surface's height, and a wall joining them
 * round every opening, so the layer reads as a solid shell with a hole through it. A column of
 * air with no surface has no point; a triangle is drawn only where all three of its corners
 * have one.
 */

import { ozoneColour } from '../../data/ozoneMaps';
import { finerField, shellRadius, type ShellField } from '../../data/ozoneShell';
import { geoToVector } from '../../globe/geo';

/** How many points the mesh has for each of the field's, each way: one a degree. */
const FINER = 3;

export interface ShellMesh {
  /** Each point from Earth's centre, Earth radii: x, y, z. */
  readonly positions: Float32Array;
  /** Each point's colour by its total ozone: red, green, blue, 0 to 1. */
  readonly colours: Float32Array;
  /** The corners of each triangle, as points' numbers. */
  readonly triangles: Uint32Array;
}

/** The colour of an amount of ozone on the surface: the scale's, at 220 for the hole's edge. */
function colourOf(du: number): readonly [number, number, number] {
  const [r, g, b] = ozoneColour(Math.max(du, 220));
  return [r / 255, g / 255, b / 255];
}

/**
 * The mesh for a day's field, made finer first. Its points: for each face, each row and each
 * column and one more (the first again, to close the round), the lower face's first.
 */
export function shellMesh(coarse: ShellField): ShellMesh {
  const field = finerField(coarse, FINER);
  const { rows, columns } = field;
  const across = columns + 1;
  const face = rows * across;
  const positions = new Float32Array(face * 2 * 3);
  const colours = new Float32Array(face * 2 * 3);
  const there = new Uint8Array(face);
  const stepLat = 180 / (rows - 1);
  const stepLon = 360 / columns;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < across; column += 1) {
      const cell = row * columns + (column % columns);
      const lower = Number(field.lowerKm[cell]);
      const upper = Number(field.upperKm[cell]);
      const point = row * across + column;
      if (Number.isNaN(lower) || Number.isNaN(upper)) continue;
      there[point] = 1;
      const place = { latitude: 90 - row * stepLat, longitude: column * stepLon };
      const colour = colourOf(Number(field.du[cell]));
      positions.set(geoToVector(place, shellRadius(lower)), point * 3);
      positions.set(geoToVector(place, shellRadius(upper)), (face + point) * 3);
      colours.set(colour, point * 3);
      colours.set(colour, (face + point) * 3);
    }
  }
  const triangles: number[] = [];
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
    triangles.push(a, b, face + a, b, face + b, face + a);
  };
  for (let row = 0; row < rows - 1; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      if (!whole(row, column)) continue;
      const a = row * across + column;
      const b = a + 1;
      const c = a + across;
      const d = c + 1;
      triangles.push(a, c, b, b, c, d, face + a, face + b, face + c, face + b, face + d, face + c);
      // Where the square beside it is missing, the shell's edge: closed with a wall.
      if (!whole(row - 1, column)) wall(a, b);
      if (!whole(row + 1, column)) wall(c, d);
      if (!whole(row, column - 1)) wall(a, c);
      if (!whole(row, column + 1)) wall(b, d);
    }
  }
  return { positions, colours, triangles: Uint32Array.from(triangles) };
}
