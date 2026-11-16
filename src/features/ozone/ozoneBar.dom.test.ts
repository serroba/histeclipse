// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import history from '../../../public/data/ozone/history.json';
import maps from '../../../public/data/ozone/maps.json';
import shell from '../../../public/data/ozone/shell.json';
import { noonJd } from '../../data/ozoneBar';
import { momentAt } from '../../eclipses/describe';
import { createStore } from '../../state/store';
import { defaultViewState, momentJulianDay, type ViewState } from '../../state/viewState';
import { julianDayNumber } from '../../time/julianDay';
import { mountOzoneBar, OZONE_SPEEDS, YEAR_MS, type OzoneBarContext } from './ozoneBar';

const TODAY = new Date('2026-11-14T12:00:00Z');
const at = (year: number, month: number, day: number) =>
  momentAt(julianDayNumber(noonJd(year, month, day)));

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

async function setUp(more: Partial<ViewState> = {}, failures = 0) {
  let failing = failures;
  const store = createStore<ViewState>({
    ...defaultViewState(TODAY),
    layers: new Set(['ozone']),
    time: at(1985, 10, 1),
    ...more,
  });
  const years = { root: document.createElement('div'), extras: document.createElement('span') };
  const stopYears = vi.fn();
  const notify = vi.fn();
  const part = mountOzoneBar({
    base: '/',
    fetchJson: (url: string) => {
      if (url.endsWith('history.json')) failing -= 1;
      if (failing >= 0) return Promise.reject(new Error('offline'));
      const body = url.endsWith('maps.json') ? maps : url.endsWith('shell.json') ? shell : history;
      return Promise.resolve(new Response(JSON.stringify(body)));
    },
    store,
    notify,
    history: { ...years, stop: stopYears },
  } as unknown as OzoneBarContext);
  store.subscribe((state) => {
    part.render(state);
    part.show(state);
  });
  part.show(store.get());
  // The three files, then the bar.
  await vi.advanceTimersByTimeAsync(0);
  const jd = () => momentJulianDay(store.get().time);
  const button = (name: string) => {
    const found = [...part.root.querySelectorAll('button')].find(
      (each) => each.getAttribute('aria-label') === name || each.textContent.includes(name),
    );
    if (found === undefined) throw new Error(`no ${name}`);
    return found;
  };
  const slider = part.root.querySelector<HTMLInputElement>('input[type="range"]');
  if (slider === null) throw new Error('no slider');
  return { store, part, years, stopYears, notify, jd, button, slider };
}

describe('ozone’s own bar (#805)', () => {
  it('Given the ozone layer on, Then the bar reaches only its years, 1970 to 2025, with its moments named, and the years’ own track gives way', async () => {
    const { part, years, stopYears, slider } = await setUp();
    expect(part.root.hidden).toBe(false);
    expect(part.extras.hidden).toBe(false);
    expect(part.root.getAttribute('aria-label')).toBe('The ozone layer, 1970 to 2025');
    expect(Number(slider.min)).toBe(noonJd(1970, 10, 1));
    expect(Number(slider.max)).toBe(noonJd(2025, 12, 31));
    expect(Number(slider.value)).toBe(noonJd(1985, 10, 1));
    expect([...part.root.querySelectorAll('.cycle-moment-name')].map((e) => e.textContent)).toEqual(
      [
        'The maps begin',
        'No map',
        'The hole measured daily',
        'Montreal Protocol',
        'The layer in 3D',
        'The widest hole',
      ],
    );
    expect(years.root.hidden).toBe(true);
    expect(years.extras.hidden).toBe(true);
    expect(stopYears).toHaveBeenCalled();
    const speeds = [...part.extras.querySelectorAll('option')].map((option) => option.textContent);
    expect(speeds).toEqual(['3 days/s', '7 days/s', '14 days/s', '30 days/s']);
  });

  it('Given a moment outside its years, Then the slider is held at the nearer end', async () => {
    const before = await setUp({ time: at(1900, 1, 1) });
    expect(Number(before.slider.value)).toBe(noonJd(1970, 10, 1));
    const after = await setUp({ time: at(2026, 6, 1) });
    expect(Number(after.slider.value)).toBe(noonJd(2025, 12, 31));
  });

  it('Given the layer off, the spacecraft on, another body or deep time, Then the bar is not there and the years keep theirs', async () => {
    for (const more of [
      { layers: new Set<ViewState['layers'] extends ReadonlySet<infer L> ? L : never>() },
      { layers: new Set(['ozone', 'spacecraft'] as const) },
      { focus: 'moon' as const },
      { ma: 100 },
    ]) {
      const { part, years } = await setUp(more);
      expect(part.root.hidden).toBe(true);
      expect(years.root.hidden).toBe(false);
    }
  });

  it('When they play through years with only a map, Then a year at each step', async () => {
    const { jd, button } = await setUp();
    button('Play the ozone years').click();
    expect(jd()).toBe(noonJd(1985, 10, 1));
    await vi.advanceTimersByTimeAsync(YEAR_MS * 3);
    expect(jd()).toBe(noonJd(1988, 10, 1));
    button('Stop the ozone years').click();
    await vi.advanceTimersByTimeAsync(YEAR_MS * 3);
    expect(jd()).toBe(noonJd(1988, 10, 1));
  });

  it('When play reaches a season, Then a day at each step, at the pace chosen', async () => {
    const { jd, button, part } = await setUp({ time: at(2002, 10, 1) });
    button('Play the ozone years').click();
    await vi.advanceTimersByTimeAsync(YEAR_MS);
    expect(jd()).toBe(noonJd(2003, 7, 1));
    // Seven days a second, then thirty.
    await vi.advanceTimersByTimeAsync(1000);
    expect(jd()).toBe(noonJd(2003, 7, 8));
    const speed = part.extras.querySelector('select');
    if (speed === null) throw new Error('no speed');
    speed.value = String(OZONE_SPEEDS[3]);
    speed.dispatchEvent(new Event('change'));
    await vi.advanceTimersByTimeAsync(1000);
    expect(jd()).toBeGreaterThan(noonJd(2003, 7, 30));
  });

  it('When play reaches the last day, Then it stops; played from there or from outside its years, it starts at the first', async () => {
    const { jd, button, store } = await setUp({ time: at(2025, 12, 30) });
    button('Play the ozone years').click();
    await vi.advanceTimersByTimeAsync(1000);
    expect(jd()).toBe(noonJd(2025, 12, 31));
    expect(button('Play the ozone years')).toBeDefined();
    button('Play the ozone years').click();
    expect(jd()).toBe(noonJd(1970, 10, 1));
    button('Stop the ozone years').click();
    store.set((state) => ({ ...state, time: at(1950, 1, 1) }));
    button('Play the ozone years').click();
    expect(jd()).toBe(noonJd(1970, 10, 1));
  });

  it('When the slider is moved or a moment picked, Then that day at noon, and play stops', async () => {
    const { jd, button, slider } = await setUp();
    button('Play the ozone years').click();
    slider.value = String(noonJd(2006, 9, 25) + 0.3);
    slider.dispatchEvent(new Event('input'));
    expect(jd()).toBe(noonJd(2006, 9, 25));
    await vi.advanceTimersByTimeAsync(2000);
    expect(jd()).toBe(noonJd(2006, 9, 25));
    button('Montreal Protocol').click();
    expect(jd()).toBe(noonJd(1987, 9, 16));
  });

  it('When the time changes elsewhere, or the layer goes off, Then play stops', async () => {
    const typed = await setUp();
    typed.button('Play the ozone years').click();
    typed.store.set((state) => ({ ...state, time: at(1999, 5, 5) }));
    await vi.advanceTimersByTimeAsync(YEAR_MS * 3);
    expect(typed.jd()).toBe(noonJd(1999, 5, 5));

    const off = await setUp();
    off.button('Play the ozone years').click();
    off.store.set((state) => ({ ...state, layers: new Set() }));
    await vi.advanceTimersByTimeAsync(YEAR_MS * 3);
    expect(off.jd()).toBe(noonJd(1985, 10, 1));
    expect(off.part.root.hidden).toBe(true);
  });

  it('Given its files do not load, Then it says so, the years keep their track, and it tries again when next shown', async () => {
    const { part, years, notify, store } = await setUp({}, 1);
    expect(notify).toHaveBeenCalledWith('Could not load ozone’s years: offline');
    expect(part.root.hidden).toBe(true);
    expect(years.root.hidden).toBe(false);
    store.set((state) => ({ ...state, time: at(1990, 10, 1) }));
    await vi.advanceTimersByTimeAsync(0);
    expect(part.root.hidden).toBe(false);
    expect(notify).toHaveBeenCalledOnce();
  });
});
