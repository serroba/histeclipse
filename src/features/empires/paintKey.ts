/**
 * What the states' map shows, as a key (#692): which rows of which file stand in the year. The
 * same key draws the same map, so travelling through the years repaints it (and the ways of life
 * under it, on the same canvas) only when a state comes, goes or changes shape, not every year.
 * In 7400 BCE, with no state yet recorded, it never repaints. Pure.
 */

const ids = new WeakMap<object, number>();
let made = 0;
/** A number for `file`, the same for as long as it is kept. */
function idOf(file: object): number {
  let id = ids.get(file);
  if (id === undefined) {
    made += 1;
    id = made;
    ids.set(file, id);
  }
  return id;
}

/** The rows of `file` standing in `year`, as a key; null `file`, none. */
export function standingKey(
  file: object | null,
  rows: readonly { readonly from: number; readonly to: number }[],
  year: number,
): string {
  if (file === null) return '';
  const standing: number[] = [];
  rows.forEach(({ from, to }, index) => {
    if (from <= year && year <= to) standing.push(index);
  });
  return `${String(idOf(file))}:${standing.join(',')}`;
}
