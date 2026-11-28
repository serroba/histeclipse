/**
 * The doors in an animal's story: when its lineage is first found on a new
 * continent, whether land joined that continent to one it was already found on, by which way,
 * as the elevation maps have it. And the doors worth a row in its chart: those between the
 * lands it was ever found on.
 *
 * A door open is a way it could have walked, not proof that it did; a door shut on the maps is
 * a crossing of water, a join too narrow for the maps, or finds still to be made.
 */

import { APART, doorAt, LAND, SHELF, type Door, type DoorState, type LifeDoors } from './lifeDoors';
import type { Chapter } from './chapters';
import type { Story } from './story';
import { listed } from './words';

/** The way from lands already reached to a new one. */
export interface Way {
  readonly state: DoorState;
  /** The lands walked through, from one already reached to the new one, by name. */
  readonly through: readonly string[];
}

/**
 * The shortest way from any of `from` to `to` over doors open at `ma`: by land if there is
 * one, else letting shallow seas count; apart if neither.
 */
export function wayTo(doors: LifeDoors, ma: number, from: ReadonlySet<number>, to: number): Way {
  return walk(doors, ma, from, to, LAND) ?? walk(doors, ma, from, to, SHELF) ?? APART_WAY;
}

const APART_WAY: Way = { state: APART, through: [] };

/** The lands a door open at least `least` wide leads to from `land`. */
function neighbours(doors: LifeDoors, ma: number, land: number, least: DoorState): number[] {
  return doors.doors.flatMap((door) => {
    if (doorAt(doors, door, ma) < least) return [];
    if (door.a === land) return [door.b];
    return door.b === land ? [door.a] : [];
  });
}

/** The shortest way over doors open at least `least` wide, breadth first; null if none. */
function walk(
  doors: LifeDoors,
  ma: number,
  from: ReadonlySet<number>,
  to: number,
  least: typeof LAND | typeof SHELF,
): Way | null {
  const before = new Map<number, number | null>([...from].map((land) => [land, null]));
  const queue = [...from];
  for (const land of queue) {
    if (land === to) {
      const through: string[] = [];
      for (let back: number | null = land; back !== null; back = before.get(back) ?? null) {
        through.unshift(doors.lands[back] ?? '');
      }
      return { state: least, through };
    }
    for (const next of neighbours(doors, ma, land, least)) {
      if (before.has(next)) continue;
      before.set(next, land);
      queue.push(next);
    }
  }
  return null;
}

function said(doors: LifeDoors, way: Way, when: string): string {
  const [start, ...rest] = way.through;
  const by = rest.length > 1 ? `, by way of ${listed(rest.slice(0, -1))}` : '';
  if (way.state === LAND) return ` Land joined it to ${start ?? ''} ${when}${by}.`;
  if (way.state === SHELF) {
    return ` Only shallow sea (under about ${String(doors.shelfMetres)} m) lay between it and ${start ?? ''} ${when}${by}.`;
  }
  return ' On the maps, sea lay between it and every land they were already found on: a crossing of water, a join too narrow for the maps, or finds still to be made.';
}

/**
 * The story with its doors: each "First found in…" moment says whether land joined the new
 * continent to one already reached, then or in the step before (when the way there was made).
 */
export function withDoors(story: Story, doors: LifeDoors): Story {
  const reached = new Set<number>();
  const chapters = new Map<Chapter, string>();
  story.steps.forEach((step, at) => {
    const fresh = step.byRegion.flatMap((count, region) =>
      count > 0 && !reached.has(region) ? [region] : [],
    );
    if (at > 0 && fresh.length > 0) {
      const chapter = story.chapters.find(
        (each) => each.ma === step.ma && each.title.startsWith('First found in'),
      );
      const [first] = fresh;
      if (chapter !== undefined && first !== undefined) {
        const now = wayTo(doors, step.ma, reached, first);
        const earlier = wayTo(doors, step.ma + story.data.stepMa, reached, first);
        const way = earlier.state > now.state ? earlier : now;
        chapters.set(
          chapter,
          said(doors, way, way === now ? 'then' : 'in the 5 million years before'),
        );
      }
    }
    for (const region of fresh) reached.add(region);
  });
  return {
    ...story,
    chapters: story.chapters.map((chapter) => {
      const more = chapters.get(chapter);
      return more === undefined ? chapter : { ...chapter, text: chapter.text + more };
    }),
  };
}

export interface DoorRow {
  readonly door: Door;
  readonly name: string;
  /** Its state at each of the story's steps, oldest first. */
  readonly states: readonly DoorState[];
}

/** The doors between lands the story has finds on, that were ever other than apart in it. */
export function doorRows(story: Story, doors: LifeDoors): readonly DoorRow[] {
  const found = new Set(
    story.data.regions.flatMap((_, region) =>
      story.steps.some((step) => (step.byRegion[region] ?? 0) > 0) ? [region] : [],
    ),
  );
  return doors.doors.flatMap((door) => {
    if (!found.has(door.a) || !found.has(door.b)) return [];
    const states = story.steps.map((step) => doorAt(doors, door, step.ma));
    if (states.every((state) => state === APART)) return [];
    return [{ door, name: `${doors.lands[door.a] ?? ''} – ${doors.lands[door.b] ?? ''}`, states }];
  });
}

/** The doors of a story's chart open at a moment, by name: by land, and by shallow sea. */
export function openAt(
  rows: readonly DoorRow[],
  at: number,
): { readonly land: readonly string[]; readonly shelf: readonly string[] } {
  return {
    land: rows.filter((row) => row.states[at] === LAND).map((row) => row.name),
    shelf: rows.filter((row) => row.states[at] === SHELF).map((row) => row.name),
  };
}
