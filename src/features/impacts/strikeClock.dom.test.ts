// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CLOCK_END, positionAt } from '../../deepTime/strikeClock';
import { createStrikeClock } from './strikeClock';
import type { StrikePhase } from './strikePhases';

const PHASES: readonly StrikePhase[] = [
  { id: 'approach', from: -100, title: 'Coming in', text: 'It comes in.', sources: [] },
  {
    id: 'fireball',
    from: 0,
    title: 'The fireball',
    text: 'It strikes.',
    sources: [
      { name: 'Study A', url: 'https://doi.org/10.1/a' },
      { name: 'Study B', url: 'https://doi.org/10.1/b' },
    ],
  },
  { id: 'veil', from: 3600, title: 'The veil', text: 'It darkens.', sources: [] },
];

let frames: ((now: number) => void)[] = [];

beforeEach(() => {
  frames = [];
  vi.stubGlobal('requestAnimationFrame', (callback: (now: number) => void) => {
    frames.push(callback);
    return frames.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

/** Run the frame asked for, at `now` ms. */
function frame(now: number): void {
  const next = frames.shift();
  next?.(now);
}

function clock() {
  const onMoment = vi.fn();
  const onClose = vi.fn();
  const made = createStrikeClock({
    title: 'Chicxulub, in its own time',
    phases: PHASES,
    onMoment,
    onClose,
  });
  document.body.append(made.root);
  const slider = made.root.querySelector<HTMLInputElement>('.strike-clock-range');
  const play = made.root.querySelector<HTMLButtonElement>('.strike-clock-play');
  if (slider === null || play === null) throw new Error('no transport');
  return { made, slider, play, onMoment, onClose };
}

describe('the strike clock’s panel (#1173)', () => {
  it('opens at the approach, playing, and says what is coming', () => {
    const { made, onMoment } = clock();
    expect(made.isOpen()).toBe(false);
    made.open();
    expect(made.isOpen()).toBe(true);
    expect(made.root.dataset['playing']).toBe('true');
    expect(made.root.dataset['phase']).toBe('approach');
    expect(made.root.querySelector('.strike-clock-when')?.textContent).toBe('10 seconds before');
    expect(onMoment).toHaveBeenLastCalledWith(-10);
  });

  it('plays on, frame by frame, past the strike, and stops at its end', () => {
    const { made, onMoment } = clock();
    made.open();
    frame(0);
    for (let now = 200; now < 200 * 400; now += 200) frame(now);
    expect(made.root.dataset['playing']).toBe('false');
    expect(Number(made.root.dataset['seconds'])).toBeGreaterThan(3e13);
    expect(onMoment.mock.calls.length).toBeGreaterThan(50);
    expect(made.root.dataset['phase']).toBe('veil');
  });

  it('is moved by its slider, saying the phase and its sources', () => {
    const { made, slider, onMoment } = clock();
    made.open();
    slider.value = String(positionAt(120));
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    expect(made.root.dataset['playing']).toBe('false');
    expect(made.root.dataset['phase']).toBe('fireball');
    expect(made.root.querySelector('.strike-clock-phase')?.textContent).toBe('The fireball');
    const links = [...made.root.querySelectorAll('.strike-clock-sources a')];
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      'https://doi.org/10.1/a',
      'https://doi.org/10.1/b',
    ]);
    expect(onMoment.mock.lastCall?.[0]).toBeCloseTo(120, 0);
  });

  it('plays again from the start once it has ended, at the speed picked', () => {
    const { made, slider, play } = clock();
    made.open();
    slider.value = String(CLOCK_END);
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    const speed = made.root.querySelector<HTMLSelectElement>('.strike-clock-speed');
    if (speed === null) throw new Error('no speed');
    speed.value = 'fast';
    speed.dispatchEvent(new Event('change'));
    play.click();
    expect(made.root.dataset['playing']).toBe('true');
    frame(0);
    frame(100);
    expect(Number(made.root.dataset['seconds'])).toBeLessThan(0);
    play.click();
    expect(made.root.dataset['playing']).toBe('false');
  });

  it('closes, once, telling whoever opened it', () => {
    const { made, onClose } = clock();
    made.open();
    made.root.querySelector<HTMLButtonElement>('.strike-clock-close')?.click();
    expect(made.isOpen()).toBe(false);
    made.close();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
