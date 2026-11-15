/**
 * A body's place frame after frame, from a cubic through exact places on a grid (#672, #783),
 * rather than its series summed every frame. Two grids: a fine one (an hour) while time moves
 * on by little a frame or stands still, close enough for an eclipse's geometry; a coarse one
 * (days) while it plays days a second, for a body that only has to be where it is to the eye;
 * and the exact series for a frame that jumps further than either. A moment asked again gives
 * the answer it gave: all that draw one moment agree, and after fast play stops the bodies stay
 * where the coarse grid put them (the Moon within 700 km) until the moment moves on.
 */

/** A place at a moment: km, any axes. */
type Place = readonly [number, number, number];

/** Exact places kept per grid: the four a moment needs, and room to play either way. */
const KEPT = 8;

/** The cubic through the four grid places about `jd`, on a grid of `step` days. */
function onGrid(exact: (jd: number) => Place, step: number): (jd: number) => Place {
  const nodes = new Map<number, Place>();
  function node(index: number): Place {
    let place = nodes.get(index);
    if (place === undefined) {
      place = exact(index * step);
      nodes.set(index, place);
      const [oldest] = nodes.keys();
      if (nodes.size > KEPT && oldest !== undefined) nodes.delete(oldest);
    }
    return place;
  }
  return (jd) => {
    const along = jd / step;
    const index = Math.floor(along);
    const x = along - index;
    if (x === 0) return node(index);
    // Lagrange's weights for the grid places at −1, 0, 1 and 2, at x between 0 and 1.
    const weights = [
      (-x * (x - 1) * (x - 2)) / 6,
      ((x + 1) * (x - 1) * (x - 2)) / 2,
      (-(x + 1) * x * (x - 2)) / 2,
      ((x + 1) * x * (x - 1)) / 6,
    ];
    const places = [node(index - 1), node(index), node(index + 1), node(index + 2)];
    const sum = (axis: 0 | 1 | 2): number =>
      places.reduce((total, place, at) => total + (weights[at] ?? 0) * place[axis], 0);
    return [sum(0), sum(1), sum(2)];
  };
}

/**
 * `exact` for drawing frame after frame: by how far the moment moved since the last asked, the
 * fine grid (within two of its steps), the coarse grid (within two of its), or `exact` itself.
 */
export function gridBetween(
  exact: (jd: number) => Place,
  fine: number,
  coarse: number,
): (jd: number) => Place {
  const fineGrid = onGrid(exact, fine);
  const coarseGrid = onGrid(exact, coarse);
  let last = Number.NaN;
  let answer: Place = [0, 0, 0];
  return (jd) => {
    // Asked again for the same moment (the bodies, then the craft at them): the same answer.
    if (jd === last) return answer;
    const moved = Math.abs(jd - last);
    last = jd;
    if (moved <= 2 * fine) answer = fineGrid(jd);
    else if (moved <= 2 * coarse) answer = coarseGrid(jd);
    else answer = exact(jd);
    return answer;
  };
}
