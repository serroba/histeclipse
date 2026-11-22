/**
 * Zooming a time bar (#1074): − shows more time and + less, about the moment shown; a wheel or
 * a trackpad's pinch over the track does the same, and two fingers on a phone. Zooming never
 * moves time: the moment stays where it is, the bar shows more or less around it.
 *
 * A burst of wheel or pinch events is gathered into one zoom a frame, so the bar is drawn once
 * a frame however fast they come.
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
  /** Zoom by wheel and pinch over `track` too. */
  attach(track: HTMLElement): void;
  /** Whether there is room to zoom in, and out. */
  render(room: { readonly in: boolean; readonly out: boolean }): void;
}

/** Two touches' distance apart, px. */
function spread(touches: TouchList): number {
  const [a, b] = [touches[0], touches[1]];
  if (a === undefined || b === undefined) return 0;
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
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
  // The zoom gathered since the last frame; 1 when none is waiting.
  let gathered = 1;
  function gather(factor: number): void {
    const waiting = gathered !== 1;
    gathered *= factor;
    if (waiting) return;
    schedule(() => {
      const factor = gathered;
      gathered = 1;
      if (factor !== 1) onZoom(factor);
    });
  }
  return {
    root: element(
      'span',
      { class: 'time-zoom', role: 'group', 'aria-label': 'How much time the bar shows' },
      out,
      into,
    ),
    attach(track) {
      track.addEventListener(
        'wheel',
        (event) => {
          // Sideways scrolling is the trackpad's, not a zoom.
          if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
          event.preventDefault();
          gather(wheelFactor(event));
        },
        { passive: false },
      );
      let apart = 0;
      track.addEventListener('touchstart', (event) => {
        apart = event.touches.length === 2 ? spread(event.touches) : 0;
      });
      track.addEventListener(
        'touchmove',
        (event) => {
          if (event.touches.length !== 2 || apart === 0) return;
          event.preventDefault();
          const now = spread(event.touches);
          if (now > 0) gather(apart / now);
          apart = now;
        },
        { passive: false },
      );
    },
    render(room) {
      into.disabled = !room.in;
      out.disabled = !room.out;
    },
  };
}
