import { describe, expect, it } from 'vitest';

import { ventsAround } from './fumesModel';
import { LAVA_VENTS } from './lavaFlowsPart';
import { EXTENTS } from './provinceExtents';

const EARTH_KM = 6371;
const RADIAN = Math.PI / 180;
/** As `fumesLayer.ts` runs it: each vent's lava reaches this share of the spread. */
const FLOW_REACH = 0.7;
/** As `lavaFlowsPart.ts` draws it: the lobes' mean, and the front halfway through its fade. */
const LOBES = 0.8;
const FRONT = 0.925;

function unit(latitude: number, longitude: number): readonly [number, number, number] {
  const [la, lo] = [latitude * RADIAN, longitude * RADIAN];
  return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
}

/** The area, km², the lava is drawn over all flowed, from vents `spread` degrees round (0, 0). */
function drawnArea(spread: number): number {
  const vents = ventsAround({ latitude: 0, longitude: 0 }, LAVA_VENTS, spread).map((vent) =>
    unit(vent.latitude, vent.longitude),
  );
  const reach = Math.cos(FLOW_REACH * spread * RADIAN * LOBES * FRONT);
  const step = 0.25;
  const box = spread * 2.2;
  let area = 0;
  for (let latitude = -box; latitude <= box; latitude += step) {
    for (let longitude = -box; longitude <= box; longitude += step) {
      const [x, y, z] = unit(latitude, longitude);
      if (vents.some(([a, b, c]) => a * x + b * y + c * z >= reach)) {
        area += Math.cos(latitude * RADIAN) * (step * RADIAN * EARTH_KM) ** 2;
      }
    }
  }
  return area;
}

describe('the volcanic provinces drawn at their estimated extents (#1230)', () => {
  it('draws each one’s lava over the area its studies estimate, within a tenth', () => {
    expect(drawnArea(EXTENTS.siberian.spread) / EXTENTS.siberian.area).toBeCloseTo(1, 1);
    expect(drawnArea(EXTENTS.camp.spread) / EXTENTS.camp.area).toBeCloseTo(1, 1);
    expect(drawnArea(EXTENTS.emeishan.spread) / EXTENTS.emeishan.area).toBeCloseTo(1, 1);
    // All flowed: the Deccan Traps are held half so, as whether most came first is argued.
    expect(drawnArea(EXTENTS.deccan.spread) / EXTENTS.deccan.area).toBeCloseTo(1, 1);
  });

  it('says each estimate as a drawn shape, not a mapped one', () => {
    for (const extent of Object.values(EXTENTS)) {
      expect(extent.says).toContain('drawn, not mapped');
    }
  });
});
