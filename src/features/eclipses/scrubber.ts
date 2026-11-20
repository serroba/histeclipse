/**
 * Time within an eclipse: drag to move the shadow, or play it. Covers ±3 hours around greatest
 * eclipse, in one-minute steps, with 44 px controls. Built from the shared transport, so Space
 * plays or pauses it and the arrows step a minute (`ui/transport.ts`).
 */

import { fromGreatest } from '../../eclipses/describe';
import { element } from '../../ui/dom';
import { createTransport } from '../../ui/transport';
import './scrubber.css';

interface ScrubberView {
  /** Minutes from greatest eclipse. */
  readonly offsetMinutes: number;
  /** "18:42 UT" */
  readonly timeLabel: string;
}

export interface Scrubber {
  readonly root: HTMLElement;
  render(view: ScrubberView | null): void;
}

export const SCRUB_RANGE_MINUTES = 180;
/** Simulated minutes per real second it can play at: the six hours in two minutes to six seconds. */
const ECLIPSE_SPEEDS = [3, 12, 30, 60] as const;
const DEFAULT_SPEED = 12;

export function createScrubber(onScrub: (offsetMinutes: number) => void): Scrubber {
  const transport = createTransport(
    {
      play: { className: 'scrubber-play' },
      slider: {
        class: 'scrubber-range',
        min: String(-SCRUB_RANGE_MINUTES),
        max: String(SCRUB_RANGE_MINUTES),
        step: '1',
        'aria-label': 'Time relative to greatest eclipse',
      },
    },
    {
      onPlay(play) {
        if (play) start();
        else stop();
      },
      onSlide(minutes) {
        stop();
        onScrub(minutes);
      },
    },
  );
  const { play, slider } = transport;
  const label = element('output', { class: 'scrubber-time' });
  const speed = element(
    'select',
    { class: 'scrubber-speed', 'aria-label': 'Speed' },
    ...ECLIPSE_SPEEDS.map((each) =>
      element('option', { value: String(each) }, `${String(each)} min/s`),
    ),
  );
  speed.value = String(DEFAULT_SPEED);
  const root = element('div', { class: 'scrubber', hidden: '' }, play, slider, label, speed);
  transport.join(root);

  let offset = 0;
  let playing: { frame: number; last: number } | null = null;

  function stop(): void {
    if (playing !== null) cancelAnimationFrame(playing.frame);
    playing = null;
    transport.render(false);
  }

  function start(): void {
    if (offset >= SCRUB_RANGE_MINUTES) onScrub(-SCRUB_RANGE_MINUTES);
    transport.render(true);
    playing = { frame: requestAnimationFrame(tick), last: performance.now() };
  }

  function tick(now: number): void {
    if (playing === null) return;
    const elapsed = (now - playing.last) / 1000;
    const minutesPerSecond = Number(speed.value);
    if (elapsed * minutesPerSecond >= 1) {
      playing.last = now;
      const next = offset + Math.round(elapsed * minutesPerSecond);
      if (next > SCRUB_RANGE_MINUTES) {
        stop();
        return;
      }
      onScrub(next);
    }
    playing.frame = requestAnimationFrame(tick);
  }

  return {
    root,
    render(view) {
      if (view === null) {
        stop();
        root.hidden = true;
        return;
      }
      root.hidden = false;
      offset = view.offsetMinutes;
      transport.render(playing !== null, view.offsetMinutes);
      label.textContent = `${view.timeLabel}, ${fromGreatest(view.offsetMinutes)}`;
    },
  };
}
