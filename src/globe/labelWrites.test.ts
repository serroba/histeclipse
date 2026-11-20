import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { fakeElement } from '../test/fakes';
import { earthDisc, layOutSurface, placeLabel, roomFor, translation } from './labelWrites';
import type { Box } from './spaceFrame';

/** An element whose writes are counted: its transform and its hidden flag. */
function counted() {
  const element = fakeElement();
  const writes = { transform: 0, hidden: 0 };
  let transform = '';
  let hidden = false;
  Object.defineProperty(element.style, 'transform', {
    get: () => transform,
    set: (value: string) => {
      writes.transform += 1;
      transform = value;
    },
  });
  Object.defineProperty(element, 'hidden', {
    get: () => hidden,
    set: (value: boolean) => {
      writes.hidden += 1;
      hidden = value;
    },
  });
  return { element: element as unknown as HTMLElement, writes };
}

describe('translation', () => {
  it('moves to whole pixels, then sits the name on its point', () => {
    expect(translation(10.4, 20.6, 'translate(-50%, -50%)')).toBe(
      'translate(10px, 21px) translate(-50%, -50%)',
    );
  });
});

describe('placeLabel', () => {
  it('shows a name where it is, and writes nothing more while it stays', () => {
    const { element, writes } = counted();
    placeLabel(element, 'translate(1px, 2px)');
    placeLabel(element, 'translate(1px, 2px)');
    expect(element.style.transform).toBe('translate(1px, 2px)');
    expect(element.hidden).toBe(false);
    expect(writes).toEqual({ transform: 1, hidden: 0 });
  });

  it('moves a name only when where it is changes', () => {
    const { element, writes } = counted();
    placeLabel(element, 'translate(1px, 2px)');
    placeLabel(element, 'translate(3px, 2px)');
    expect(element.style.transform).toBe('translate(3px, 2px)');
    expect(writes.transform).toBe(2);
  });

  it('hides a name once, leaving where it was, and shows it again where it is', () => {
    const { element, writes } = counted();
    placeLabel(element, 'translate(1px, 2px)');
    placeLabel(element, null);
    placeLabel(element, null);
    expect(element.hidden).toBe(true);
    expect(writes).toEqual({ transform: 1, hidden: 1 });
    placeLabel(element, 'translate(1px, 2px)');
    expect(element.hidden).toBe(false);
    expect(writes).toEqual({ transform: 1, hidden: 2 });
  });

  it('shows again a name hidden by other code, though its place is unchanged', () => {
    const { element } = counted();
    placeLabel(element, 'translate(1px, 2px)');
    element.hidden = true;
    placeLabel(element, 'translate(1px, 2px)');
    expect(element.hidden).toBe(false);
  });

  it('keeps each element’s place apart', () => {
    const first = counted();
    const second = counted();
    placeLabel(first.element, 'translate(1px, 2px)');
    placeLabel(second.element, 'translate(1px, 2px)');
    expect(second.writes.transform).toBe(1);
    expect(first.writes.transform).toBe(1);
  });
});

describe('roomFor', () => {
  it('puts a name where it is, when that is clear, and takes the room', () => {
    const placed: Box[] = [];
    expect(roomFor(100, 50, 40, 10, placed)).toBe(50);
    expect(placed).toEqual([{ x: 80, y: 45, w: 40, h: 10 }]);
  });

  it('moves a name up to two lines away before it gives way; names that touch overlap', () => {
    const placed: Box[] = [{ x: 80, y: 45, w: 40, h: 10 }];
    // A line up or down would touch the name there, so two lines up, then two down.
    expect(roomFor(100, 50, 40, 10, placed)).toBe(30);
    expect(roomFor(100, 50, 40, 10, placed)).toBe(70);
    expect(roomFor(100, 50, 40, 10, placed)).toBeNull();
    expect(placed).toHaveLength(3);
  });

  it('places a name beside another, clear of it', () => {
    const placed: Box[] = [{ x: 0, y: 45, w: 40, h: 10 }];
    expect(roomFor(100, 50, 40, 10, placed)).toBe(50);
  });

  it('moves a name only where `over` allows, and hides it where it allows nowhere clear (#945)', () => {
    const placed: Box[] = [{ x: 80, y: 45, w: 40, h: 10 }];
    expect(roomFor(100, 50, 40, 10, placed, (y) => y > 50)).toBe(70);
    expect(roomFor(100, 50, 40, 10, [{ x: 80, y: 45, w: 40, h: 10 }], () => false)).toBeNull();
  });
});

describe('layOutSurface', () => {
  /** A camera 3 Earth radii out over (0°, 0°), looking at Earth's centre. */
  function camera(): PerspectiveCamera {
    const looking = new PerspectiveCamera(40, 1, 0.1, 100);
    looking.position.set(3, 0, 0);
    looking.lookAt(0, 0, 0);
    looking.updateMatrixWorld();
    return looking;
  }
  const view = { width: 400, height: 400, near: true, leftOut: Infinity, most: Infinity };
  /** A name 40 by 10 pixels at `position`, on Earth's surface. */
  function name(x: number, y: number, z: number) {
    const { element } = counted();
    return { element, position: new Vector3(x, y, z).normalize(), width: 40, height: 10 };
  }

  it('shows the names on the near side, and hides those behind Earth', () => {
    const front = name(1, 0, 0);
    const back = name(-1, 0, 0);
    layOutSurface([{ priority: 0, labels: [front, back] }], camera(), view);
    expect(front.element.hidden).toBe(false);
    expect(front.element.style.transform).toBe('translate(200px, 200px) translate(-50%, -50%)');
    expect(back.element.hidden).toBe(true);
  });

  it('close to the ground, hides a name beyond the horizon though it is on the near side (#864)', () => {
    // Some 3 km up over (0°, 0°), looking north and a little down, both names in its frame.
    const low = new PerspectiveCamera(90, 1, 1e-6, 10);
    low.position.set(1.0005, 0, 0);
    low.lookAt(1.0003, 0.0005, 0);
    low.updateMatrixWorld();
    const under = name(1, 0.0003, 0);
    // 30° north: well within the near side seen from afar, far over the horizon from here.
    const beyond = name(Math.cos(Math.PI / 6), Math.sin(Math.PI / 6), 0);
    for (const { position } of [under, beyond]) {
      const at = position.clone().project(low);
      expect(Math.max(Math.abs(at.x), Math.abs(at.y))).toBeLessThan(1);
    }
    layOutSurface([{ priority: 0, labels: [under, beyond] }], low, view);
    expect(under.element.hidden).toBe(false);
    expect(beyond.element.hidden).toBe(true);
  });

  it('gives room first to the slot with the lower priority, whatever the order given', () => {
    const minor = name(1, 0, 0);
    const major = name(1, 0, 0);
    const slots = [
      { priority: 60, labels: [minor] },
      { priority: 0, labels: [major] },
    ];
    layOutSurface(slots, camera(), view);
    expect(major.element.style.transform).toBe('translate(200px, 200px) translate(-50%, -50%)');
    // Its place taken, and a line up or down touching it, the minor name goes two lines up.
    expect(minor.element.style.transform).toBe('translate(200px, 180px) translate(-50%, -50%)');
  });

  it('hides the slots from leftOut on, and those only', () => {
    const major = name(1, 0.2, 0);
    const minor = name(1, -0.2, 0);
    const slots = [
      { priority: 0, labels: [major] },
      { priority: 60, labels: [minor] },
    ];
    layOutSurface(slots, camera(), { ...view, leftOut: 60 });
    expect(major.element.hidden).toBe(false);
    expect(minor.element.hidden).toBe(true);
    layOutSurface(slots, camera(), view);
    expect(minor.element.hidden).toBe(false);
  });

  it('shows at most `most` names from each slot, the first that find room', () => {
    const states = [name(1, 0.3, 0), name(1, 0, 0), name(1, -0.3, 0)];
    const impact = name(1, 0, 0.3);
    const slots = [
      { priority: 0, labels: states },
      { priority: 40, labels: [impact] },
    ];
    expect(layOutSurface(slots, camera(), { ...view, most: 2 }).leftOut).toBe(1);
    expect(states.map(({ element }) => element.hidden)).toEqual([false, false, true]);
    expect(impact.element.hidden).toBe(false);
  });

  it('says how many names it shows, of how many the slots have', () => {
    const slots = [
      { priority: 0, labels: [name(1, 0.3, 0), name(1, 0, 0), name(-1, 0, 0)] },
      { priority: 40, labels: [name(1, 0, 0.3)] },
    ];
    expect(layOutSurface(slots, camera(), view)).toEqual({ shown: 3, total: 4, leftOut: 0 });
    expect(layOutSurface(slots, camera(), { ...view, near: false })).toEqual({
      shown: 0,
      total: 4,
      leftOut: 0,
    });
  });

  it('counts the names in view left out, and not those out of view or with no room', () => {
    const states = [name(1, 0, 0), name(1, 0, 0), name(-1, 0, 0)];
    const minor = [name(1, 0.3, 0), name(-1, 0.3, 0)];
    const slots = [
      { priority: 0, labels: states },
      { priority: 60, labels: minor },
    ];
    // Still: every name in view placed or given way for want of room, none left out.
    expect(layOutSurface(slots, camera(), view).leftOut).toBe(0);
    // Turning: one state in view past the cap, and the minor name in view.
    expect(layOutSurface(slots, camera(), { ...view, most: 1, leftOut: 60 }).leftOut).toBe(2);
  });

  it('shows none unless near', () => {
    const front = name(1, 0, 0);
    layOutSurface([{ priority: 0, labels: [front] }], camera(), { ...view, near: false });
    expect(front.element.hidden).toBe(true);
  });
});

describe('earthDisc', () => {
  it('Given a camera 3 radii out, Then the disc is centred, as wide as the angle Earth fills', () => {
    const looking = new PerspectiveCamera(40, 1, 0.1, 100);
    looking.position.set(3, 0, 0);
    looking.lookAt(0, 0, 0);
    looking.updateMatrixWorld();
    const disc = earthDisc(looking, 400, 400);
    expect(disc.x).toBeCloseTo(200);
    expect(disc.y).toBeCloseTo(200);
    // Earth fills asin(1/3) of the half-angle; on screen, tan of that over tan(20°), of 200 px.
    const expected = (Math.tan(Math.asin(1 / 3)) / Math.tan((20 * Math.PI) / 180)) * 200;
    expect(disc.radius).toBeCloseTo(expected, 0);
  });
});

describe('layOutSurface keeps moved names on Earth (#945)', () => {
  it('Given crowded counts at the limb, Then none is moved off the disc', () => {
    const looking = new PerspectiveCamera(40, 1, 0.1, 100);
    looking.position.set(8, 0, 0);
    looking.lookAt(0, 0, 0);
    looking.updateMatrixWorld();
    const view = { width: 400, height: 400, near: true, leftOut: Infinity, most: Infinity };
    // Five counts at the same point near the north limb as seen from 8 radii.
    const at = new Vector3(0.4, 0.9, 0).normalize();
    const counts = Array.from({ length: 5 }, () => ({
      element: fakeElement() as unknown as HTMLElement,
      position: at.clone(),
      width: 30,
      height: 30,
    }));
    layOutSurface([{ priority: 0, labels: counts }], looking, view);
    const disc = earthDisc(looking, 400, 400);
    const shown = counts.filter(({ element }) => element.hidden !== true);
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.length).toBeLessThan(5);
    for (const { element } of shown) {
      const [, y] =
        /translate\((-?\d+)px, (-?\d+)px\)/.exec(element.style.transform)?.slice(1).map(Number) ??
        [];
      expect(Math.abs((y ?? Infinity) - disc.y)).toBeLessThanOrEqual(disc.radius + 1);
    }
  });
});

describe('layOutSurface keeps the place’s pin clear (#955)', () => {
  const looking = new PerspectiveCamera(40, 1, 0.1, 100);
  looking.position.set(3, 0, 0);
  looking.lookAt(0, 0, 0);
  looking.updateMatrixWorld();
  const view = { width: 400, height: 400, near: true, leftOut: Infinity, most: Infinity };
  const at = new Vector3(1, 0, 0);
  const label = () => ({
    element: fakeElement() as unknown as HTMLElement,
    position: at.clone(),
    width: 40,
    height: 10,
  });

  it('Given the pin where a name would sit, Then the name moves aside, and the count leaves the pin out', () => {
    const name = label();
    const shown = layOutSurface([{ priority: 0, labels: [name] }], looking, {
      ...view,
      reserved: at.clone().multiplyScalar(1.01),
    });
    expect(name.element.style.transform).not.toBe('translate(200px, 200px) translate(-50%, -50%)');
    expect(shown.shown).toBe(1);
  });

  it('Given the pin behind Earth, Then it keeps nothing clear', () => {
    const name = label();
    layOutSurface([{ priority: 0, labels: [name] }], looking, {
      ...view,
      reserved: new Vector3(-1.01, 0, 0),
    });
    expect(name.element.style.transform).toBe('translate(200px, 200px) translate(-50%, -50%)');
  });
});
