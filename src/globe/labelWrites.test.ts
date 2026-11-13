import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { fakeElement } from '../test/fakes';
import { layOutSurface, placeLabel, roomFor, translation } from './labelWrites';
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
    expect(layOutSurface(slots, camera(), { ...view, most: 2 })).toBe(1);
    expect(states.map(({ element }) => element.hidden)).toEqual([false, false, true]);
    expect(impact.element.hidden).toBe(false);
  });

  it('counts the names in view left out, and not those out of view or with no room', () => {
    const states = [name(1, 0, 0), name(1, 0, 0), name(-1, 0, 0)];
    const minor = [name(1, 0.3, 0), name(-1, 0.3, 0)];
    const slots = [
      { priority: 0, labels: states },
      { priority: 60, labels: minor },
    ];
    // Still: every name in view placed or given way for want of room, none left out.
    expect(layOutSurface(slots, camera(), view)).toBe(0);
    // Turning: one state in view past the cap, and the minor name in view.
    expect(layOutSurface(slots, camera(), { ...view, most: 1, leftOut: 60 })).toBe(2);
  });

  it('shows none unless near', () => {
    const front = name(1, 0, 0);
    layOutSurface([{ priority: 0, labels: [front] }], camera(), { ...view, near: false });
    expect(front.element.hidden).toBe(true);
  });
});
