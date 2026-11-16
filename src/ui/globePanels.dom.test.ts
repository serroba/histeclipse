// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

import { joinGlobePanels, keptOnScreen } from './globePanels';

function column(): { readonly column: HTMLElement; readonly grip: HTMLElement } {
  const container = document.createElement('div');
  document.body.append(container);
  joinGlobePanels(container, document.createElement('section'), 1);
  const made = container.querySelector<HTMLElement>('.globe-panels');
  const grip = made?.querySelector<HTMLElement>('.globe-panels-grip');
  if (made === null || grip === null || grip === undefined) throw new Error('no column');
  made.getBoundingClientRect = () => new DOMRect(16, 400, 300, 200);
  return { column: made, grip };
}

function pointer(type: string, x: number, y: number): Event {
  return Object.assign(new Event(type), { clientX: x, clientY: y, pointerId: 1 });
}

describe('the panels beside the globe', () => {
  it('Given two panels, Then they share one column under one grip, each in its order', () => {
    const container = document.createElement('div');
    const first = document.createElement('section');
    const second = document.createElement('section');
    joinGlobePanels(container, first, 2);
    joinGlobePanels(container, second, 1);
    const columns = container.querySelectorAll('.globe-panels');
    expect(columns).toHaveLength(1);
    const [grip, list] = [...(columns[0]?.children ?? [])];
    expect(grip?.getAttribute('aria-label')).toBe('Move the panels');
    expect([...(list?.children ?? [])]).toEqual([first, second]);
    expect([first.style.order, second.style.order]).toEqual(['2', '1']);
  });

  it('When the grip is dragged, Then the column follows, and stays once let go', () => {
    const { column: made, grip } = column();
    grip.setPointerCapture = () => undefined;
    grip.dispatchEvent(pointer('pointermove', 500, 500));
    expect(made.style.translate).toBe('');
    grip.dispatchEvent(pointer('pointerdown', 100, 400));
    grip.dispatchEvent(pointer('pointermove', 140, 300));
    expect(made.style.translate).toBe('40px -100px');
    grip.dispatchEvent(pointer('pointerup', 140, 300));
    grip.dispatchEvent(pointer('pointermove', 300, 300));
    expect(made.style.translate).toBe('40px -100px');
  });

  it('When an arrow key is pressed on the grip, Then the column moves a step', () => {
    const { column: made, grip } = column();
    const press = (key: string): KeyboardEvent => {
      const event = new KeyboardEvent('keydown', { key, cancelable: true });
      grip.dispatchEvent(event);
      return event;
    };
    expect(press('ArrowRight').defaultPrevented).toBe(true);
    press('ArrowUp');
    expect(made.style.translate).toBe('24px -24px');
    expect(press('Enter').defaultPrevented).toBe(false);
    expect(made.style.translate).toBe('24px -24px');
  });
});

describe('a column kept on the screen', () => {
  const box = { left: 16, top: 400, right: 316, bottom: 600 };
  const none = { x: 0, y: 0 };
  it('moves freely inside it', () => {
    expect(keptOnScreen({ x: 50, y: -100 }, none, box, 800, 700)).toEqual({ x: 50, y: -100 });
  });
  it('stops at each edge', () => {
    expect(keptOnScreen({ x: -99, y: -999 }, none, box, 800, 700)).toEqual({ x: -16, y: -400 });
    expect(keptOnScreen({ x: 999, y: 999 }, none, box, 800, 700)).toEqual({ x: 484, y: 100 });
  });
  it('reckons from where it has already been moved to', () => {
    const moved = { left: 116, top: 300, right: 416, bottom: 500 };
    expect(keptOnScreen({ x: -999, y: 0 }, { x: 100, y: -100 }, moved, 800, 700)).toEqual({
      x: -16,
      y: 0,
    });
  });
  it('holds still on a screen smaller than the column', () => {
    expect(keptOnScreen({ x: 50, y: 0 }, none, box, 200, 700).x).toBe(-16);
  });
});
