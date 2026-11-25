// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CRISIS_SCALE } from '../../deepTime/crisisClock';
import { CLOCK_END, positionAt } from '../../deepTime/strikeClock';
import { createStrikeClock, createStrikeOffer, OFFER_MS } from './strikeClock';
import type { EventPhase } from './phases';

const PHASES: readonly EventPhase[] = [
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

  it('rewrites a phase only when it changes, not each frame (#1187)', () => {
    const { made, slider } = clock();
    made.open();
    const move = (seconds: number): void => {
      slider.value = String(positionAt(seconds));
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    };
    move(120);
    const first = made.root.querySelector('.strike-clock-sources a');
    const when = made.root.querySelector('.strike-clock-when')?.firstChild;
    move(600);
    // The same phase: its links and the moment's text node kept, the words changed.
    expect(made.root.querySelector('.strike-clock-sources a')).toBe(first);
    expect(made.root.querySelector('.strike-clock-when')?.firstChild).toBe(when);
    expect(made.root.dataset['seconds']).toBe('600');
    move(7200);
    expect(made.root.dataset['phase']).toBe('veil');
    expect(made.root.querySelector('.strike-clock-phase')?.textContent).toBe('The veil');
    expect(made.root.querySelectorAll('.strike-clock-sources a')).toHaveLength(0);
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

  it('draws its extinction’s dated window as a band, fading over each end’s uncertainty, with its words (#1228)', () => {
    const KYR = 1000 * 365.25 * 86_400;
    const plain = createStrikeClock({
      title: 'Chicxulub, in its own time',
      phases: PHASES,
      onMoment: vi.fn(),
      onClose: vi.fn(),
    });
    expect(plain.root.querySelector('.strike-clock-dated')).toBeNull();
    expect(plain.root.querySelector('.strike-clock-dated-says')).toBeNull();
    expect(plain.root.querySelector('.strike-clock-drawn')).toBeNull();
    const dated = createStrikeClock({
      title: 'The end-Permian, in its own time',
      phases: PHASES,
      scale: CRISIS_SCALE,
      dated: { from: 0, to: 60 * KYR, plusMinus: [20 * KYR, 20 * KYR], says: 'Dated at Meishan.' },
      drawn: 'Drawn to illustrate.',
      onMoment: vi.fn(),
      onClose: vi.fn(),
    });
    const band = dated.root.querySelector<HTMLElement>('.strike-clock-dated');
    const at = (seconds: number) => (100 * CRISIS_SCALE.positionAt(seconds)) / CRISIS_SCALE.end;
    expect(Number.parseFloat(band?.style.left ?? '')).toBeCloseTo(at(-20 * KYR), 6);
    expect(Number.parseFloat(band?.style.width ?? '')).toBeCloseTo(at(80 * KYR) - at(-20 * KYR), 6);
    expect(Number(band?.style.getPropertyValue('--in'))).toBeCloseTo(0.2, 6);
    expect(Number(band?.style.getPropertyValue('--out'))).toBeCloseTo(0.8, 6);
    expect(band?.title).toBe('Dated at Meishan.');
    expect(dated.root.querySelector('.strike-clock-dated-says')?.textContent).toBe(
      'Dated at Meishan.',
    );
    // And what is drawn to illustrate, under it (#1226).
    expect(dated.root.querySelector('.strike-clock-drawn')?.textContent).toBe(
      'Drawn to illustrate.',
    );
  });

  it('says nothing of a phase before the first, and takes a second open or pause in its stride', () => {
    const onMoment = vi.fn();
    const made = createStrikeClock({
      title: 'Chicxulub, in its own time',
      phases: [{ id: 'late', from: 60, title: 'Late', text: 'Later.', sources: [] }],
      onMoment,
      onClose: vi.fn(),
    });
    document.body.append(made.root);
    made.open();
    made.open();
    expect(frames).toHaveLength(1);
    expect(made.root.dataset['phase']).toBe('');
    expect(made.root.querySelector('.strike-clock-phase')?.textContent).toBe('');
    expect(made.root.querySelector('.strike-clock-sources')?.childNodes).toHaveLength(0);
    const play = made.root.querySelector<HTMLButtonElement>('.strike-clock-play');
    play?.click();
    expect(made.root.dataset['playing']).toBe('false');
    // Moved while paused: it stays paused.
    const slider = made.root.querySelector<HTMLInputElement>('.strike-clock-range');
    if (slider === null) throw new Error('no slider');
    slider.value = String(positionAt(120));
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    expect(made.root.dataset['playing']).toBe('false');
    expect(made.root.dataset['phase']).toBe('late');
  });

  it('closes, once, telling whoever opened it', () => {
    const { made, onClose } = clock();
    made.open();
    made.root.querySelector<HTMLButtonElement>('.strike-clock-close')?.click();
    expect(made.isOpen()).toBe(false);
    made.close();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows its words where there is room, and folds them away at a tap (#1243)', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    const { made } = clock();
    const fold = made.root.querySelector<HTMLButtonElement>('.strike-clock-fold');
    expect(made.root.dataset['folded']).toBeUndefined();
    expect(fold?.getAttribute('aria-expanded')).toBe('true');
    fold?.click();
    expect(made.root.dataset['folded']).toBe('');
    expect(fold?.getAttribute('aria-expanded')).toBe('false');
    expect(fold?.textContent).toBe('More');
  });

  it('opens folded on a phone, its words a tap away (#1243)', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const { made } = clock();
    const fold = made.root.querySelector<HTMLButtonElement>('.strike-clock-fold');
    expect(made.root.dataset['folded']).toBe('');
    fold?.click();
    expect(made.root.dataset['folded']).toBeUndefined();
    expect(fold?.textContent).toBe('Less');
  });
});

describe('the offer to watch a strike in its own time (#1174)', () => {
  it('waits a while to be taken, then goes', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const offer = createStrikeOffer((element) => {
        document.body.append(element);
      });
      const accept = vi.fn();
      offer.show('Watch Chicxulub in its own time', accept);
      offer.show('Watch Chicxulub in its own time', accept);
      expect(document.querySelectorAll('.strike-offer')).toHaveLength(1);
      vi.advanceTimersByTime(OFFER_MS);
      expect(document.querySelector('.strike-offer')).toBeNull();
      offer.show('Watch Chicxulub in its own time', accept);
      document.querySelector<HTMLButtonElement>('.strike-offer')?.click();
      expect(accept).toHaveBeenCalledTimes(1);
      expect(document.querySelector('.strike-offer')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
