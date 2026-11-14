/**
 * Life through time's fan (#358): the periods as rings, the tree faint beyond the playhead and
 * full inside it, the genera living then as dots on the ring, the groups named round the rim,
 * and the picked line lit. Also which line is under a point of it. Drawn on a 2D canvas.
 */

import { isWithin } from '../../data/lineages';
import { elementAt, valueAt } from '../../util/arrays';
import {
  colourOf,
  fit,
  halo,
  OTHERS,
  PALETTE,
  periodRings,
  rOf,
  traceNode,
  withAlpha,
  type Loaded,
  type Moment,
} from './lineagesTree';

import { fanFrame, pickFan, type FanFrame, type FanView } from './fanPicking';
export type { FanView } from './fanPicking';

function frameOf(canvas: HTMLCanvasElement, view: FanView): FanFrame {
  return fanFrame(canvas.clientWidth, canvas.clientHeight, view);
}

/** Draw the fan at the moment, as viewed. */
export function drawFan(canvas: HTMLCanvasElement, moment: Moment, view: FanView): void {
  const context = fit(canvas);
  if (context === null) return;
  const frame = frameOf(canvas, view);
  const { scale, cx, cy, width, height } = frame;
  context.fillStyle = '#040812';
  context.fillRect(0, 0, width, height);
  const ratio = window.devicePixelRatio || 1;
  const px = 1 / scale;
  context.setTransform(ratio * scale, 0, 0, ratio * scale, ratio * cx, ratio * cy);
  drawRings(context, moment.data, px);
  drawTree(context, moment, px, view.zoom);
  // Words, in screen pixels.
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  drawWords(context, moment, frame);
  if (moment.picked >= 0) pinName(context, moment, frame);
}

/** The periods as rings, shaded in turn. */
function drawRings(context: CanvasRenderingContext2D, data: Loaded, px: number): void {
  let shade = false;
  for (const { outer, inner } of periodRings(data)) {
    shade = !shade;
    context.beginPath();
    context.arc(0, 0, outer, 0, 2 * Math.PI);
    context.arc(0, 0, inner, 0, 2 * Math.PI, true);
    context.fillStyle = shade ? 'rgba(120, 150, 210, 0.07)' : 'rgba(120, 150, 210, 0.025)';
    context.fill();
    context.beginPath();
    context.arc(0, 0, outer, 0, 2 * Math.PI);
    context.lineWidth = px;
    context.strokeStyle = 'rgba(160, 185, 230, 0.16)';
    context.stroke();
  }
}

/** The tree, faint beyond the playhead and full inside it; the ring, and the genera on it. */
function drawTree(
  context: CanvasRenderingContext2D,
  { data, at, picked, pickedPath, living }: Moment,
  px: number,
  zoom: number,
): void {
  const now = rOf(data, at);
  // The future, faint: the shape of what is to come.
  context.globalAlpha = 0.13;
  paintTree(context, data, px);
  context.globalAlpha = 1;
  // The past, inside the playhead ring.
  context.save();
  context.beginPath();
  context.arc(0, 0, now, 0, 2 * Math.PI);
  context.clip();
  if (picked >= 0) context.globalAlpha = 0.4;
  paintTree(context, data, px);
  context.globalAlpha = 1;
  if (pickedPath !== null) {
    context.lineWidth = 2.4 * px;
    context.strokeStyle = '#ffffff';
    context.stroke(pickedPath);
  }
  context.restore();

  // The playhead ring, and the genera living then on it.
  context.beginPath();
  context.arc(0, 0, now, 0, 2 * Math.PI);
  context.lineWidth = 1.6 * px;
  context.strokeStyle = 'rgba(255, 220, 170, 0.75)';
  context.stroke();
  const dot = Math.min(3.2, 1.8 * Math.sqrt(zoom)) * px;
  for (const index of living) {
    const angle = valueAt(data.fan.angle, index);
    const dimmed = picked >= 0 && !isWithin(data.lineages, index, picked);
    context.beginPath();
    context.arc(now * Math.cos(angle), now * Math.sin(angle), dot, 0, 2 * Math.PI);
    context.fillStyle = dimmed ? '#3a4560' : colourOf(data, index);
    context.fill();
  }
}

/** The periods in the opening at the top, the groups round the rim, and the moment. */
function drawWords(
  context: CanvasRenderingContext2D,
  { data, at, picked }: Moment,
  { scale, cx, cy }: FanFrame,
): void {
  const now = rOf(data, at);
  context.textBaseline = 'middle';
  context.textAlign = 'center';
  context.font = '10px system-ui, sans-serif';
  for (const { name, outer, inner } of periodRings(data)) {
    const y = ((outer + inner) / 2) * scale;
    // Not where the moment is named, at the top of its ring.
    if ((outer - inner) * scale < 11 || Math.abs(y - (now * scale + 9)) < 12) continue;
    halo(context, name, cx, cy - y, 'rgba(190, 205, 235, 0.75)');
  }
  context.font = '600 12px system-ui, sans-serif';
  data.heads.forEach((head, colour) => {
    const angle = valueAt(data.middles, colour);
    const reach = 1.03 * scale;
    const flip = Math.cos(angle) < 0;
    context.save();
    context.translate(cx + reach * Math.cos(angle), cy + reach * Math.sin(angle));
    context.rotate(flip ? angle + Math.PI : angle);
    context.textAlign = flip ? 'right' : 'left';
    const related =
      picked < 0 || isWithin(data.lineages, head, picked) || isWithin(data.lineages, picked, head);
    context.fillStyle = related ? (PALETTE[colour] ?? OTHERS) : 'rgba(160, 170, 190, 0.5)';
    context.fillText(elementAt(data.lineages.nodes, head).name, 0, 0);
    context.restore();
  });
  // The moment, at the top of its ring.
  context.textAlign = 'center';
  context.font = '600 11px system-ui, sans-serif';
  halo(
    context,
    at < 0.5 ? 'Today' : `${String(Math.round(at))} Ma`,
    cx,
    cy - now * scale - 9,
    '#ffdcaa',
  );
}

/** The picked name, on a white tab where its line is at the playhead (or ends). */
function pinName(
  context: CanvasRenderingContext2D,
  { data, at, picked }: Moment,
  { scale, cx, cy }: FanFrame,
): void {
  const node = elementAt(data.lineages.nodes, picked);
  const angle = valueAt(data.fan.angle, picked);
  const r = rOf(data, Math.max(Math.min(at, node.first), node.last)) * scale;
  const x = cx + r * Math.cos(angle);
  const y = cy + r * Math.sin(angle);
  context.font = '600 12px system-ui, sans-serif';
  context.textAlign = 'left';
  const wide = context.measureText(node.name).width;
  context.fillStyle = '#ffffff';
  context.beginPath();
  context.roundRect(x + 8, y - 9, wide + 10, 18, 6);
  context.arc(x, y, 3.5, 0, 2 * Math.PI);
  context.fill();
  context.fillStyle = '#0a1020';
  context.fillText(node.name, x + 13, y);
}

function paintTree(context: CanvasRenderingContext2D, data: Loaded, px: number): void {
  data.fans.forEach((path, slot) => {
    context.fillStyle = withAlpha(slot - 1, 0.2);
    context.fill(path);
  });
  context.lineWidth = 0.7 * px;
  data.branches.forEach((path, slot) => {
    context.strokeStyle = withAlpha(slot - 1, 0.55);
    context.stroke(path);
  });
  context.lineWidth = 1.2 * px;
  data.lives.forEach((path, slot) => {
    context.strokeStyle = withAlpha(slot - 1, 0.95);
    context.stroke(path);
  });
}

/** The picked node's lines: its members' and its line back to the centre. */
export function litPath(data: Loaded, index: number): Path2D {
  const path = new Path2D();
  for (const node of data.lineages.nodes) {
    if (isWithin(data.lineages, node.index, index) || isWithin(data.lineages, index, node.index)) {
      traceNode(data, node.index, path, path);
    }
  }
  return path;
}

/** Pointer-to-genus wiring; the geometry is unit-tested without a canvas. */
export function genusAtFan(
  canvas: HTMLCanvasElement,
  { data, at }: Moment,
  view: FanView,
  x: number,
  y: number,
): number | undefined {
  return pickFan(data, at, frameOf(canvas, view), x, y);
}
