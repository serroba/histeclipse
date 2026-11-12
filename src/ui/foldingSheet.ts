/**
 * A bar whose details fold away under a handle, open or folded as the reader last left it (at
 * first folded on a phone, open elsewhere). The details follow a finger dragged up or down the
 * bar, and settle open or folded when it lifts: by a flick's direction, else by whether they are
 * more than half open. Not on the controls, whose own drags are left alone; and a drag down
 * inside the details scrolls them until they are at their top. A mouse can drag the handle the
 * same way; a click on it still toggles.
 *
 * The bar's `data-sheet` says `open`, `folded` or `dragging`, for its CSS.
 */

/** Pixels a finger moves before a drag counts, so taps stay taps. */
const DRAG_SLOP = 8;
/** A release faster than this, in pixels a millisecond, settles the way it was going. */
const FLICK = 0.5;
const SETTLE_MS = 200;
/** A gesture shorter than this is a flick, judged by its whole length and time. */
const FLICK_MS = 250;
/** Held still this long before lifting, the finger has no speed left. */
const STILL_MS = 100;

export interface FoldingSheetParts {
  /** The whole bar: a finger drags anywhere on it. */
  readonly root: HTMLElement;
  /** The button that folds and opens the details. */
  readonly handle: HTMLElement;
  /** What folds away. */
  readonly details: HTMLElement;
  /** Where the reader's choice is kept between visits. */
  readonly storageKey: string;
  /** Drags that start on these (a CSS selector) are theirs, not the sheet's. */
  readonly ignore: string;
}

/** A finger or mouse moving the details. */
export interface Drag {
  readonly x: number;
  readonly y: number;
  readonly t: number;
  readonly scrolled: number;
  /** Set once the move is a drag: the details' height then, and opened in full. */
  from: number | null;
  full: number;
  last: { readonly y: number; readonly t: number };
  speed: number;
}

/**
 * Whether the details settle open when a drag ends at `t` with them `height` tall: by the
 * speed of a flick (a short gesture's whole, or a longer one's last), else whether more than
 * half open. A finger held still before lifting has no speed left.
 */
export function settlesOpen(drag: Drag, t: number, height: number): boolean {
  const speed =
    t - drag.t < FLICK_MS
      ? (drag.last.y - drag.y) / Math.max(1, drag.last.t - drag.t)
      : t - drag.last.t > STILL_MS
        ? 0
        : drag.speed;
  return speed < -FLICK ? true : speed > FLICK ? false : height > drag.full / 2;
}

function remembered(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function keep(key: string, open: boolean): void {
  try {
    localStorage.setItem(key, open ? 'open' : 'folded');
  } catch {
    // Not kept, as in a private window: the sheet still works.
  }
}

/**
 * Measure once, as a drag starts: how tall the details are now, and opened in full (up to their
 * limit, read once the bar is marked as dragging).
 */
function measure(
  root: HTMLElement,
  details: HTMLElement,
  open: boolean,
): { from: number; full: number } {
  const from = open ? details.getBoundingClientRect().height : 0;
  root.dataset['sheet'] = 'dragging';
  details.style.height = 'auto';
  const limit = Number.parseFloat(getComputedStyle(details).maxHeight);
  return { from, full: Math.min(details.scrollHeight, Number.isFinite(limit) ? limit : Infinity) };
}

interface Gestures {
  begin(x: number, y: number, t: number): void;
  /** Whether the move is now a drag of the sheet. */
  follow(x: number, y: number, t: number): boolean;
  release(t: number): void;
  /** Not a drag of the sheet after all. */
  cancel(): void;
}

/** Fold and open the details by their handle, and by dragging the bar. */
export function attachFoldingSheet(parts: FoldingSheetParts): void {
  const { root, handle, details, storageKey } = parts;
  let open =
    (remembered(storageKey) ??
      (window.matchMedia('(max-width: 600px)').matches ? 'folded' : 'open')) === 'open';
  function setOpen(value: boolean, kept = true): void {
    if (kept) keep(storageKey, value);
    open = value;
    root.dataset['sheet'] = value ? 'open' : 'folded';
    handle.setAttribute('aria-expanded', String(value));
    handle.setAttribute('aria-label', value ? 'Hide the details' : 'Show the details');
  }
  setOpen(open, false);
  let drag: Drag | null = null;
  // A settle under way, finished at once if a new drag starts before it lands: else the new
  // drag would start from the state before it, and the old settle land after the new one.
  let settling: { readonly timer: number; readonly opening: boolean } | null = null;
  function landSettle(): void {
    if (settling === null) return;
    window.clearTimeout(settling.timer);
    details.style.transition = '';
    details.style.height = '';
    setOpen(settling.opening);
    settling = null;
  }
  handle.addEventListener('click', () => {
    landSettle();
    setOpen(!open);
  });
  const gestures: Gestures = {
    begin(x, y, t) {
      drag = {
        x,
        y,
        t,
        scrolled: details.scrollTop,
        from: null,
        full: 0,
        last: { y, t },
        speed: 0,
      };
    },
    follow(x, y, t) {
      const now = drag;
      if (now === null) return false;
      const dy = y - now.y;
      if (now.from === null) {
        if (Math.abs(dy) < DRAG_SLOP || Math.abs(dy) < Math.abs(x - now.x)) return false;
        // Down inside details scrolled away from their top is a scroll, not a fold.
        if (dy > 0 && now.scrolled > 0) {
          drag = null;
          return false;
        }
        landSettle();
        Object.assign(now, measure(root, details, open));
      }
      const height = Math.min(now.full, Math.max(0, (now.from ?? 0) - dy));
      details.style.height = `${String(height)}px`;
      const elapsed = t - now.last.t;
      if (elapsed > 0) now.speed = (y - now.last.y) / elapsed;
      now.last = { y, t };
      return true;
    },
    release(t) {
      const now = drag;
      drag = null;
      // A tap, not a drag: the handle's click, or nothing.
      if (now === null) return;
      if (now.from === null) return;
      const opening = settlesOpen(now, t, details.getBoundingClientRect().height);
      details.style.transition = `height ${String(SETTLE_MS)}ms ease-out`;
      details.style.height = `${String(opening ? now.full : 0)}px`;
      settling = { timer: window.setTimeout(landSettle, SETTLE_MS), opening };
    },
    cancel() {
      drag = null;
    },
  };
  listenForTouches(root, parts.ignore, gestures);
  listenForMouse(handle, gestures);
}

/** A finger anywhere on the bar, but on the controls, drags the details. */
function listenForTouches(root: HTMLElement, ignore: string, gestures: Gestures): void {
  root.addEventListener(
    'touchstart',
    (event) => {
      const touch = event.touches[0];
      const target = event.target instanceof Element ? event.target : null;
      if (
        event.touches.length === 1 &&
        touch !== undefined &&
        (target?.closest(ignore) ?? null) === null
      ) {
        gestures.begin(touch.clientX, touch.clientY, event.timeStamp);
      } else gestures.cancel();
    },
    { passive: true },
  );
  root.addEventListener(
    'touchmove',
    (event) => {
      const touch = event.touches[0];
      if (touch === undefined) return;
      // Once it is a drag, the sheet moves and the page and the details stay put.
      if (gestures.follow(touch.clientX, touch.clientY, event.timeStamp) && event.cancelable) {
        event.preventDefault();
      }
    },
    { passive: false },
  );
  for (const type of ['touchend', 'touchcancel'] as const) {
    root.addEventListener(
      type,
      (event) => {
        gestures.release(event.timeStamp);
      },
      { passive: true },
    );
  }
}

/** A mouse drags by the handle; a click on it still toggles. */
function listenForMouse(handle: HTMLElement, gestures: Gestures): void {
  let dragged = false;
  handle.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'mouse') return;
    dragged = false;
    handle.setPointerCapture(event.pointerId);
    gestures.begin(event.clientX, event.clientY, event.timeStamp);
  });
  handle.addEventListener('pointermove', (event) => {
    if (
      event.pointerType === 'mouse' &&
      gestures.follow(event.clientX, event.clientY, event.timeStamp)
    ) {
      dragged = true;
    }
  });
  handle.addEventListener('pointerup', (event) => {
    if (event.pointerType === 'mouse') gestures.release(event.timeStamp);
  });
  handle.addEventListener(
    'click',
    (event) => {
      // The click that ends a mouse drag is not a tap.
      if (dragged) event.stopImmediatePropagation();
      dragged = false;
    },
    { capture: true },
  );
}
