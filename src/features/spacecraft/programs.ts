/**
 * What the bar plays with the spacecraft on (#702, #712): every launch from the first to today,
 * slowing as each craft leaves; or, with a mission named, that one journey, at a pace fitted to
 * its length. Each says its days, its moments, its paces and how fast it goes at a moment.
 */

import type { Mission } from '../../data/spacecraftMission';
import type { DayMoment } from '../../ui/dayTrack';
import { launchPace } from './launchPace';
import { missionMoments, missionPaces } from './missionPlay';

export interface Program {
  /** Which it is: `launches`, or the mission's id. */
  readonly key: string;
  readonly title: string;
  readonly slider: string;
  readonly first: number;
  /** The last day it plays to, UT JD. */
  last(): number;
  readonly moments: readonly DayMoment[];
  /** What the slider's days are counted from. */
  readonly since: string;
  /** Hours a second it can play at, and the one it starts at. */
  readonly paces: readonly number[];
  readonly fitted: number;
  /** Days a second at `jd`, at `hours` hours a second picked. */
  pace(jd: number, hours: number): number;
  /** How near its ends, days, play starts again from the first. */
  readonly slack: number;
  /** A mission: the button back to every launch. */
  readonly mission: boolean;
}

/** Today, as a UT Julian Day. */
export function today(): number {
  return Date.now() / 86_400_000 + 2_440_587.5;
}

/** Hours a second between departures: 50, 100, 200 and 400 days a second. With the slowing
 * for each craft leaving, 1959 to now plays in about 11, 7, 4¾ and 3½ minutes; 50 is the
 * default, where a cruise to Mars takes some four seconds (#710). */
const LAUNCH_PACES = [1200, 2400, 4800, 9600] as const;

/** Every launch, from the first to today. */
export function launchesProgram(
  moments: readonly DayMoment[],
  departed: readonly number[],
): Program {
  return {
    key: 'launches',
    title: 'Every launch beyond Earth orbit, from the first to today, slowing as each leaves',
    slider: 'Day since the first launch',
    first: moments[0]?.jd ?? today(),
    last: today,
    moments,
    since: moments[0]?.name ?? 'the first launch',
    paces: LAUNCH_PACES,
    fitted: 1200,
    pace: (jd, hours) => launchPace(departed, jd, hours / 24),
    slack: 1,
    mission: false,
  };
}

/** One mission, from leaving Earth to the last the record says of it. */
export function missionProgram(mission: Mission): Program {
  const { fitted, paces } = missionPaces(mission);
  return {
    key: mission.id,
    title: `${mission.title}: its journey`,
    slider: `Time since ${mission.title} left Earth`,
    first: mission.start,
    last: () => mission.end,
    moments: missionMoments(mission),
    since: `${mission.title} left Earth`,
    paces,
    fitted,
    pace: (_, hours) => hours / 24,
    slack: Math.min(1, (mission.end - mission.start) / 1000),
    mission: true,
  };
}
