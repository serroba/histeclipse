// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attachFoldingSheet } from './foldingSheet';

function mounted() {
  const root = document.createElement('nav');
  const handle = document.createElement('button');
  const details = document.createElement('div');
  const control = document.createElement('input');
  root.append(handle, control, details);
  document.body.append(root);
  details.style.maxHeight = '400px';
  Object.defineProperty(details, 'scrollHeight', { value: 400 });
  vi.spyOn(details, 'getBoundingClientRect').mockImplementation(() => {
    const height =
      Number.parseFloat(details.style.height) || (root.dataset['sheet'] === 'open' ? 400 : 0);
    return new DOMRect(0, 0, 300, height);
  });
  attachFoldingSheet({ root, handle, details, storageKey: 'test.sheet', ignore: 'input, select' });
  function touch(type: string, x: number, y: number, t: number, target: HTMLElement = root) {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperties(event, {
      touches: { value: type === 'touchend' ? [] : [{ clientX: x, clientY: y }] },
      timeStamp: { value: t },
    });
    target.dispatchEvent(event);
    return event;
  }
  return { root, handle, details, control, touch };
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  document.body.replaceChildren();
  vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('sheet gestures without a browser clock or layout engine', () => {
  it('leaves taps, horizontal gestures and native controls alone, then follows a vertical drag', () => {
    const { root, details, control, touch } = mounted();
    touch('touchstart', 0, 300, 0);
    expect(touch('touchmove', 0, 293, 100).defaultPrevented).toBe(false);
    expect(touch('touchmove', 80, 250, 200).defaultPrevented).toBe(false);
    expect(root.dataset['sheet']).toBe('folded');
    touch('touchend', 80, 250, 300);
    touch('touchstart', 0, 300, 400, control);
    expect(touch('touchmove', 0, 200, 500, control).defaultPrevented).toBe(false);
    expect(root.dataset['sheet']).toBe('folded');
    touch('touchstart', 0, 300, 600);
    expect(touch('touchmove', 0, 250, 900).defaultPrevented).toBe(true);
    expect(root.dataset['sheet']).toBe('dragging');
    expect(details.style.height).toBe('50px');
  });

  it('settles a held short drag folded and a held majority-open drag open, with accessible state', () => {
    const { root, handle, touch } = mounted();
    touch('touchstart', 0, 300, 0);
    touch('touchmove', 0, 250, 500);
    touch('touchend', 0, 250, 800);
    vi.advanceTimersByTime(500);
    expect(root.dataset['sheet']).toBe('folded');
    expect(handle.getAttribute('aria-expanded')).toBe('false');
    touch('touchstart', 0, 300, 1000);
    touch('touchmove', 0, 40, 1500);
    touch('touchend', 0, 40, 1800);
    vi.advanceTimersByTime(500);
    expect(root.dataset['sheet']).toBe('open');
    expect(handle.getAttribute('aria-expanded')).toBe('true');
    expect(localStorage.getItem('test.sheet')).toBe('open');
  });

  it('keeps a downward gesture inside scrolled details as scrolling', () => {
    const { root, handle, details, touch } = mounted();
    handle.click();
    details.scrollTop = 40;
    touch('touchstart', 0, 200, 0, details);
    expect(touch('touchmove', 0, 300, 100, details).defaultPrevented).toBe(false);
    touch('touchend', 0, 300, 150, details);
    vi.advanceTimersByTime(500);
    expect(root.dataset['sheet']).toBe('open');
    expect(details.style.height).toBe('');
  });

  it('lets a reverse gesture interrupt settling without an old timer changing the final state', () => {
    const { root, details, touch } = mounted();
    touch('touchstart', 0, 300, 0);
    touch('touchmove', 0, 200, 50);
    touch('touchend', 0, 200, 60);
    touch('touchstart', 0, 200, 70);
    touch('touchmove', 0, 250, 90);
    expect(details.style.height).toBe('350px');
    touch('touchend', 0, 250, 100);
    vi.advanceTimersByTime(500);
    expect(root.dataset['sheet']).toBe('folded');
    expect(details.style.height).toBe('');
  });
});
