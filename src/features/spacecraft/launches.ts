/**
 * The launches played (#702): with the spacecraft on, the bar's time runs from the record's
 * first launch (Luna 1, January 1959) to today, the planets, the moons and the craft each where
 * they were at every moment. It slows as each craft leaves Earth's orbit, to be seen going, and
 * speeds up between (`launchPace.ts`): at its default pace, the whole of it in under five
 * minutes. The camera stays the reader's, to zoom out from Earth or the Sun as it plays.
 */

import { momentAt } from '../../eclipses/describe';
import { loadSpacecraft } from '../../data/spacecraft';
import { momentJulianDay, spacecraftPlays, type ViewState } from '../../state/viewState';
import { julianDayNumber } from '../../time/julianDay';
import { createDayTrack, type DayMoment, type DayView } from '../../ui/dayTrack';
import { errorMessage } from '../../util/errors';
import type { PartContext } from '../part';
import { dayPlay } from './dayPlay';
import { launchMoments } from './launchList';
import { departures, launchPace } from './launchPace';

/** Hours a second between departures: 50, 100, 200 and 400 days a second. At 200, slowing
 * for each craft leaving, 1959 to now plays in about four and three-quarter minutes. */
const LAUNCH_SPEEDS = [1200, 2400, 4800, 9600] as const;
const DEFAULT_SPEED = 4800;

/** What the launches ask of the rest of the page. */
export interface LaunchesContext extends PartContext {
  /** The years' own track, and its speed beside the date: they give way while the launches
   * run the time, and stop playing. */
  readonly history: { readonly root: HTMLElement; readonly extras: HTMLElement; stop(): void };
}

export interface LaunchesPart {
  readonly root: HTMLElement;
  readonly extras: HTMLElement;
  /** The launches' player, while the spacecraft are on. */
  readonly show: (state: ViewState) => void;
  /** The time changed elsewhere (the year typed, the slider): play stops. */
  readonly render: (state: ViewState) => void;
}

/** Today, as a UT Julian Day. */
function today(): number {
  return Date.now() / 86_400_000 + 2_440_587.5;
}

/** What the track shows of the launches, at the moment shown. */
function launchView(
  state: ViewState,
  moments: readonly DayMoment[],
  playing: boolean,
  speed: number,
): DayView {
  return {
    title: 'Every launch beyond Earth orbit, from the first to today, slowing as each leaves',
    slider: 'Day since the first launch',
    jd: momentJulianDay(state.time),
    first: moments[0]?.jd ?? today(),
    last: today(),
    moments,
    since: moments[0]?.name ?? 'the first launch',
    playing,
    speed,
  };
}

/** The launches, loaded once asked for; `ready` hears when they are in. */
function launchesLoader(context: LaunchesContext, ready: () => void) {
  let launches: { moments: readonly DayMoment[]; departed: readonly number[] } | null = null;
  let asked = false;
  return {
    get: () => launches?.moments ?? null,
    departed: () => launches?.departed ?? [],
    load(): void {
      if (asked) return;
      asked = true;
      loadSpacecraft(`${context.base}data/spacecraft.json`, context.fetchJson).then(
        (record) => {
          launches = { moments: launchMoments(record.craft), departed: departures(record.craft) };
          ready();
        },
        (error: unknown) => {
          asked = false;
          context.notify(`Could not load the launches: ${errorMessage(error)}`);
        },
      );
    },
  };
}

export function mountLaunches(context: LaunchesContext): LaunchesPart {
  const { store } = context;
  let speed: number = DEFAULT_SPEED;
  let shown: ViewState['time'] | null = null;
  const launches = launchesLoader(context, () => {
    show(store.get());
  });
  const play = dayPlay({
    pace: (jd) => launchPace(launches.departed(), jd, speed / 24),
    at: () => momentJulianDay(store.get().time),
    go: setMoment,
    end: today,
    ended: () => {
      show(store.get());
    },
  });
  const track = createDayTrack(
    {
      className: 'launch-track',
      speeds: LAUNCH_SPEEDS,
      play: 'Play the launches',
      stop: 'Stop the launches',
    },
    {
      onDay(jd) {
        stop();
        setMoment(jd);
      },
      onPlay(playing) {
        if (playing) start();
        else stop();
      },
      onSpeed(next) {
        speed = next;
        show(store.get());
      },
    },
  );

  function show(state: ViewState): void {
    const moments = launches.get();
    if (!spacecraftPlays(state)) {
      stop();
      track.render(null);
      return;
    }
    context.history.root.hidden = true;
    context.history.extras.hidden = true;
    context.history.stop();
    if (moments === null) launches.load();
    track.render(moments === null ? null : launchView(state, moments, play.playing, speed));
  }

  function setMoment(jd: number): void {
    const time = momentAt(julianDayNumber(jd));
    shown = time;
    store.set((state) => ({ ...state, time, selection: null }));
  }

  function start(): void {
    const first = launches.get()?.[0]?.jd;
    if (first === undefined) return;
    const at = momentJulianDay(store.get().time);
    // Outside the launches' years, or at their end, play starts at the first.
    if (at < first - 1 || at >= today() - 1) setMoment(first);
    play.start();
    show(store.get());
  }

  function stop(): void {
    if (play.stop()) show(store.get());
  }

  return {
    root: track.root,
    extras: track.extras,
    show,
    render(state) {
      if (play.playing && state.time !== shown) stop();
    },
  };
}
