/**
 * Zooming a time bar (#1074): − shows more time and + less, about the moment shown; a wheel or
 * a trackpad's pinch over the track does the same, and two fingers on a phone. Zooming never
 * moves time: the moment stays where it is, the bar shows more or less around it.
 *
 * Panning it (#749): a sideways scroll over the track (a trackpad's swipe, or Shift and the
 * wheel), or two fingers moved together along it, slides the window earlier or later.
 *
 * A burst of wheel, pinch or swipe events is gathered into one zoom and one pan a frame, so the
 * bar is drawn once a frame however fast they come.
 */

import { ZOOM_STEP } from '../state/timeZoom';
import { element } from './dom';
import './timeZoom.css';

/** How far a wheel's pixel zooms: about a press of + for a mouse wheel's notch or two. */
const WHEEL_RATE = 0.004;

/** The factor a wheel event zooms by: scrolling down (or pinching in) shows more time. */
export function wheelFactor(event: Pick<WheelEvent, 'deltaY' | 'deltaMode'>): number {
  // Lines (Firefox's mouse wheel) as about 16 px each; pages as a press of the button.
  const pixels =
    event.deltaMode === 1
      ? event.deltaY * 16
      : event.deltaMode === 2
        ? event.deltaY * 200
        : event.deltaY;
  return Math.exp(Math.max(-1, Math.min(1, pixels * WHEEL_RATE)));
}

export interface TimeZoom {
  /** The − and + buttons. */
  readonly root: HTMLElement;
  /**
   * Zoom by wheel and pinch over `track` too, and, given `onPan`, pan by a sideways scroll or
   * two fingers moved along it: `share` of the window, positive towards today.
   */
  attach(track: HTMLElement, onPan?: (share: number) => void): void;
  /** Whether there is room to zoom in, and out. */
  render(room: { readonly in: boolean; readonly out: boolean }): void;
}

/** Two touches' middle across the screen, px. */
function middle(touches: TouchList): number {
  const [a, b] = [touches[0], touches[1]];
  return a === undefined || b === undefined ? 0 : (a.clientX + b.clientX) / 2;
}

/** The pixels a wheel event scrolls sideways: Shift turns a wheel's turn sideways. */
export function sideways(event: Pick<WheelEvent, 'deltaX' | 'deltaY' | 'shiftKey'>): number {
  if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return event.deltaX;
  return event.shiftKey ? event.deltaY : 0;
}

/** Two touches' distance apart, px. */
function spread(touches: TouchList): number {
  const [a, b] = [touches[0], touches[1]];
  if (a === undefined || b === undefined) return 0;
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

/**
 * Listen over `track` for a wheel's zoom and a pinch's, gathered by `gather`, and, given `slide`,
 * for a sideways scroll's pan and two fingers', as a share of the track's width.
 */
function listen(
  track: HTMLElement,
  gather: (factor: number) => void,
  slide?: (share: number) => void,
): void {
  const width = (): number => Math.max(1, track.clientWidth);
  track.addEventListener(
    'wheel',
    (event) => {
      const across = sideways(event);
      if (across !== 0) {
        // A sideways scroll pans, where the bar can; else it is the page's.
        if (slide === undefined) return;
        event.preventDefault();
        slide(across / width());
        return;
      }
      event.preventDefault();
      gather(wheelFactor(event));
    },
    { passive: false },
  );
  let apart = 0;
  let at = 0;
  track.addEventListener('touchstart', (event) => {
    apart = event.touches.length === 2 ? spread(event.touches) : 0;
    at = middle(event.touches);
  });
  track.addEventListener(
    'touchmove',
    (event) => {
      if (event.touches.length !== 2 || apart === 0) return;
      event.preventDefault();
      const now = spread(event.touches);
      if (now > 0) gather(apart / now);
      apart = now;
      // Fingers moved right drag the window's earlier years into view, as a map is dragged.
      const across = middle(event.touches);
      if (slide !== undefined && across !== at) slide((at - across) / width());
      at = across;
    },
    { passive: false },
  );
}

export function createTimeZoom(
  /** Zoom by `factor`: over 1 shows more time, under 1 less. */
  onZoom: (factor: number) => void,
  schedule: (run: () => void) => void = (run) => requestAnimationFrame(run),
): TimeZoom {
  const button = (words: string, label: string, title: string): HTMLButtonElement =>
    element(
      'button',
      { type: 'button', class: 'step time-zoom-step', 'aria-label': label, title },
      words,
    );
  const out = button('−', 'Show more time', 'Zoom out: more time around the moment');
  const into = button('+', 'Show less time', 'Zoom in: less time around the moment');
  out.addEventListener('click', () => {
    onZoom(ZOOM_STEP);
  });
  into.addEventListener('click', () => {
    onZoom(1 / ZOOM_STEP);
  });
  // The zoom and the pan gathered since the last frame; 1 and 0 when none is waiting.
  let gathered = 1;
  let slid = 0;
  let waiting = false;
  let pan: ((share: number) => void) | undefined;
  function frame(): void {
    if (waiting) return;
    waiting = true;
    schedule(() => {
      const [factor, share] = [gathered, slid];
      [gathered, slid, waiting] = [1, 0, false];
      if (factor !== 1) onZoom(factor);
      if (share !== 0) pan?.(share);
    });
  }
  function gather(factor: number): void {
    gathered *= factor;
    frame();
  }
  function slide(share: number): void {
    slid += share;
    frame();
  }
  return {
    root: element(
      'span',
      { class: 'time-zoom', role: 'group', 'aria-label': 'How much time the bar shows' },
      out,
      into,
    ),
    attach(track, onPan) {
      pan = onPan;
      listen(track, gather, onPan === undefined ? undefined : slide);
    },
    render(room) {
      into.disabled = !room.in;
      out.disabled = !room.out;
    },
  };
}
