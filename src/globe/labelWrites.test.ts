import { describe, expect, it } from 'vitest';
import { fakeElement } from '../test/fakes';
import { placeLabel, roomFor, translation } from './labelWrites';
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
