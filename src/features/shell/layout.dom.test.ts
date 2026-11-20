// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { keepCentred } from './layout';

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

function boxed(element: Element, box: Box): void {
  const rect = {
    ...box,
    right: box.left + box.width,
    bottom: box.top + box.height,
    x: box.left,
    y: box.top,
  };
  element.getBoundingClientRect = () => ({ ...rect, toJSON: () => rect });
}

let observed: (() => void) | null = null;

beforeEach(() => {
  observed = null;
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        observed = callback;
      }
      observe = vi.fn();
    },
  );
  Object.defineProperty(window, 'innerWidth', { value: 1440, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: 900, configurable: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** A page: the date panel at the top left, and the bottom's cards. */
function page(options: { hud: Box; natural: number; cards: { box: Box; deep?: boolean }[] }) {
  const root = document.createElement('div');
  const top = document.createElement('div');
  const bottom = document.createElement('div');
  const zoomRail = document.createElement('div');
  boxed(top, options.hud);
  Object.defineProperty(top, 'scrollHeight', { value: options.natural });
  const lowest = Math.min(...options.cards.map(({ box }) => box.top), 900);
  boxed(bottom, { top: lowest, left: 0, width: 1440, height: 900 - lowest });
  for (const { box, deep } of options.cards) {
    const card = document.createElement('div');
    if (deep === true) card.className = 'deep-time';
    boxed(card, box);
    bottom.append(card);
  }
  const onInsets = vi.fn();
  keepCentred({ root, top, bottom, zoomRail, onInsets });
  observed?.();
  return { root, top, zoomRail, onInsets };
}

const HUD = { top: 16, left: 16, width: 540, height: 700 };
const CARD = { top: 360, left: 340, width: 760, height: 540 };

describe('keeping the globe centred, and the panels clear of each other', () => {
  it('Given the date panel, Then it gets its fold, for a short phone to keep the globe in view (#975)', () => {
    const { top } = page({ hud: HUD, natural: 700, cards: [] });
    expect(top.dataset['fold']).toBe('folded');
    expect(top.querySelector('.hud-fold')).not.toBeNull();
  });

  it('Given a date panel taller than the room above the eclipse card in its columns, Then it stops short of the card and scrolls (#943)', () => {
    const { root } = page({ hud: HUD, natural: 700, cards: [{ box: CARD }] });
    expect(root.hasAttribute('data-hud-capped')).toBe(true);
    expect(root.style.getPropertyValue('--hud-max')).toBe(`${String(360 - 16 - 8)}px`);
  });

  it('Given a date panel that fits above the card, Then it keeps its height', () => {
    const { root } = page({ hud: { ...HUD, height: 300 }, natural: 300, cards: [{ box: CARD }] });
    expect(root.hasAttribute('data-hud-capped')).toBe(false);
    expect(root.style.getPropertyValue('--hud-max')).toBe('none');
  });

  it('Given cards only beside the date panel, Then nothing caps it', () => {
    const { root } = page({
      hud: HUD,
      natural: 700,
      cards: [{ box: { ...CARD, left: 700 } }],
    });
    expect(root.hasAttribute('data-hud-capped')).toBe(false);
  });

  it('Given deep time’s sheet under the date panel, Then the sheet gives way to it, not the panel to the sheet', () => {
    const { root } = page({
      hud: { ...HUD, height: 400 },
      natural: 700,
      cards: [{ box: CARD, deep: true }],
    });
    expect(root.style.getPropertyValue('--hud-clear')).toBe(`${String(16 + 400 + 8)}px`);
    expect(root.hasAttribute('data-hud-capped')).toBe(false);
  });

  it('Given a short, narrow date panel, Then only the bottom panel takes from the globe’s space', () => {
    const { root, onInsets, zoomRail } = page({
      hud: { ...HUD, height: 100 },
      natural: 100,
      cards: [{ box: CARD }],
    });
    expect(onInsets).toHaveBeenCalledWith(0, 540, 0);
    expect(root.style.getPropertyValue('--free-bottom')).toBe('540px');
    expect(root.style.getPropertyValue('--hud-bottom')).toBe('116px');
    expect(zoomRail.classList.contains('is-cramped')).toBe(false);
  });

  it('Given a date panel across the width (a phone), Then it takes from the top too, and a cramped rail says so', () => {
    const { onInsets, zoomRail } = page({
      hud: { top: 16, left: 16, width: 1400, height: 300 },
      natural: 300,
      cards: [{ box: { ...CARD, top: 500, height: 400 } }],
    });
    expect(onInsets).toHaveBeenCalledWith(316, 400, 0);
    expect(zoomRail.classList.contains('is-cramped')).toBe(false);
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
    window.dispatchEvent(new Event('resize'));
    expect(zoomRail.classList.contains('is-cramped')).toBe(true);
  });

  it('Given a narrow date panel reaching past the middle of the free height, Then the globe moves over to its right (#946)', () => {
    const { root, onInsets } = page({
      hud: { ...HUD, height: 300 },
      natural: 300,
      cards: [{ box: { ...CARD, top: 560, height: 340 } }],
    });
    // Free height 0–560, its middle 280; the panel reaches 316.
    expect(onInsets).toHaveBeenCalledWith(0, 340, 16 + 540);
    expect(root.style.getPropertyValue('--free-left')).toBe('556px');
  });
});
