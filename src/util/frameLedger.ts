/**
 * Where a frame's time went, by part (#1196): the stage's parts, the render, each feature and
 * each thing drawn as the view changes note how long they took, so a long animation frame can
 * say which of them made it long. The browser names only the script that ran (the stage's
 * loop, for most), not what that loop ran.
 *
 * Each notes its own time only: a part timed inside another is taken out of the other's, so
 * the times add up without counting anything twice. Kept for the last few seconds, in a ring
 * of fixed size, so noting costs no allocation and the ledger never grows.
 */

/** A part's time within a frame: its name, and the milliseconds it took on its own. */
export interface PartTime {
  readonly name: string;
  readonly ms: number;
}

/** Notes kept: a few seconds of frames at the most parts a frame notes. */
const SIZE = 4096;

const names: string[] = [];
const starts = new Float64Array(SIZE);
const selves = new Float64Array(SIZE);
let next = 0;
let count = 0;
/** For each part being timed, inner first: when it began, and its inner parts' time. */
const openStarts: number[] = [];
const openInner: number[] = [];

/** Start timing a part; `end` it with its name. Parts started inside it end before it. */
export function begin(): void {
  openStarts.push(performance.now());
  openInner.push(0);
}

/** End the part last begun, as `name`: its own time noted, and taken out of the outer's. */
export function end(name: string): void {
  const start = openStarts.pop();
  const inner = openInner.pop();
  if (start === undefined || inner === undefined) return;
  const total = performance.now() - start;
  const depth = openInner.length;
  if (depth > 0) openInner[depth - 1] = (openInner[depth - 1] ?? 0) + total;
  names[next] = name;
  starts[next] = start;
  selves[next] = total - inner;
  next = (next + 1) % SIZE;
  count = Math.min(count + 1, SIZE);
}

/** Run `run`, timed as `name`. */
export function timed<T>(name: string, run: () => T): T {
  begin();
  try {
    return run();
  } finally {
    end(name);
  }
}

/** The parts begun between `from` and `to` (ms, as `performance.now`), longest first. */
export function partsWithin(from: number, to: number, most = 5): PartTime[] {
  const totals = new Map<string, number>();
  for (let index = 0; index < count; index += 1) {
    const at = starts[index] ?? 0;
    if (at < from || at > to) continue;
    const name = names[index] ?? '';
    totals.set(name, (totals.get(name) ?? 0) + (selves[index] ?? 0));
  }
  return [...totals]
    .map(([name, ms]) => ({ name, ms }))
    .sort((a, b) => b.ms - a.ms)
    .slice(0, most);
}

/** The time of every part begun between `from` and `to`, together. */
export function timedWithin(from: number, to: number): number {
  let total = 0;
  for (let index = 0; index < count; index += 1) {
    const at = starts[index] ?? 0;
    if (at >= from && at <= to) total += selves[index] ?? 0;
  }
  return total;
}

/** Forget every note: for tests. */
export function clearLedger(): void {
  next = 0;
  count = 0;
  openStarts.length = 0;
  openInner.length = 0;
}
