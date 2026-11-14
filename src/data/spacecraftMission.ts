/**
 * A mission beyond Earth orbit, as one journey (#712): the craft one launch sent (Apollo 11's
 * Columbia and Eagle), from leaving Earth to the last thing the record says of them, told as
 * chapters (leaves Earth, reaches the Moon, lands), and the view that frames it: about Earth for
 * a mission to the Moon or an L point, about the Sun, from above the planets, for one among
 * them. Pure: the search's passages and the spacecraft layer both read it.
 */

import { gcatJd, type Craft } from './spacecraft';

/** A moment of the journey: what happened, its meaning in a sentence, and when (UT JD). */
interface MissionChapter {
  readonly name: string;
  readonly meaning: string;
  readonly jd: number;
}

export interface Mission {
  /** Its first craft's GCAT id, lower case: the link's `mission`. */
  readonly id: string;
  readonly title: string;
  /** The craft it sent, a capsule or lander riding with its craft counted with it. */
  readonly craft: readonly Craft[];
  /** From leaving Earth to its last recorded moment, UT JD. */
  readonly start: number;
  readonly end: number;
  readonly chapters: readonly MissionChapter[];
  /** Never about the Sun: the Moon, an L point, or about Earth. */
  readonly aboutEarth: boolean;
  /** How far from the Sun it went, AU; null about Earth. */
  readonly reach: number | null;
}

/** A year past its last encounter, a mission still flying is shown to (UT days). */
const STILL_FLYING_DAYS = 365;

/** How far from the Sun each place the record names lies, AU (its orbit's half-width). */
const REACH: Readonly<Record<string, number>> = {
  Mercury: 0.39,
  Venus: 0.72,
  Mars: 1.52,
  Jupiter: 5.2,
  Saturn: 9.54,
  Uranus: 19.2,
  Neptune: 30.1,
  Pluto: 39.5,
  Arrokoth: 44.6,
  SSE: 40,
};
/** Elsewhere among the planets (a comet, an asteroid), as far as the main belt. */
const ELSEWHERE_AU = 3;

/** GCAT's names for places, as a reader says them. */
const PLACES: Readonly<Record<string, string>> = {
  Luna: 'the Moon',
  SEL1: 'the Sun–Earth L1 point',
  SEL2: 'the Sun–Earth L2 point',
  EML1: 'the Earth–Moon L1 point',
  EML2: 'the Earth–Moon L2 point',
  SSE: 'interstellar space',
};
const L_POINTS = new Set(['SEL1', 'SEL2', 'EML1', 'EML2']);

function place(body: string): string {
  return PLACES[body] ?? body;
}

/** The moons the record names, by their planet: passing a moon is being at its planet. */
const MOON_OF: Readonly<Record<string, string>> = {
  Phobos: 'Mars',
  Deimos: 'Mars',
  Io: 'Jupiter',
  Europa: 'Jupiter',
  Ganymede: 'Jupiter',
  Callisto: 'Jupiter',
  Amalthea: 'Jupiter',
  Mimas: 'Saturn',
  Enceladus: 'Saturn',
  Tethys: 'Saturn',
  Dione: 'Saturn',
  Rhea: 'Saturn',
  Titan: 'Saturn',
  Hyperion: 'Saturn',
  Iapetus: 'Saturn',
  Phoebe: 'Saturn',
  Charon: 'Pluto',
};

/** One craft's moments, in its own words: leaving Earth, each world reached, each landing. */
function craftMoments(craft: Craft): MissionChapter[] {
  const out: MissionChapter[] = [];
  let at: string | null = null;
  craft.phases.forEach(([body, began, ended, how], index) => {
    const world = MOON_OF[body] ?? body;
    if (began !== null && index === 0) {
      out.push({ name: 'Leaves Earth', meaning: craft.about ?? 'Leaves Earth', jd: gcatJd(began) });
    } else if (began !== null && world !== at && world !== 'Sun') {
      const words = world === 'Earth' ? 'Back at Earth' : `Reaches ${place(world)}`;
      out.push({ name: words, meaning: words, jd: gcatJd(began) });
    }
    at = world;
    if (ended !== null && how === 'L') {
      const words = body === 'Earth' ? 'Home' : `Lands on ${place(body)}`;
      out.push({ name: words, meaning: words, jd: gcatJd(ended) });
    }
  });
  return out;
}

/** Within an hour, the same moment for craft flying together. */
const TOGETHER = 1 / 24;

/**
 * The mission's chapters, in order: a moment its craft share (Cassini and Huygens reaching
 * Saturn) told once; one a craft has alone (Eagle landing) under its name.
 */
function chaptersOf(craft: readonly Craft[]): MissionChapter[] {
  const each = craft.flatMap((one) =>
    craftMoments(one).map((moment) => ({ ...moment, who: one.name })),
  );
  each.sort((a, b) => a.jd - b.jd);
  const out: MissionChapter[] = [];
  const told = new Set<number>();
  each.forEach((moment, index) => {
    if (told.has(index)) return;
    let shared = false;
    each.forEach((other, k) => {
      if (k > index && other.name === moment.name && Math.abs(other.jd - moment.jd) <= TOGETHER) {
        told.add(k);
        shared = true;
      }
    });
    const alone = craft.length > 1 && !shared;
    out.push({
      name: alone ? `${moment.who}: ${moment.name}` : moment.name,
      meaning: moment.meaning,
      jd: moment.jd,
    });
  });
  return out;
}

/** When a craft's record ends: its last phase's end, or a year into a phase still open. */
function craftEnd(craft: Craft, today: number): number {
  const last = craft.phases.at(-1);
  if (last === undefined) return today;
  if (last[2] !== null) return gcatJd(last[2]);
  const began = last[1] === null ? today : gcatJd(last[1]);
  return Math.min(today, began + STILL_FLYING_DAYS);
}

/** How far a mission reached from the Sun, AU; null if it never left Earth's neighbourhood. */
function reachOf(craft: readonly Craft[]): number | null {
  const bodies = craft.flatMap(({ phases }) => phases.map(([body]) => body));
  if (!bodies.includes('Sun')) return null;
  let far = 1;
  for (const body of bodies) {
    if (body === 'Sun' || body === 'Earth' || body === 'Luna' || L_POINTS.has(body)) continue;
    far = Math.max(far, REACH[body] ?? ELSEWHERE_AU);
  }
  return far;
}

/** A launch's craft as one mission; null if none of them left. */
function missionOf(sent: readonly Craft[], today: number): Mission | null {
  const main = sent.filter((each) => !each.part);
  const craft = (main.length > 0 ? main : sent).filter(
    ({ phases }) => (phases[0]?.[1] ?? null) !== null,
  );
  const first = craft[0];
  if (first === undefined) return null;
  const chapters = chaptersOf(craft);
  const start = Math.min(...craft.map(({ phases }) => gcatJd(phases[0]?.[1] ?? '2000')));
  const end = Math.max(start + 1 / 24, ...craft.map((each) => craftEnd(each, today)));
  const reach = reachOf(craft);
  return {
    id: first.id.toLowerCase(),
    title: first.mission ?? first.name,
    craft,
    start,
    end,
    chapters,
    aboutEarth: reach === null,
    reach,
  };
}

/** Every mission in the record, by launch, earliest first. */
export function missions(craft: readonly Craft[], today: number): readonly Mission[] {
  const byLaunch = new Map<string, Craft[]>();
  for (const each of craft) {
    const sent = byLaunch.get(each.launchTag);
    if (sent === undefined) byLaunch.set(each.launchTag, [each]);
    else sent.push(each);
  }
  return [...byLaunch.values()]
    .map((sent) => missionOf(sent, today))
    .filter((mission) => mission !== null)
    .sort((a, b) => a.start - b.start);
}

/** The mission a link names, by any of its craft's ids. */
export function missionNamed(all: readonly Mission[], id: string): Mission | null {
  const wanted = id.toLowerCase();
  return (
    all.find((mission) => mission.craft.some((each) => each.id.toLowerCase() === wanted)) ?? null
  );
}

/** Earth's radius and the Sun's, km, and the farthest a view reaches (in Earth radii). */
const EARTH_KM = 6371;
const SUN_KM = 695_700;
const AU_KM = 149_597_870.7;
const FARTHEST_KM = 300_000 * EARTH_KM;
/** Above the ecliptic's north pole, as the Sun's camera names it: right ascension 270°,
 * declination 90° − 23.44°. */
const ABOVE_THE_PLANETS = '66.5607,-90.0000';

/** UT JD as a link's moment: "1977-08-20T19:37Z". */
function linkMoment(jd: number): string {
  return `${new Date((jd - 2_440_587.5) * 86_400_000).toISOString().slice(0, 16)}Z`;
}

/**
 * The view that frames a mission, as part of a link: at its start, the spacecraft on, it named;
 * about Earth from above its pole far enough out for the Moon or an L point, or about the Sun
 * from above the planets, out to a little past the farthest place it went.
 */
export function missionView(mission: Mission): string {
  const goesFar = mission.craft.some(({ phases }) => phases.some(([body]) => L_POINTS.has(body)));
  const camera =
    mission.reach === null
      ? `focus=earth&cam=89.0000,0.0000,${goesFar ? '700.00' : '200.00'}`
      : `focus=sun&cam=${ABOVE_THE_PLANETS},${(Math.min(mission.reach * 1.4 * AU_KM, FARTHEST_KM) / SUN_KM).toFixed(2)}`;
  return `${camera}&layers=spacecraft&mission=${mission.id}&t=${linkMoment(mission.start)}`;
}
