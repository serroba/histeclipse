/**
 * Ozone as its own section (#805): with the ozone layer on, the bar's time is ozone's own, from
 * its first October's map (1970) to its last day (the end of 2025), and nothing outside the
 * years it has data for. Play goes a year at a step through the years with only a map, and a
 * day at a step, at the pace chosen, through each season of days in 3D (#804). The years' own
 * track gives way while it shows, as it does for the launches, and comes back when the layer
 * goes off. Loaded the first time it shows.
 */

import { momentAt } from '../../eclipses/describe';
import { loadOzone } from '../../data/ozone';
import {
  barMoments,
  barSpan,
  nextStop,
  ozoneYears,
  seasonAt,
  writtenDay,
  type BarMoment,
  type OzoneYears,
} from '../../data/ozoneBar';
import { loadOzoneMaps } from '../../data/ozoneMaps';
import { loadOzoneShell } from '../../data/ozoneShell';
import { momentJulianDay, ozonePlays, type ViewState } from '../../state/viewState';
import { julianDayNumber } from '../../time/julianDay';
import { createDayTrack, type DayView } from '../../ui/dayTrack';
import { errorMessage } from '../../util/errors';
import type { PartContext } from '../part';

/** What the bar asks of the rest of the page. */
export interface OzoneBarContext extends PartContext {
  /** The years' own track, and its speed beside the date: they give way while ozone runs the
   * time, and stop playing. */
  readonly history: { readonly root: HTMLElement; readonly extras: HTMLElement; stop(): void };
}

export interface OzoneBarPart {
  readonly root: HTMLElement;
  readonly extras: HTMLElement;
  /** Ozone's bar, while its layer is on. */
  readonly show: (state: ViewState) => void;
  /** The time changed elsewhere (the year typed, a link): play stops. */
  readonly render: (state: ViewState) => void;
}

/** Days a second through a season, as hours a second, which the track counts in. */
export const OZONE_SPEEDS = [72, 168, 336, 720] as const;
const DEFAULT_SPEED = 168;
/** How long each year's map is shown as play goes through the years with no season, ms. */
export const YEAR_MS = 450;

const TRACK = {
  className: 'ozone-track',
  speeds: OZONE_SPEEDS,
  play: 'Play the ozone years',
  stop: 'Stop the ozone years',
};

/** What the bar runs over, once loaded. */
interface Loaded {
  readonly years: OzoneYears;
  readonly span: { readonly first: number; readonly last: number };
  readonly moments: readonly BarMoment[];
}

async function load(context: OzoneBarContext): Promise<Loaded | null> {
  const [history, maps, shell] = await Promise.all([
    loadOzone(`${context.base}data/ozone/history.json`, context.fetchJson),
    loadOzoneMaps(`${context.base}data/ozone/maps.json`, context.fetchJson),
    loadOzoneShell(`${context.base}data/ozone/shell.json`, context.fetchJson),
  ]);
  const years = ozoneYears(maps, shell);
  const span = barSpan(years);
  return span === null ? null : { years, span, moments: barMoments(years, history) };
}

/** What the track shows at a moment. */
function barView(loaded: Loaded, jd: number, playing: boolean, speed: number): DayView {
  const { first, last } = loaded.span;
  return {
    title: `The ozone layer, ${writtenDay(first).slice(-4)} to ${writtenDay(last).slice(-4)}`,
    slider: 'Day',
    // A moment outside the bar's years is held at its nearer end.
    jd: Math.min(Math.max(jd, first), last),
    first,
    last,
    moments: loaded.moments,
    since: writtenDay(first),
    playing,
    speed,
  };
}

/** What play asks: what it runs over, the moment shown, how to show another, and the pace. */
interface PlayHooks {
  loaded(): Loaded | null;
  at(): number;
  go(jd: number): void;
  /** Hours a second through a season. */
  speed(): number;
  /** It started, moved on or stopped: the bar is drawn again. */
  changed(): void;
}

/** Play through ozone's years: a day's pace in a season, a year's outside. */
function barPlay(hooks: PlayHooks) {
  let timer: ReturnType<typeof setTimeout> | null = null;

  /** Wait for the moment shown, then go on. */
  function wait(years: OzoneYears, jd: number): void {
    const inSeason = seasonAt(years, jd) !== null;
    timer = setTimeout(step, inSeason ? 1000 / (hooks.speed() / 24) : YEAR_MS);
  }

  function step(): void {
    timer = null;
    const loaded = hooks.loaded();
    const next = loaded === null ? null : nextStop(loaded.years, hooks.at());
    if (loaded !== null && next !== null) {
      hooks.go(next);
      wait(loaded.years, next);
    }
    hooks.changed();
  }

  return {
    get playing() {
      return timer !== null;
    },
    start(): void {
      const loaded = hooks.loaded();
      if (loaded === null || timer !== null) return;
      const { first, last } = loaded.span;
      const at = hooks.at();
      // Outside its years, or at their end, play starts at the first.
      const from = at < first || at >= last ? first : at;
      if (from !== at) hooks.go(from);
      wait(loaded.years, from);
      hooks.changed();
    },
    /** Stop; false if it was not playing. */
    stop(): boolean {
      if (timer === null) return false;
      clearTimeout(timer);
      timer = null;
      return true;
    },
  };
}

export function mountOzoneBar(context: OzoneBarContext): OzoneBarPart {
  const { store } = context;
  let loaded: Loaded | null = null;
  let asked = false;
  let speed = DEFAULT_SPEED;
  let shown: ViewState['time'] | null = null;
  const play = barPlay({
    loaded: () => loaded,
    at: () => momentJulianDay(store.get().time),
    go: setMoment,
    speed: () => speed,
    changed: () => {
      show(store.get());
    },
  });
  const track = createDayTrack(TRACK, {
    onDay(jd) {
      stop();
      setMoment(Math.round(jd));
    },
    onPlay(playing) {
      if (playing) play.start();
      else stop();
    },
    onSpeed(next) {
      speed = next;
      show(store.get());
    },
  });

  function setMoment(jd: number): void {
    const time = momentAt(julianDayNumber(jd));
    shown = time;
    store.set((state) => ({ ...state, time, selection: null }));
  }

  function stop(): void {
    if (play.stop()) show(store.get());
  }

  function show(state: ViewState): void {
    if (!ozonePlays(state)) {
      play.stop();
      track.render(null);
      return;
    }
    if (loaded === null) {
      track.render(null);
      if (asked) return;
      asked = true;
      load(context).then(
        (found) => {
          loaded = found;
          show(store.get());
        },
        (error: unknown) => {
          asked = false;
          context.notify(`Could not load ozone’s years: ${errorMessage(error)}`);
        },
      );
      return;
    }
    context.history.root.hidden = true;
    context.history.extras.hidden = true;
    context.history.stop();
    track.render(barView(loaded, momentJulianDay(state.time), play.playing, speed));
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
