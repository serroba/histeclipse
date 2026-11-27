/**
 * The column of small panels beside the globe (#722, #526): bottom left, between the page's
 * panels as the globe is. A layer's panel joins it, in its `order`, so two layers on at once
 * stack rather than overlap. A grip at its top moves the column out of the globe's way (#811):
 * dragged by a finger or a mouse, or with the arrow keys; it stays on the screen. A tap on the
 * grip, or Enter, folds the whole column away to the grip, so the globe shows, and unfolds it
 * (#1279). Each panel folds to its name, and unfolds, by a button at its corner; this browser
 * remembers which are folded.
 */

import { element } from './dom';
import './globePanels.css';

/** Pixels an arrow key moves the column. */
const KEY_STEP = 24;

/** Pixels a pointer may move on the grip and still be a tap, which folds, not a drag. */
const TAP_SLOP = 6;

export interface Offset {
  readonly x: number;
  readonly y: number;
}

/** A box's edges, as `getBoundingClientRect` gives them. */
export interface Edges {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/**
 * The offset nearest `wanted` that keeps the column on the screen: `box` is where it is drawn
 * now, moved by `now`, on a screen `width` by `height`.
 */
export function keptOnScreen(
  wanted: Offset,
  now: Offset,
  box: Edges,
  width: number,
  height: number,
): Offset {
  const within = (value: number, low: number, high: number): number =>
    Math.min(Math.max(value, Math.min(low, high)), Math.max(low, high));
  return {
    x: within(wanted.x, now.x - box.left, now.x + width - box.right),
    y: within(wanted.y, now.y - box.top, now.y + height - box.bottom),
  };
}

const ARROWS: Readonly<Record<string, Offset>> = {
  ArrowLeft: { x: -KEY_STEP, y: 0 },
  ArrowRight: { x: KEY_STEP, y: 0 },
  ArrowUp: { x: 0, y: -KEY_STEP },
  ArrowDown: { x: 0, y: KEY_STEP },
};

/** The grip's names: what it does, folded or not. */
const GRIP_LABEL = {
  open: 'Move the panels, or tap to fold them away',
  folded: 'Move the panels, or tap to show them',
} as const;

/** Fold the column away to its grip, or show it again (#1279). */
function foldColumn(column: HTMLElement, handle: HTMLElement, folded: boolean): void {
  column.classList.toggle('is-folded', folded);
  handle.setAttribute('aria-expanded', String(!folded));
  handle.setAttribute('aria-label', folded ? GRIP_LABEL.folded : GRIP_LABEL.open);
}

/** The grip that moves `column`, and folds it when tapped. */
function grip(column: HTMLElement): HTMLElement {
  const handle = element(
    'button',
    { type: 'button', class: 'globe-panels-grip' },
    element('span', { class: 'globe-panels-bar' }),
    element('span', { class: 'globe-panels-show' }, 'Show panels'),
  );
  foldColumn(column, handle, false);
  let at: Offset = { x: 0, y: 0 };
  let held: { readonly pointer: Offset; readonly from: Offset } | null = null;
  // Whether the pointer moved past a tap's slop since it went down: a drag, which does not fold.
  let dragged = false;
  const move = (wanted: Offset): void => {
    at = keptOnScreen(
      wanted,
      at,
      column.getBoundingClientRect(),
      window.innerWidth,
      window.innerHeight,
    );
    column.style.translate = `${String(at.x)}px ${String(at.y)}px`;
  };
  handle.addEventListener('pointerdown', (event) => {
    held = { pointer: { x: event.clientX, y: event.clientY }, from: at };
    dragged = false;
    handle.setPointerCapture(event.pointerId);
  });
  handle.addEventListener('pointermove', (event) => {
    if (held === null) return;
    const by = { x: event.clientX - held.pointer.x, y: event.clientY - held.pointer.y };
    if (Math.hypot(by.x, by.y) > TAP_SLOP) dragged = true;
    move({ x: held.from.x + by.x, y: held.from.y + by.y });
  });
  const letGo = (): void => {
    held = null;
  };
  handle.addEventListener('pointerup', letGo);
  handle.addEventListener('pointercancel', letGo);
  // A tap, or Enter or Space: fold or unfold. The click that ends a drag does neither.
  handle.addEventListener('click', () => {
    if (dragged) {
      dragged = false;
      return;
    }
    foldColumn(column, handle, !column.classList.contains('is-folded'));
  });
  handle.addEventListener('keydown', (event) => {
    const step = ARROWS[event.key];
    if (step === undefined) return;
    event.preventDefault();
    move({ x: at.x + step.x, y: at.y + step.y });
  });
  return handle;
}

/** Where this browser keeps which panels are folded, by their names. */
const FOLDED_KEY = 'histeclipse.globePanels.folded';

/** The panels folded in this browser; none where storage cannot be read. */
function foldedNames(storage: Pick<Storage, 'getItem'> | null): Set<string> {
  try {
    const raw = storage?.getItem(FOLDED_KEY) ?? null;
    const list: unknown = raw === null ? [] : JSON.parse(raw);
    return new Set(Array.isArray(list) ? list.filter((each) => typeof each === 'string') : []);
  } catch {
    return new Set();
  }
}

function keepFolded(storage: Pick<Storage, 'setItem'> | null, names: ReadonlySet<string>): void {
  try {
    storage?.setItem(FOLDED_KEY, JSON.stringify([...names]));
  } catch {
    // Without storage the fold lasts until the page is left.
  }
}

/** This page's storage, or none where reading it throws (a private window, blocked data). */
function pageStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * A button at `panel`'s corner that folds it to its name, and unfolds it: a panel's name is
 * its `aria-label`. Folded, the panel shows only the button, with the name on it.
 */
export function foldable(panel: HTMLElement, storage: Storage | null = pageStorage()): void {
  const name = panel.getAttribute('aria-label') ?? 'Panel';
  const label = element('span', { class: 'globe-panel-name' }, name);
  const button = element(
    'button',
    { type: 'button', class: 'globe-panel-fold', 'aria-expanded': 'true' },
    label,
    element('span', { class: 'globe-panel-chevron', 'aria-hidden': 'true' }),
  );
  const show = (folded: boolean): void => {
    panel.classList.toggle('is-folded', folded);
    button.setAttribute('aria-expanded', String(!folded));
    button.setAttribute('aria-label', `${folded ? 'Unfold' : 'Fold'} ${name}`);
  };
  show(foldedNames(storage).has(name));
  button.addEventListener('click', () => {
    const folded = !panel.classList.contains('is-folded');
    show(folded);
    const names = foldedNames(storage);
    if (folded) names.add(name);
    else names.delete(name);
    keepFolded(storage, names);
  });
  panel.prepend(button);
}

/** Put `panel` in the column inside `container` (made the first time), at `order`. */
export function joinGlobePanels(container: HTMLElement, panel: HTMLElement, order: number): void {
  let list = container.querySelector<HTMLElement>(':scope > .globe-panels > .globe-panels-list');
  if (list === null) {
    // The grip is outside the list, which scrolls when the panels are taller than their room.
    list = element('div', { class: 'globe-panels-list' });
    const column = element('div', { class: 'globe-panels' });
    column.append(grip(column), list);
    container.append(column);
  }
  panel.style.order = String(order);
  foldable(panel);
  list.append(panel);
}
