/**
 * Life through time's tree laid out for drawing (#358): the group's genera round the circle,
 * time running out from the centre, its lines and fans traced once in unit coordinates; with
 * the palette and the canvas helpers the fan and the map share.
 */

import {
  colourGroups,
  fanLayout,
  isGenus,
  origins,
  type Fan,
  type Lineages,
  type Origin,
} from '../../data/lineages';
import { PERIODS } from '../../deepTime/periods';
import { elementAt, valueAt } from '../../util/arrays';

/** One colour per colour group, as `colourGroups` numbers them; the legend's swatches match. */
export const PALETTE = [
  '#ff8a3d',
  '#4cc9f0',
  '#90be6d',
  '#f15bb5',
  '#ffd166',
  '#a26cf0',
  '#43aa8b',
  '#f94144',
] as const;
/** The colour of lines in no colour group: the key's "Others". */
export const OTHERS = '#8a93a8';
/** The centre's radius, so the first branches have room (a share of the rim's). */
const CORE = 0.05;
/** How near (CSS pixels) a pointer must come to a line to pick it. */
export const NEAR = 7;

export interface Loaded {
  readonly lineages: Lineages;
  readonly starts: readonly Origin[];
  readonly colour: readonly number[];
  readonly heads: readonly number[];
  readonly genera: readonly number[];
  readonly fan: Fan;
  /** The genera's angles round the circle, in order, for finding the one under the pointer. */
  readonly roundAngles: readonly number[];
  /** The oldest and youngest moments the group's lines reach (Ma). */
  readonly oldest: number;
  readonly youngest: number;
  readonly byPbdb: ReadonlyMap<number, number>;
  /** The tree's lines and fans in unit coordinates, one path per colour group (-1 first). */
  readonly branches: readonly Path2D[];
  readonly lives: readonly Path2D[];
  readonly fans: readonly Path2D[];
  /** The middle of each colour group's own genera round the circle, where its name goes. */
  readonly middles: readonly number[];
}

/**
 * The tree at a moment: the playhead (Ma), the node picked (-1 for none) and its lit lines, and
 * the genera living then.
 */
export interface Moment {
  readonly data: Loaded;
  readonly at: number;
  readonly picked: number;
  readonly pickedPath: Path2D | null;
  readonly living: readonly number[];
}

/** Lay a group's tree round the circle, and trace its lines and fans once. */
export function arrange(lineages: Lineages): Loaded {
  const { heads, colour } = colourGroups(lineages, PALETTE.length);
  const genera = lineages.nodes.filter(isGenus).map((node) => node.index);
  let youngest = Infinity;
  for (const index of genera) youngest = Math.min(youngest, elementAt(lineages.nodes, index).last);
  const fan = fanLayout(lineages, colour);
  const slots = PALETTE.length + 1;
  const data: Loaded = {
    lineages,
    starts: origins(lineages),
    colour,
    heads,
    genera,
    fan,
    roundAngles: fan.round.map((index) => valueAt(fan.angle, index)),
    oldest: elementAt(lineages.nodes, 0).first,
    youngest: Number.isFinite(youngest) ? youngest : 0,
    byPbdb: new Map(lineages.nodes.map((node) => [node.pbdb, node.index] as const)),
    branches: Array.from({ length: slots }, () => new Path2D()),
    lives: Array.from({ length: slots }, () => new Path2D()),
    fans: Array.from({ length: slots }, () => new Path2D()),
    middles: heads.map((_, at) => {
      const own = fan.round.filter((genus) => valueAt(colour, genus) === at);
      const first = own[0];
      const last = own.at(-1);
      return first === undefined || last === undefined
        ? 0
        : (valueAt(fan.angle, first) + valueAt(fan.angle, last)) / 2;
    }),
  };
  for (const node of lineages.nodes) {
    const slot = valueAt(colour, node.index) + 1;
    traceNode(data, node.index, elementAt(data.branches, slot), elementAt(data.lives, slot));
  }
  // Each colour group's fan: from where it branches, out along its genera's last fossils.
  heads.forEach((head, at) => {
    const path = elementAt(data.fans, at + 1);
    const from = rOf(data, elementAt(lineages.nodes, head).first);
    const angle = valueAt(data.middles, at);
    path.moveTo(from * Math.cos(angle), from * Math.sin(angle));
    for (const genus of fan.round) {
      if (valueAt(colour, genus) !== at) continue;
      const r = rOf(data, elementAt(lineages.nodes, genus).last);
      const turn = valueAt(fan.angle, genus);
      path.lineTo(r * Math.cos(turn), r * Math.sin(turn));
    }
    path.closePath();
  });
  return data;
}

/** A node's branch from its parent (along the parent's ring, then out) and, for a genus, its life. */
export function traceNode(data: Loaded, index: number, branch: Path2D, life: Path2D): void {
  const node = elementAt(data.lineages.nodes, index);
  const angle = valueAt(data.fan.angle, index);
  const start = rOf(data, node.first);
  if (node.parent >= 0) {
    const from = rOf(data, elementAt(data.lineages.nodes, node.parent).first);
    const turn = valueAt(data.fan.angle, node.parent);
    branch.moveTo(from * Math.cos(turn), from * Math.sin(turn));
    if (Math.abs(turn - angle) > 1e-9) branch.arc(0, 0, from, turn, angle, angle < turn);
    branch.lineTo(start * Math.cos(angle), start * Math.sin(angle));
  }
  if (isGenus(node)) {
    const end = rOf(data, node.last);
    life.moveTo(start * Math.cos(angle), start * Math.sin(angle));
    life.lineTo(end * Math.cos(angle), end * Math.sin(angle));
  }
}

/** A moment's radius: the group's start at the core, its last fossils (or today) at the rim. */
export function rOf(data: Pick<Loaded, 'oldest' | 'youngest'>, ma: number): number {
  const spanMa = data.oldest - data.youngest;
  return spanMa <= 0 ? 1 : CORE + ((1 - CORE) * (data.oldest - ma)) / spanMa;
}

/** The geological periods the group lived through, as rings (radii) with their names. */
export function periodRings(
  data: Loaded,
): readonly { readonly name: string; readonly outer: number; readonly inner: number }[] {
  const out: { name: string; outer: number; inner: number }[] = [];
  PERIODS.forEach((period, index) => {
    const top = index === 0 ? 0 : elementAt(PERIODS, index - 1).base;
    if (period.base <= data.youngest || top >= data.oldest) return;
    out.push({
      name: period.name,
      outer: rOf(data, Math.max(top, data.youngest)),
      inner: rOf(data, Math.min(period.base, data.oldest)),
    });
  });
  return out;
}

export function colourOf(data: Loaded, index: number): string {
  return PALETTE[valueAt(data.colour, index)] ?? OTHERS;
}

/** Size a canvas's backing store to its box at the screen's pixel ratio; draw in CSS pixels. */
export function fit(target: HTMLCanvasElement): CanvasRenderingContext2D | null {
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.round(target.clientWidth * ratio));
  const height = Math.max(1, Math.round(target.clientHeight * ratio));
  if (target.width !== width || target.height !== height) {
    target.width = width;
    target.height = height;
  }
  const context = target.getContext('2d');
  context?.setTransform(ratio, 0, 0, ratio, 0, 0);
  return context;
}

/** Text with a dark edge, so it reads over the lines. */
export function halo(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  colour: string,
): void {
  context.lineWidth = 3;
  context.strokeStyle = 'rgba(4, 8, 18, 0.9)';
  context.strokeText(text, x, y);
  context.fillStyle = colour;
  context.fillText(text, x, y);
}

/** A colour group's colour (-1: the others) at an opacity. */
export function withAlpha(colour: number, alpha: number): string {
  const hex = PALETTE[colour] ?? OTHERS;
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  return `rgba(${String(r)}, ${String(g)}, ${String(b)}, ${String(alpha)})`;
}
