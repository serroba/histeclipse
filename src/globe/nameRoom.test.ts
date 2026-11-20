import { describe, expect, it } from 'vitest';

import { fitName, markerNameBox, RAIL_COLUMN, type NameRoom } from './nameRoom';
import type { Box } from './spaceFrame';

/** A phone's view: 412 wide, the panels covering 200 px at the top and 300 at the bottom. */
const ROOM: NameRoom = { width: 412, height: 900, top: 200, bottom: 300 };
const WEBB = { width: 170, height: 16 };

describe('where a name in space goes (#997)', () => {
  it('Given room to the right, Then it goes to the right of its dot', () => {
    const taken: Box[] = [];
    expect(fitName(100, 400, WEBB, ROOM, taken)).toEqual({
      box: { x: 100, y: 392, w: 170, h: 16 },
      left: false,
      lift: 0,
    });
    expect(taken).toHaveLength(1);
  });

  it('Given its name would run into the zoom rail, Then it goes to the left', () => {
    const fit = fitName(200, 400, WEBB, ROOM, []);
    expect(fit?.left).toBe(true);
    expect(fit?.box.x).toBe(30);
    expect(200 + WEBB.width).toBeGreaterThan(ROOM.width - RAIL_COLUMN);
  });

  it('Given Earth’s name beside the dot, as JWST behind Earth was, Then it goes the other way', () => {
    const earth = markerNameBox(260, 400, 4, 'Earth and Moon');
    const fit = fitName(250, 402, WEBB, { ...ROOM, width: 900 }, [earth]);
    expect(fit?.left).toBe(true);
  });

  it('Given a long name across both sides, as the bodies’ merged one, Then it goes a line above', () => {
    const bodies = { x: 0, y: 394, w: 412, h: 12 };
    const fit = fitName(150, 400, { width: 40, height: 16 }, ROOM, [bodies]);
    expect(fit?.lift).toBe(-16);
    expect(fit?.box.y).toBe(376);
    const under = fitName(150, 400, { width: 40, height: 16 }, ROOM, [
      bodies,
      { x: 0, y: 375, w: 412, h: 16 },
    ]);
    expect(under?.lift).toBe(16);
  });

  it('Given no room either side, or under a panel, Then it is not shown', () => {
    expect(fitName(200, 400, { width: 300, height: 16 }, ROOM, [])).toBeNull();
    expect(fitName(100, 150, WEBB, ROOM, [])).toBeNull();
    expect(fitName(100, 650, WEBB, ROOM, [])).toBeNull();
  });

  it('Then a body’s marker covers its name beside its ring, not the ring', () => {
    const box = markerNameBox(100, 300, 3, 'Earth');
    expect(box.x).toBe(111);
    expect(box.w).toBeCloseTo(34, 0);
    expect(box.h).toBe(16);
    expect(fitName(80, 300, { width: 20, height: 16 }, { ...ROOM, top: 0 }, [box])).not.toBeNull();
  });
});
