// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import data from '../../../public/data/spacecraft.json';
import { createStore } from '../../state/store';
import { defaultViewState, momentJulianDay, type ViewState } from '../../state/viewState';
import { loadSpacecraft } from '../../data/spacecraft';
import { momentAt } from '../../eclipses/describe';
import { julianDayNumber } from '../../time/julianDay';
import { departures } from './launchPace';
import { mountLaunches } from './launches';

const record = await loadSpacecraft('spacecraft.json', () =>
  Promise.resolve(new Response(JSON.stringify(data))),
);

/** The middle of the longest wait between craft leaving Earth's orbit, at midnight. */
function quietest(): number {
  const days = departures(record.craft);
  let best = 0;
  let middle = 0;
  days.forEach((day, index) => {
    const next = days[index + 1] ?? day;
    if (next - day > best) {
      best = next - day;
      middle = Math.floor((day + next) / 2) + 0.5;
    }
  });
  return middle - 150;
}

const LUNA_1 = 2_436_570.5;
const TODAY = new Date('2026-11-14T12:00:00Z');

let frames: FrameRequestCallback[] = [];
/** Run the next frame, `ms` after the last. */
let clock = 0;
function frame(ms: number): void {
  clock += ms;
  const waiting = frames;
  frames = [];
  for (const callback of waiting) callback(clock);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(TODAY);
  frames = [];
  clock = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {
    frames = [];
  });
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function setUp(layers: ViewState['layers'] = new Set(['spacecraft'])) {
  const store = createStore<ViewState>({ ...defaultViewState(TODAY), layers });
  const history = { root: document.createElement('div'), extras: document.createElement('span') };
  const stopHistory = vi.fn();
  const notify = vi.fn();
  const part = mountLaunches({
    base: '/',
    fetchJson: () => Promise.resolve(new Response(JSON.stringify(data))),
    store,
    notify,
    why: () => document.createElement('button'),
    goToDeepTime: vi.fn(),
    history: { ...history, stop: stopHistory },
  });
  store.subscribe((state) => {
    part.render(state);
    part.show(state);
  });
  part.show(store.get());
  // The record loads, then the track shows.
  await vi.waitFor(() => {
    expect(part.root.hidden).toBe(false);
  });
  const button = () => part.root.querySelector<HTMLButtonElement>('.history-play');
  const day = () => momentJulianDay(store.get().time);
  return { store, part, history, stopHistory, notify, button, day };
}

describe('the launches played (#702)', () => {
  it('Given the spacecraft on, Then the launches take the bar, and the years give way', async () => {
    const { part, history, stopHistory } = await setUp();
    expect(part.root.getAttribute('aria-label')).toMatch(/launch/i);
    expect(part.root.querySelectorAll('.cycle-moment').length).toBeGreaterThan(200);
    expect(history.root.hidden).toBe(true);
    expect(history.extras.hidden).toBe(true);
    expect(stopHistory).toHaveBeenCalled();
  });

  it('Given today shown, When Play is pressed, Then the time goes to the first launch, and Luna 1 is seen leaving', async () => {
    const { button, day } = await setUp();
    button()?.click();
    expect(day()).toBeCloseTo(LUNA_1, 3);
    expect(button()?.getAttribute('aria-label')).toBe('Stop the launches');
    frame(0);
    frame(250);
    frame(250);
    // Half a second in, slowed for Luna 1 leaving: a few days on, a minute at a time.
    const on = day() - LUNA_1;
    expect(on).toBeGreaterThan(0.5);
    expect(on).toBeLessThan(5);
    expect(on % 1).not.toBeCloseTo(0, 3);
  });

  it('Given the years between departures, Then it plays at the pace picked, whole days at a time', async () => {
    const { store, part, button, day } = await setUp();
    // The middle of the longest wait between craft leaving.
    const gap = quietest();
    store.set((state) => ({ ...state, time: momentAt(julianDayNumber(gap)) }));
    button()?.click();
    frame(0);
    for (let k = 0; k < 4; k += 1) frame(250);
    expect(day() - gap).toBe(200);
    // A frame after a stall counts as a quarter of a second at most.
    frame(5000);
    expect(day() - gap).toBe(250);
    button()?.click();
    const speed = part.extras.querySelector('select');
    if (speed !== null) {
      speed.value = '1200';
      speed.dispatchEvent(new Event('change'));
    }
    const from = day();
    button()?.click();
    frame(10_000);
    frame(250);
    expect(day() - from).toBe(25);
  });

  it('Given a moment within the launches, When Play is pressed, Then it carries on from there', async () => {
    const { part, button, day } = await setUp();
    const voyager = [...part.root.querySelectorAll<HTMLButtonElement>('.cycle-moment')].find(
      (chip) => chip.textContent.startsWith('Voyager 2'),
    );
    voyager?.click();
    const from = day();
    expect(from).toBeGreaterThan(LUNA_1 + 365 * 18);
    button()?.click();
    expect(day()).toBe(from);
  });

  it('Given it playing, When the time is changed elsewhere, Then it stops', async () => {
    const { store, button } = await setUp();
    button()?.click();
    frame(0);
    frame(100);
    store.set((state) => ({ ...state, time: defaultViewState(TODAY).time }));
    expect(button()?.getAttribute('aria-label')).toBe('Play the launches');
  });

  it('Given it playing, When it reaches today, Then it stops there', async () => {
    const { button, day } = await setUp();
    button()?.click();
    frame(0);
    for (
      let k = 0;
      k < 2000 && button()?.getAttribute('aria-label') !== 'Play the launches';
      k += 1
    ) {
      frame(250);
    }
    expect(button()?.getAttribute('aria-label')).toBe('Play the launches');
    expect(Date.now() / 86_400_000 + 2_440_587.5 - day()).toBeLessThan(2);
  });

  it('Given the spacecraft turned off, Then the launches leave the bar and stop', async () => {
    const { store, part, button } = await setUp();
    button()?.click();
    store.set((state) => ({ ...state, layers: new Set() }));
    expect(part.root.hidden).toBe(true);
    expect(frames).toHaveLength(0);
  });

  it('Given deep time or an eclipse open, Then the launches do not take the bar', async () => {
    const { store, part } = await setUp();
    store.set((state) => ({ ...state, ma: 66 }));
    expect(part.root.hidden).toBe(true);
  });
});
