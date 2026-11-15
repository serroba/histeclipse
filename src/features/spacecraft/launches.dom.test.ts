// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import data from '../../../public/data/spacecraft.json';
import { createStore } from '../../state/store';
import { defaultViewState, momentJulianDay, type ViewState } from '../../state/viewState';
import { loadSpacecraft } from '../../data/spacecraft';
import { momentAt } from '../../eclipses/describe';
import { julianDayNumber } from '../../time/julianDay';
import { departures } from './launchPace';
import { PLAYBACK_EVENT, type PlaybackSignal } from '../../util/playbackSignal';
import { mountLaunches } from './launches';

const record = await loadSpacecraft('spacecraft.json', () =>
  Promise.resolve(new Response(JSON.stringify(data))),
);

/** The middle of the longest wait between craft leaving Earth's orbit, at midnight. */
function quietest(): number {
  const days = departures(record.craft).map(({ jd }) => jd);
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

async function setUp(
  layers: ViewState['layers'] = new Set(['spacecraft']),
  more: Partial<ViewState> = {},
) {
  const store = createStore<ViewState>({ ...defaultViewState(TODAY), layers, ...more });
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
    timeline: {
      travelling: () => false,
      playing: () => false,
      oldest: () => 540,
      earthFace: (jd) => jd,
    },
    deltaT: () => {
      throw new Error('no ΔT here');
    },
    ephemerides: {
      moon: () => null,
      planets: () => null,
      loadPlanets: () => Promise.reject(new Error('none')),
      planetPositions: () => null,
      planetsSeen: () => [],
    },
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

  it('Given play started, then stopped, Then each is signalled, with its pace and its slowdowns (#764)', async () => {
    const signals: PlaybackSignal[] = [];
    const heard = (event: Event): void => {
      signals.push((event as CustomEvent<PlaybackSignal>).detail);
    };
    window.addEventListener(PLAYBACK_EVENT, heard);
    const { button } = await setUp();
    button()?.click();
    frame(0);
    // Ten seconds of play: past Luna 1's slow stretch at full pace, and slowed again for Luna 2.
    for (let k = 0; k < 600; k += 1) frame(1000 / 60);
    button()?.click();
    window.removeEventListener(PLAYBACK_EVENT, heard);
    expect(signals.map(({ phase, kind }) => [phase, kind])).toEqual([
      ['start', 'launches'],
      ['stop', 'launches'],
    ]);
    const stop = signals[1]?.detail ?? {};
    expect(stop['reason']).toBe('stopped');
    expect(stop['fromJd']).toBeCloseTo(LUNA_1, 3);
    expect(Number(stop['toJd'])).toBeGreaterThan(LUNA_1 + 100);
    expect(Number(stop['fastestPace'])).toBeGreaterThan(Number(stop['slowestPace']));
    expect(Number(stop['slowdowns'])).toBeGreaterThan(0);
  });

  it('Given the camera out among the planets, When Play is pressed, Then Luna 1 heading for the Moon does not slow it (#769)', async () => {
    // Some 6½ AU from the Sun: 1,400 of its radii.
    const { button, day } = await setUp(new Set(['spacecraft']), {
      focus: 'sun',
      camera: { target: { latitude: 90, longitude: 0 }, distance: 1400 },
    });
    button()?.click();
    frame(0);
    frame(250);
    frame(250);
    // Half a second at 50 days a second: Luna 1 and Pioneer 4, both for the Moon, go unseen.
    expect(day() - LUNA_1).toBeCloseTo(25, 0);
  });

  it('Given the years between departures, Then it plays at 50 days a second, or the pace picked', async () => {
    const { store, part, button, day } = await setUp();
    // The middle of the longest wait between craft leaving.
    const gap = quietest();
    store.set((state) => ({ ...state, time: momentAt(julianDayNumber(gap)) }));
    button()?.click();
    frame(0);
    for (let k = 0; k < 4; k += 1) frame(250);
    expect(day() - gap).toBeCloseTo(50, 2);
    // A frame after a stall counts as a quarter of a second at most.
    frame(5000);
    expect(day() - gap).toBeCloseTo(62.5, 2);
    button()?.click();
    const speed = part.extras.querySelector('select');
    if (speed !== null) {
      speed.value = '4800';
      speed.dispatchEvent(new Event('change'));
    }
    const from = day();
    button()?.click();
    frame(10_000);
    frame(250);
    expect(day() - from).toBeCloseTo(100, 2);
  });

  for (const hertz of [60, 120]) {
    it(`Given it playing fast on a ${String(hertz)} Hz screen, Then every frame moves the planets and the craft on, and Earth's face keeps to whole days (#770)`, async () => {
      const { store, part, button, day } = await setUp();
      const gap = quietest();
      store.set((state) => ({ ...state, time: momentAt(julianDayNumber(gap)) }));
      // Before it plays, Earth faces the moment itself.
      expect(part.earthFace(gap + 0.3)).toBe(gap + 0.3);
      button()?.click();
      frame(0);
      const days = [day()];
      for (let k = 0; k < hertz; k += 1) {
        frame(1000 / hertz);
        days.push(day());
      }
      const moves = days.slice(1).map((jd, index) => jd - (days[index] ?? jd));
      expect(Math.min(...moves)).toBeGreaterThan(0);
      expect(day() - gap).toBeCloseTo(50, 1);
      for (const jd of days) {
        expect(Math.abs(part.earthFace(jd) - jd)).toBeLessThanOrEqual(0.5);
        expect((part.earthFace(jd) - gap) % 1).toBeCloseTo(0, 6);
      }
      // Stopped, Earth faces the moment shown again.
      button()?.click();
      expect(part.earthFace(day())).toBe(day());
    });
  }

  it('Given a mission played at hours a second, Then Earth turns with the moment (#770)', async () => {
    const { part, button, day } = await setUp(new Set(['spacecraft']), { mission: 'd00273' });
    button()?.click();
    frame(0);
    frame(250);
    expect(part.earthFace(day())).toBe(day());
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
      k < 4000 && button()?.getAttribute('aria-label') !== 'Play the launches';
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

  it('Given a mission named, Then the bar plays its journey: its chapters, at its own pace (#712)', async () => {
    const { part, button, day } = await setUp(new Set(['spacecraft']), { mission: 'd00273' });
    expect(part.root.getAttribute('aria-label')).toBe('Apollo 11: its journey');
    const chapters = [...part.root.querySelectorAll('.cycle-moment-name')].map(
      (name) => name.textContent,
    );
    expect(chapters).toEqual([
      'Leaves Earth',
      'Reaches the Moon',
      'Eagle: Lands on the Moon',
      'Columbia: Back at Earth',
      'Columbia: Home',
    ]);
    expect(part.root.querySelector('.cycle-moment-date')?.textContent).toBe(
      '17 Jul 1969, 16:41 UT',
    );
    // A week in some 45 seconds or more: three hours a second, with slower and faster beside.
    const speed = part.extras.querySelector('select');
    expect([...(speed?.options ?? [])].map((option) => option.text)).toEqual([
      '2 hours/s',
      '3 hours/s',
      '6 hours/s',
      '12 hours/s',
    ]);
    expect(speed?.value).toBe('3');
    button()?.click();
    const left = 2_440_420.195; // 1969-07-17T16:41 UT
    expect(day()).toBeCloseTo(left, 3);
    frame(0);
    for (let k = 0; k < 4; k += 1) frame(250);
    // Three hours on, a minute at a time.
    expect((day() - left) * 24).toBeCloseTo(3, 1);
  });

  it('Given a mission played to its end, Then it stops there, and plays again from its start', async () => {
    const { part, button, day } = await setUp(new Set(['spacecraft']), { mission: 'd00273' });
    button()?.click();
    frame(0);
    for (
      let k = 0;
      k < 400 && button()?.getAttribute('aria-label') !== 'Play the launches';
      k += 1
    ) {
      frame(250);
    }
    expect(button()?.getAttribute('aria-label')).toBe('Play the launches');
    const home = [...part.root.querySelectorAll('.cycle-moment')].at(-1);
    expect(home?.getAttribute('aria-current')).toBe('true');
    button()?.click();
    expect(day()).toBeCloseTo(2_440_420.195, 3);
  });

  it('Given a mission, When All launches is pressed, Then every launch plays again', async () => {
    const { store, part } = await setUp(new Set(['spacecraft']), { mission: 'd00273' });
    const leave = part.root.querySelector<HTMLButtonElement>('.day-leave');
    expect(leave?.hidden).toBe(false);
    expect(leave?.textContent).toBe('All launches');
    leave?.click();
    expect(store.get().mission).toBeNull();
    expect(part.root.getAttribute('aria-label')).toMatch(/^Every launch/);
    expect(leave?.hidden).toBe(true);
    expect(part.extras.querySelector('select')?.value).toBe('1200');
  });

  it('Given a mission the record does not have, Then every launch plays', async () => {
    const { part } = await setUp(new Set(['spacecraft']), { mission: 'd99999' });
    expect(part.root.getAttribute('aria-label')).toMatch(/^Every launch/);
  });
});
