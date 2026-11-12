/**
 * The bar's time away from Earth and the Moon (#447): the body's own cycle as Earth sees it, a
 * planet's from conjunction to conjunction, the Sun's Earth's year (#329), with its days to pick
 * and its own player.
 */

import { planetCycle, sunCycle, type BodyCycle } from '../../astro/planetCycle';
import type { PlanetEphemeris, PlanetName } from '../../astro/planets';
import { momentAt } from '../../eclipses/describe';
import { PLANET_NAMES } from '../../globe/planetLook';
import { momentJulianDay, type ViewState } from '../../state/viewState';
import { shortDate } from '../../time/calendars';
import {
  calendarDate,
  historicalCalendar,
  julianDayNumber,
  type JulianDay,
} from '../../time/julianDay';
import { astronomicalYear, formatYear } from '../../time/year';
import { createCycleTrack, type CycleMoment, type CycleSpeed } from '../../ui/cycleTrack';
import type { PartContext } from '../part';
import { cycleBody } from './body';

/** What the cycle asks of the rest of the page. */
export interface CycleContext extends PartContext {
  /** The planets' theory, once loaded, and the way to load it. */
  planets(): PlanetEphemeris | null;
  loadPlanets(): Promise<unknown>;
  /** The moment shown, in Terrestrial Time, once there is one. */
  moment(): JulianDay | null;
  /** Universal Time at a moment in Terrestrial Time. */
  universalTime(jdTT: JulianDay): JulianDay;
  /** The years' own track gives way while a cycle, or an eclipse's player, runs the time. */
  hideHistory(hidden: boolean): void;
  stopHistory(): void;
}

export interface CyclePart {
  readonly root: HTMLElement;
  readonly extras: HTMLElement;
  /** The cycle of the body in view, or none. */
  readonly show: (state: ViewState) => void;
  /** The time changed elsewhere (the year typed, the slider): play stops. */
  readonly render: (state: ViewState) => void;
}

/** A moment of the cycle as written: "16 Jan 2025". */
function cycleDate(jd: JulianDay): string {
  const { year } = calendarDate(jd, historicalCalendar(jd));
  return `${shortDate('western', jd)} ${formatYear(astronomicalYear(year))}`;
}

export function mountCycle(context: CycleContext): CyclePart {
  const { store } = context;
  const track = createCycleTrack({
    onDay(jd) {
      stop();
      setMoment(jd);
    },
    onPlay(play) {
      if (play) start();
      else stop();
    },
    onSpeed(next) {
      speed = next;
      show(store.get());
    },
  });
  let cycle: {
    readonly body: PlanetName | 'sun';
    readonly at: BodyCycle;
    readonly moments: readonly CycleMoment[];
  } | null = null;
  let playing = false;
  let speed: CycleSpeed = 240;
  let frame = 0;
  let tick = 0;
  // Where play has got to, UT, unrounded; shown a whole day at a time, so the time of day (and
  // so how the bodies are turned) holds still as the days go by.
  let head = 0;
  let shown: ViewState['time'] | null = null;

  function show(state: ViewState): void {
    const body = cycleBody(state);
    // With an eclipse open its own player runs the time; on a planet or the Sun, the cycle.
    context.hideHistory(state.selection !== null || body !== null);
    const theory = context.planets();
    const jdTT = context.moment();
    if (body === null || theory === null || jdTT === null) {
      if (body === null) stop();
      else if (theory === null) void context.loadPlanets();
      track.render(null);
      return;
    }
    context.stopHistory();
    if (cycle?.body !== body || jdTT < cycle.at.start || jdTT >= cycle.at.end) {
      const at = body === 'sun' ? sunCycle(theory, jdTT) : planetCycle(theory, body, jdTT);
      cycle = {
        body,
        at,
        moments: at.events.map(({ mark, jdTT: when }) => {
          const jd = context.universalTime(julianDayNumber(when));
          return { mark, jd, date: cycleDate(jd) };
        }),
      };
    }
    track.render({
      title:
        body === 'sun'
          ? 'Earth’s year around the Sun'
          : `${PLANET_NAMES[body]}’s cycle, as seen from Earth`,
      slider: body === 'sun' ? 'Day in Earth’s year' : `Day in ${PLANET_NAMES[body]}’s cycle`,
      jd: momentJulianDay(state.time),
      moments: cycle.moments,
      playing,
      speed,
    });
  }
  function setMoment(jd: number): void {
    const time = momentAt(julianDayNumber(jd));
    shown = time;
    store.set((state) => ({ ...state, time, selection: null }));
  }
  function start(): void {
    playing = true;
    head = momentJulianDay(store.get().time);
    tick = performance.now();
    frame = requestAnimationFrame(step);
    show(store.get());
  }
  function step(now: number): void {
    if (!playing) return;
    // A frame after a stall (a hidden tab) counts as a quarter of a second at most.
    const seconds = Math.min(Math.max(now - tick, 0) / 1000, 0.25);
    tick = now;
    const at = momentJulianDay(store.get().time);
    head += (speed / 24) * seconds;
    // A day or more a second steps whole days, so each planet's turning holds still; slower
    // steps whole minutes, the finest time kept, so moons glide round (#335).
    const size = speed >= 24 ? 1 : 1 / 1440;
    const steps = Math.floor((head - at) / size + 1e-9);
    if (steps >= 1) setMoment(at + steps * size);
    frame = requestAnimationFrame(step);
  }
  function stop(): void {
    if (!playing) return;
    playing = false;
    cancelAnimationFrame(frame);
    show(store.get());
  }

  return {
    root: track.root,
    extras: track.extras,
    show,
    render(state) {
      if (playing && state.time !== shown) stop();
    },
  };
}
