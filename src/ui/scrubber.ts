/**
 * Time within an eclipse: drag to move the shadow, or play it. Covers ±3 hours around greatest
 * eclipse, in one-minute steps, with 44 px controls.
 */

import { element } from './dom';

export interface ScrubberView {
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
/** Simulated minutes per real second while playing. */
const PLAY_SPEED = 12;

export function createScrubber(onScrub: (offsetMinutes: number) => void): Scrubber {
  const slider = element('input', {
    type: 'range',
    class: 'scrubber-range',
    min: String(-SCRUB_RANGE_MINUTES),
    max: String(SCRUB_RANGE_MINUTES),
    step: '1',
    'aria-label': 'Time relative to greatest eclipse',
  });
  const label = element('output', { class: 'scrubber-time' });
  const play = element(
    'button',
    { type: 'button', class: 'scrubber-play', 'aria-label': 'Play' },
    '▶',
  );
  const root = element('div', { class: 'scrubber', hidden: '' }, play, slider, label);

  let offset = 0;
  let playing: { frame: number; last: number } | null = null;

  function stop(): void {
    if (playing !== null) cancelAnimationFrame(playing.frame);
    playing = null;
    play.textContent = '▶';
    play.setAttribute('aria-label', 'Play');
  }

  function tick(now: number): void {
    if (playing === null) return;
    const elapsed = (now - playing.last) / 1000;
    if (elapsed * PLAY_SPEED >= 1) {
      playing.last = now;
      const next = offset + Math.round(elapsed * PLAY_SPEED);
      if (next > SCRUB_RANGE_MINUTES) {
        stop();
        return;
      }
      onScrub(next);
    }
    playing.frame = requestAnimationFrame(tick);
  }

  slider.addEventListener('input', () => {
    stop();
    onScrub(Number(slider.value));
  });
  play.addEventListener('click', () => {
    if (playing !== null) {
      stop();
      return;
    }
    if (offset >= SCRUB_RANGE_MINUTES) onScrub(-SCRUB_RANGE_MINUTES);
    play.textContent = '❚❚';
    play.setAttribute('aria-label', 'Pause');
    playing = { frame: requestAnimationFrame(tick), last: performance.now() };
  });

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
      slider.value = String(view.offsetMinutes);
      const sign = view.offsetMinutes < 0 ? '−' : '+';
      label.textContent = `${view.timeLabel} (${sign}${String(Math.abs(view.offsetMinutes))} min)`;
    },
  };
}
