/**
 * The zoom rail's named stops (#980): a button for each, at its place on the track, and the one
 * the view has reached marked. On a short track two stops can lie closer than a label is tall
 * ("Planets" and "Saturn" overlapped on a 390 × 664 phone), so their labels are spread apart,
 * each kept as near its own place as the room allows.
 */

import { element } from './dom';

/** A stop as the rail gives it: its distance and words, and its place along the track (0–1). */
export interface PlacedStop {
  readonly distance: number;
  readonly label: string;
  readonly title: string;
  readonly at: number;
}

/** A label's height on the track, px: no two are nearer than this. */
const LABEL_GAP = 28;

/**
 * Tops (px, nearest first, in order) spread so that no two are nearer than `gap`, within
 * `height`: pushed down where crowded, then back up from the bottom where that ran over.
 */
export function spreadTops(tops: readonly number[], gap: number, height: number): number[] {
  let above = -Infinity;
  const down = tops.map((top) => (above = Math.max(top, above + gap)));
  let below = height + gap;
  return down
    .reverse()
    .map((top) => (below = Math.max(0, Math.min(top, below - gap))))
    .reverse();
}

export interface ZoomStops {
  /** Draw these stops, for the body in focus. */
  place(stops: readonly PlacedStop[]): void;
  /** Mark the stop the view is at, or has passed on the way out. */
  mark(distance: number): void;
}

export function createZoomStops(track: HTMLElement, onZoom: (distance: number) => void): ZoomStops {
  let shown: { readonly stop: PlacedStop; readonly button: HTMLButtonElement }[] = [];
  /** Lay the labels out for the track's height: spread where they would overlap. */
  function layOut(): void {
    const height = track.clientHeight;
    // Unmeasured (not yet laid out), each at its share of the track.
    const tops =
      height > 0
        ? spreadTops(
            shown.map(({ stop }) => stop.at * height),
            LABEL_GAP,
            height,
          )
        : [];
    // Too short a track for every name apart, or none at all: the names fade, still there for
    // a screen reader (on a touch screen they are labels, not targets); the buttons stay.
    track.toggleAttribute('data-crowded', height < LABEL_GAP * shown.length);
    for (const [k, { stop, button }] of shown.entries()) {
      const top = tops.at(k);
      button.style.top = top === undefined ? `${String(stop.at * 100)}%` : `${String(top)}px`;
    }
  }
  new ResizeObserver(layOut).observe(track);
  return {
    place(stops) {
      for (const { button } of shown) button.remove();
      shown = stops.map((stop) => {
        const button = element(
          'button',
          {
            type: 'button',
            class: 'zoom-stop',
            title: stop.title,
            'aria-label': `Zoom to ${stop.title}`,
          },
          stop.label,
        );
        button.addEventListener('click', () => {
          onZoom(stop.distance);
        });
        track.append(button);
        return { stop, button };
      });
      layOut();
    },
    mark(distance) {
      const reached = shown.filter(({ stop }) => distance >= stop.distance * 0.7).at(-1);
      for (const entry of shown)
        entry.button.setAttribute('aria-pressed', String(entry === reached));
    },
  };
}
