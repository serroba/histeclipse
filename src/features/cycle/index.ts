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
import { createDayTrack, type DayMoment, type DayView } from '../../ui/dayTrack';
import type { PartContext } from '../part';
import { cycleBody } from './body';
import type { CycleMark } from '../../astro/planetCycle';

/** Hours a second the cycle can play at: an hour or six for the moons, a day or more for the
 * planets. */
const CYCLE_SPEEDS = [1, 6, 24, 120, 240, 720] as const;

/** Each moment's words, and what it means. */
const MARK_WORDS: Readonly<Record<CycleMark, readonly [string, string]>> = {
  behind: ['Behind the Sun', 'Conjunction: beyond the Sun, lost in its glare'],
  opposite: ['Opposite the Sun', 'Opposition: near its closest and brightest, up all night'],
  between: ['Between us and the Sun', 'Inferior conjunction: closest, its dark side towards us'],
  evening: ['Best in the evening', 'Greatest elongation east of the Sun: highest after sunset'],
  morning: ['Best in the morning', 'Greatest elongation west of the Sun: highest before sunrise'],
  perihelion: ['Earth nearest the Sun', 'Perihelion: the Sun looks its largest'],
  aphelion: ['Earth farthest from the Sun', 'Aphelion: the Sun looks its smallest'],
};

/** What the cycle asks of the rest of the page. */
export interface CycleContext extends PartContext {
  /** The planets' theory, once loaded, and the way to load it. */
  planets(): PlanetEphemeris | null;
  loadPlanets(): Promise<unknown>;
  /** The moment shown, in Terrestrial Time, once there is one. */
  moment(): JulianDay | null;
  /** Universal Time at a moment in Terrestrial Time. */
  universalTime(jdTT: JulianDay): JulianDay;
  /** The years' own track, and its speed beside the date: they give way while a cycle, or an
   * eclipse's player, runs the time, and stop playing. */
  readonly history: { readonly root: HTMLElement; readonly extras: HTMLElement; stop(): void };
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

/** What the track shows of a body's cycle, at `jd` (UT). */
function cycleView(
  body: PlanetName | 'sun',
  moments: readonly DayMoment[],
  jd: number,
  playing: boolean,
  speed: number,
): DayView {
  const planet = body === 'sun' ? null : PLANET_NAMES[body];
  return {
    title:
      planet === null ? 'Earth’s year around the Sun' : `${planet}’s cycle, as seen from Earth`,
    slider: planet === null ? 'Day in Earth’s year' : `Day in ${planet}’s cycle`,
    jd,
    first: moments[0]?.jd ?? jd,
    last: moments.at(-1)?.jd ?? jd,
    moments,
    since: (moments[0]?.name ?? 'the cycle’s start').toLowerCase(),
    playing,
    speed,
  };
}

export function mountCycle(context: CycleContext): CyclePart {
  const { store } = context;
  const track = createDayTrack(
    {
      className: 'cycle-track',
      speeds: CYCLE_SPEEDS,
      play: 'Play the cycle',
      stop: 'Stop the cycle',
    },
    {
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
    },
  );
  let cycle: {
    readonly body: PlanetName | 'sun';
    readonly at: BodyCycle;
    readonly moments: readonly DayMoment[];
  } | null = null;
  let playing = false;
  let speed = 240;
  let frame = 0;
  let tick = 0;
  // Where play has got to, UT, unrounded; shown a whole day at a time, so the time of day (and
  // so how the bodies are turned) holds still as the days go by.
  let head = 0;
  let shown: ViewState['time'] | null = null;

  function show(state: ViewState): void {
    const body = cycleBody(state);
    // With an eclipse open its own player runs the time; on a planet or the Sun, the cycle.
    const hidden = state.selection !== null || body !== null;
    context.history.root.hidden = hidden;
    context.history.extras.hidden = hidden;
    const theory = context.planets();
    const jdTT = context.moment();
    if (body === null || theory === null || jdTT === null) {
      if (body === null) stop();
      else if (theory === null) void context.loadPlanets();
      track.render(null);
      return;
    }
    context.history.stop();
    if (cycle?.body !== body || jdTT < cycle.at.start || jdTT >= cycle.at.end) {
      const at = body === 'sun' ? sunCycle(theory, jdTT) : planetCycle(theory, body, jdTT);
      cycle = {
        body,
        at,
        moments: at.events.map(({ mark, jdTT: when }) => {
          const jd = context.universalTime(julianDayNumber(when));
          const [name, meaning] = MARK_WORDS[mark];
          return { name, meaning, jd, date: cycleDate(jd) };
        }),
      };
    }
    track.render(cycleView(body, cycle.moments, momentJulianDay(state.time), playing, speed));
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
