// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DAY_MS, seasonPlayer, type SeasonView } from './seasonPlayer';

/** A season of 184 days whose view follows where it is told to go. */
function season(day: number | null) {
  const went: number[] = [];
  const view = (at: number | null): SeasonView => ({
    year: 2006,
    day: at,
    days: 184,
    label: at === null ? '1 July to 31 December 2006' : `day ${String(at)}`,
    go: (to) => {
      went.push(to);
      player.update(view(to));
    },
  });
  const player = seasonPlayer();
  player.update(view(day));
  const find = (selector: string): HTMLElement => {
    const found = player.root.querySelector<HTMLElement>(selector);
    if (found === null) throw new Error(`no ${selector}`);
    return found;
  };
  return {
    player,
    went,
    view,
    into: find('.ozone-into'),
    play: find('.ozone-play'),
    slider: find('.ozone-days') as HTMLInputElement,
    label: find('.ozone-day'),
    controls: find('.ozone-season-controls'),
  };
}

describe('the ozone season’s player (#804)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('Given a year with a season and a date outside it, Then a button leads into it, on 1 October', () => {
    const { player, went, into, controls } = season(null);
    expect(player.root.hidden).toBe(false);
    expect(controls.hidden).toBe(true);
    expect(into.textContent).toBe('The layer in 3D, day by day: 1 July to 31 December 2006');
    into.click();
    expect(went).toEqual([92]);
    // Now inside: the days' slider and the day, not the button.
    expect(into.hidden).toBe(true);
    expect(controls.hidden).toBe(false);
  });

  it('Given a day of the season, Then the slider is at it, and moving it goes to that day', () => {
    const { went, slider, label } = season(86);
    expect(slider.max).toBe('183');
    expect(slider.value).toBe('86');
    expect(label.textContent).toBe('day 86');
    slider.value = '120';
    slider.dispatchEvent(new Event('input'));
    expect(went).toEqual([120]);
  });

  it('When they play, Then a day at each step until they pause', () => {
    const { went, play } = season(10);
    play.click();
    expect(play.textContent).toBe('Pause');
    expect(play.getAttribute('aria-pressed')).toBe('true');
    vi.advanceTimersByTime(DAY_MS * 3);
    expect(went).toEqual([11, 12, 13]);
    play.click();
    expect(play.textContent).toBe('Play the season');
    vi.advanceTimersByTime(DAY_MS * 3);
    expect(went).toHaveLength(3);
  });

  it('When play reaches the last day, Then it stops; played again from there, it starts at the first', () => {
    const { went, play } = season(182);
    play.click();
    vi.advanceTimersByTime(DAY_MS * 4);
    expect(went).toEqual([183]);
    expect(play.textContent).toBe('Play the season');
    play.click();
    expect(went).toEqual([183, 0]);
    vi.advanceTimersByTime(DAY_MS);
    expect(went).toEqual([183, 0, 1]);
  });

  it('When the slider is moved, the year changes, or the layer goes, Then play stops', () => {
    const moved = season(10);
    moved.play.click();
    moved.slider.value = '50';
    moved.slider.dispatchEvent(new Event('input'));
    expect(moved.play.textContent).toBe('Play the season');

    const other = season(10);
    other.play.click();
    other.player.update({ ...other.view(10), year: 2007 });
    vi.advanceTimersByTime(DAY_MS * 2);
    expect(other.went).toEqual([]);

    const gone = season(10);
    gone.play.click();
    gone.player.update(null);
    expect(gone.player.root.hidden).toBe(true);
    vi.advanceTimersByTime(DAY_MS * 2);
    expect(gone.went).toEqual([]);
    // With no season, the buttons do nothing.
    gone.play.click();
    gone.into.click();
    expect(gone.went).toEqual([]);
  });
});
