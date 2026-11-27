import { describe, expect, it } from 'vitest';

import type { PlayAxis } from '../../deepTime/playAxis';
import { createStore } from '../../state/store';
import { defaultViewState, type ViewState } from '../../state/viewState';
import { deepPlaying, heldPlay } from './playing';

/** Deep time on the 540 Myr bar, playing by frames the test runs; and how often the bar showed it. */
function setUp(
  state: Partial<ViewState>,
  lessMotion = false,
  finds: readonly number[] = [],
  axis: PlayAxis | null = null,
) {
  const store = createStore<ViewState>({
    ...defaultViewState(new Date('2026-06-15T12:00:00Z')),
    deepScale: 'all',
    ...state,
  });
  let tick: (seconds: number) => void = () => undefined;
  let running = false;
  let changes = 0;
  const play = deepPlaying({
    store,
    shown: () => ({ oldest: 540, youngest: 0 }),
    finds: () => finds,
    axis: () => axis,
    loop: (each) => {
      tick = each;
      return {
        start: () => {
          running = true;
        },
        stop: () => {
          running = false;
        },
      };
    },
    changed: () => {
      changes += 1;
    },
    lessMotion,
  });
  /** Frames of `seconds` each while it runs, at most `count`; the seconds they took. */
  const frames = (count: number, seconds = 1 / 60): number => {
    let took = 0;
    for (let frame = 0; frame < count && running; frame += 1) {
      tick(seconds);
      took += seconds;
    }
    return took;
  };
  return { store, play, frames, changes: () => changes, running: () => running };
}

/** A timeline 10 seconds long at Normal, from 1 Ma to today, evenly; and what it heard. */
function tenSeconds() {
  const followed: number[] = [];
  let ended = 0;
  const axis: PlayAxis = {
    at: (ma) => (1 - ma) * 10,
    ma: (seconds) => 1 - seconds / 10,
    follow: (ma) => followed.push(ma),
    ended: () => {
      ended += 1;
    },
  };
  return { axis, followed, ended: () => ended };
}

describe('playing along a part’s own timeline (#1276)', () => {
  it('Given a timeline, Then play keeps its pace, tells it where it is unrounded, and the end', () => {
    const { axis, followed, ended } = tenSeconds();
    const { store, play, frames } = setUp({ ma: 1 }, false, [], axis);
    // Its pace at Normal: a tenth of a Ma a second, as the bar says it.
    expect(play.speed()).toBeCloseTo(0.1);
    play.start();
    frames(150, 1 / 60);
    // Two and a half seconds along: a quarter of the way, its milestones no matter.
    expect(store.get().ma).toBe(0.75);
    expect(followed.at(-1)).toBeCloseTo(0.75, 6);
    frames(10, 1 / 600);
    // Finer than the thousand years the view keeps.
    expect(followed.at(-1)).not.toBe(store.get().ma);
    frames(1000);
    expect(store.get().ma).toBe(0);
    expect(play.playing()).toBe(false);
    expect(ended()).toBe(1);
  });

  it('Given Fast, Then it goes along the timeline faster, as the pace control says', () => {
    const { axis } = tenSeconds();
    const { store, play, frames } = setUp({ ma: 1 }, false, [], axis);
    play.setPace('fast');
    expect(play.speed()).toBeCloseTo(0.1 * (20 / 6));
    play.start();
    frames(60);
    expect(store.get().ma).toBeCloseTo(1 - 20 / 6 / 10, 2);
  });

  it('Given the reader moves the slider as it plays, Then it carries on from there', () => {
    const { axis } = tenSeconds();
    const { store, play, frames } = setUp({ ma: 1 }, false, [], axis);
    play.start();
    frames(60);
    store.set((state) => ({ ...state, ma: 0.3 }));
    frames(60);
    expect(store.get().ma).toBeCloseTo(0.2, 3);
  });
});

describe('playing deep time (#1076, #1077)', () => {
  it('Given Normal, Then the 540 Myr bar plays at 20 Myr/s towards today, and stops there', () => {
    const { store, play, frames, running } = setUp({ ma: 10 });
    expect(play.pace()).toBe('normal');
    expect(play.speed()).toBe(20);
    play.start();
    expect(play.playing()).toBe(true);
    frames(600);
    expect(store.get().ma).toBe(0);
    expect(play.playing()).toBe(false);
    expect(running()).toBe(false);
  });

  it('Given the moment at today, When play starts, Then it starts again at the bar’s oldest', () => {
    const { store, play } = setUp({ ma: 0 });
    play.start();
    expect(store.get().ma).toBe(540);
  });

  it('Given Fast picked, Then 100 Myr/s; a story plays at its own speed, until it stops', () => {
    const { play, changes } = setUp({ ma: 300 });
    play.setPace('fast');
    expect(play.speed()).toBe(100);
    expect(changes()).toBe(1);
    play.story(5);
    expect(play.speed()).toBe(5);
    play.start();
    play.stop();
    expect(play.speed()).toBe(100);
  });

  it('Given easing, Then play lingers near the end-Cretaceous milestone; turned off, it does not', () => {
    // From 80 to 50 Ma at 20 Myr/s: a second and a half unslowed, the K–Pg boundary at 66 Ma.
    const through = (easing: boolean): number => {
      const { store, play, frames } = setUp({ ma: 80 });
      play.setEasing(easing);
      play.start();
      let took = 0;
      while ((store.get().ma ?? 0) > 50 && took < 30) took += frames(1);
      return took;
    };
    expect(through(false)).toBeCloseTo(1.5, 1);
    expect(through(true)).toBeGreaterThan(1.8);
  });

  it('Given less motion asked for, Then easing starts off', () => {
    expect(setUp({ ma: 80 }, true).play.easing()).toBe(false);
    expect(setUp({ ma: 80 }).play.easing()).toBe(true);
  });

  it('Given a find of a layer on, Then play eases near it too', () => {
    // 120 to 100 Ma has no milestone; a find at 110 Ma slows it.
    const through = (finds: readonly number[]): number => {
      const { store, play, frames } = setUp({ ma: 120 }, false, finds);
      play.start();
      let took = 0;
      while ((store.get().ma ?? 0) > 100 && took < 30) took += frames(1);
      return took;
    };
    expect(through([])).toBeCloseTo(1, 1);
    expect(through([110])).toBeGreaterThan(1.2);
  });

  it('Given deep time left while playing, Then play stops', () => {
    const { store, play, frames } = setUp({ ma: 200 });
    play.start();
    store.set((state) => ({ ...state, ma: null }));
    frames(1);
    expect(play.playing()).toBe(false);
  });

  it('Given play asked twice, or a stop while still, Then nothing more happens', () => {
    const { play, changes } = setUp({ ma: 200 });
    play.stop();
    expect(changes()).toBe(0);
    play.start();
    play.start();
    expect(changes()).toBe(1);
  });
});

describe('deep time held for a while, and resumed (#1174)', () => {
  function deep(playing: boolean) {
    const calls: string[] = [];
    let on = playing;
    const play = heldPlay({
      playing: () => on,
      stop: () => {
        on = false;
        calls.push('stop');
      },
      start: () => {
        on = true;
        calls.push('start');
      },
      pace: () => 'slow',
    });
    return { play, calls };
  }

  it('says it was playing when held, and plays on when resumed', () => {
    const { play, calls } = deep(true);
    expect(play.hold()).toBe(true);
    play.resume();
    expect(calls).toEqual(['stop', 'start']);
    expect(play.pace()).toBe('slow');
  });

  it('says it was not, standing still', () => {
    expect(deep(false).play.hold()).toBe(false);
  });
});
