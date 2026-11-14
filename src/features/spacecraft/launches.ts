/**
 * The launches played (#702): with the spacecraft on, the bar's time runs from the record's
 * first launch (Luna 1, January 1959) to today, the planets, the moons and the craft each where
 * they were at every moment. It slows as each craft leaves Earth's orbit, to be seen going, and
 * speeds up between (`launchPace.ts`): at its default pace, the whole of it in about eleven
 * minutes, slow enough to follow a cruise (#710). The camera stays the reader's, to zoom out
 * from Earth or the Sun as it plays. With a mission named, the bar plays that one journey
 * instead, its chapters its moments (#712), and a button goes back to every launch.
 */

import { momentAt } from '../../eclipses/describe';
import { loadSpacecraft } from '../../data/spacecraft';
import { missionNamed, missions, type Mission } from '../../data/spacecraftMission';
import { momentJulianDay, spacecraftPlays, type ViewState } from '../../state/viewState';
import { julianDayNumber } from '../../time/julianDay';
import { createDayTrack, type DayView } from '../../ui/dayTrack';
import { errorMessage } from '../../util/errors';
import type { PartContext } from '../part';
import { dayPlay } from './dayPlay';
import { launchMoments } from './launchList';
import { departures } from './launchPace';
import { launchesProgram, missionProgram, today, type Program } from './programs';

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

/** What the track shows of a program, at the moment shown. */
function programView(state: ViewState, program: Program, playing: boolean, speed: number): DayView {
  return {
    title: program.title,
    slider: program.slider,
    jd: momentJulianDay(state.time),
    first: program.first,
    last: program.last(),
    moments: program.moments,
    since: program.since,
    playing,
    speed,
    speeds: program.paces,
    leave: program.mission,
  };
}

/**
 * The launches and the missions, loaded once asked for; `ready` hears when they are in. The
 * program for a view: the mission it names, worked out once each, or every launch.
 */
function programsLoader(context: LaunchesContext, ready: () => void) {
  let loaded: { launches: Program; missions: readonly Mission[] } | null = null;
  const made = new Map<string, Program>();
  let asked = false;
  return {
    for(state: ViewState): Program | null {
      if (loaded === null) return null;
      const mission = state.mission === null ? null : missionNamed(loaded.missions, state.mission);
      if (mission === null) return loaded.launches;
      let program = made.get(mission.id);
      if (program === undefined) {
        program = missionProgram(mission);
        made.set(mission.id, program);
      }
      return program;
    },
    load(): void {
      if (asked) return;
      asked = true;
      loadSpacecraft(`${context.base}data/spacecraft.json`, context.fetchJson).then(
        ({ craft }) => {
          loaded = {
            launches: launchesProgram(launchMoments(craft), departures(craft)),
            missions: missions(craft, today()),
          };
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

/** The bar's track for the launches, its paces given by what plays. */
function launchTrack(handlers: Parameters<typeof createDayTrack>[1]) {
  return createDayTrack(
    {
      className: 'launch-track',
      speeds: [],
      play: 'Play the launches',
      stop: 'Stop the launches',
      leave: 'All launches',
    },
    handlers,
  );
}

export function mountLaunches(context: LaunchesContext): LaunchesPart {
  const { store } = context;
  // What plays, and at how many hours a second: a new program starts at its own pace.
  let program: Program | null = null;
  let speed = 0;
  let shown: ViewState['time'] | null = null;
  const programs = programsLoader(context, () => {
    show(store.get());
  });
  const play = dayPlay({
    pace: (jd) => program?.pace(jd, speed) ?? 1,
    at: () => momentJulianDay(store.get().time),
    go: setMoment,
    end: () => program?.last() ?? today(),
    ended: () => {
      show(store.get());
    },
  });
  const track = launchTrack({
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
    onLeave() {
      stop();
      store.set((state) => ({ ...state, mission: null }));
    },
  });

  function show(state: ViewState): void {
    if (!spacecraftPlays(state)) {
      stop();
      track.render(null);
      return;
    }
    context.history.root.hidden = true;
    context.history.extras.hidden = true;
    context.history.stop();
    const next = programs.for(state);
    if (next === null) programs.load();
    if (next !== program) {
      program = next;
      speed = next?.fitted ?? 0;
      stop();
    }
    track.render(next === null ? null : programView(state, next, play.playing, speed));
  }

  function setMoment(jd: number): void {
    const time = momentAt(julianDayNumber(jd));
    shown = time;
    store.set((state) => ({ ...state, time, selection: null }));
  }

  function start(): void {
    if (program === null) return;
    const at = momentJulianDay(store.get().time);
    // Outside its days, or at their end, play starts at the first.
    if (at < program.first - program.slack || at >= program.last() - program.slack) {
      setMoment(program.first);
    }
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
