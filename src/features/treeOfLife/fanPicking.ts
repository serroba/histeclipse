/** Fan geometry and hit testing, independent of the canvas and its rendering. */
import { elementAt, valueAt } from '../../util/arrays';
import { NEAR, rOf, type Loaded } from './lineagesTree';

type FanData = Pick<Loaded, 'fan' | 'heads' | 'lineages' | 'roundAngles' | 'oldest' | 'youngest'>;

/** The rim's radius as a share of half the canvas, leaving room for the names round it. */
const REACH = 0.78;

/** How the fan is viewed: zoom about the centre, and how far it is moved (CSS pixels). */
export interface FanView {
  readonly zoom: number;
  readonly panX: number;
  readonly panY: number;
}

/** The fan's scale (CSS pixels per unit radius) and centre, and the canvas's size. */
export interface FanFrame {
  readonly scale: number;
  readonly cx: number;
  readonly cy: number;
  readonly width: number;
  readonly height: number;
}

export function fanFrame(width: number, height: number, view: FanView): FanFrame {
  return {
    scale: (Math.min(width, height) / 2) * REACH * view.zoom,
    cx: width / 2 + view.panX,
    cy: height / 2 + view.panY,
    width,
    height,
  };
}

/** The node (genus, or group by its name at the rim) at a point on the fan, if near enough. */
export function pickFan(
  data: FanData,
  at: number,
  frame: FanFrame,
  x: number,
  y: number,
): number | undefined {
  const { scale, cx, cy } = frame;
  const ux = (x - cx) / scale;
  const uy = (y - cy) / scale;
  const r = Math.hypot(ux, uy);
  let angle = Math.atan2(uy, ux);
  if (angle < -Math.PI / 2) angle += 2 * Math.PI;
  const tolerance = NEAR / scale;
  if (r > 1 + tolerance) {
    return data.heads.find(
      (each) =>
        angle >= valueAt(data.fan.low, each) - 0.01 && angle <= valueAt(data.fan.high, each) + 0.01,
    );
  }
  const angles = data.roundAngles;
  let low = 0;
  let high = angles.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (valueAt(angles, middle) < angle) low = middle + 1;
    else high = middle;
  }
  const now = rOf(data, at);
  let best: number | undefined;
  let nearest = NEAR;
  for (let slot = Math.max(0, low - 8); slot < Math.min(angles.length, low + 8); slot++) {
    const index = valueAt(data.fan.round, slot);
    const node = elementAt(data.lineages.nodes, index);
    const inner = rOf(data, node.first) - tolerance;
    const outer = Math.min(rOf(data, node.last), now) + tolerance;
    if (r < inner || r > outer) continue;
    const away = Math.abs(valueAt(angles, slot) - angle) * r * scale;
    if (away < nearest) {
      nearest = away;
      best = index;
    }
  }
  return best;
}
