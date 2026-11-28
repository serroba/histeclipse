/**
 * The files an animal's story is told from, each asked for once: a group's genera and their
 * sites when its first story is asked for, and with the first of them the animals' pictures and
 * the continents' doors. A story is told without the pictures and the doors until they come.
 */

import { loadLife, LIFE_GROUPS, type LifeData, type LifeGroup } from '../../data/lifeStories';
import { errorMessage } from '../../util/errors';
import type { Fetch } from '../../util/fetchJson';
import { loadLifeDoors, type LifeDoors } from './lifeDoors';
import { loadLifePictures, type LifePictures } from './lifePictures';

export interface LifeFiles {
  /** A group's file: loaded, on its way (asked for now if it was not), or failed. */
  readonly group: (id: LifeGroup) => LifeData | 'loading' | 'failed';
  /** A group's file, as a promise. */
  readonly load: (id: LifeGroup) => Promise<LifeData>;
  /** Every group's file, for finding an animal in any. */
  readonly all: () => Promise<readonly LifeData[]>;
  readonly pictures: () => LifePictures | null;
  readonly doors: () => LifeDoors | null;
}

export function createLifeFiles(context: {
  readonly base: string;
  readonly fetchJson: Fetch;
  readonly notify: (message: string) => void;
  /** A file has arrived, or failed: what is shown should be shown again. */
  readonly arrived: () => void;
}): LifeFiles {
  const folder = `${context.base}data/life-stories/`;
  const asked = new Map<LifeGroup, Promise<LifeData>>();
  const loaded = new Map<LifeGroup, LifeData>();
  const failed = new Set<LifeGroup>();
  let pictures: LifePictures | null = null;
  let doors: LifeDoors | null = null;
  let extrasAsked = false;

  /** A file kept when it comes, and the reader told if it does not; either way shown again. */
  function keep<T>(file: Promise<T>, what: string, take: (value: T) => void): void {
    file
      .then(take, (error: unknown) => {
        context.notify(`Could not load ${what}: ${errorMessage(error)}`);
      })
      .finally(context.arrived);
  }

  function wantExtras(): void {
    if (extrasAsked) return;
    extrasAsked = true;
    keep(
      loadLifeDoors(`${folder}doors.json`, context.fetchJson),
      'the continents’ doors',
      (found) => {
        doors = found;
      },
    );
    keep(
      loadLifePictures(`${folder}pictures.json`, context.fetchJson),
      'the animals’ pictures',
      (found) => {
        pictures = found;
      },
    );
  }

  function load(id: LifeGroup): Promise<LifeData> {
    wantExtras();
    const before = asked.get(id);
    if (before !== undefined) return before;
    const file = loadLife(`${folder}${id}.json`, context.fetchJson);
    asked.set(id, file);
    file.then(
      (data) => {
        loaded.set(id, data);
        context.arrived();
      },
      (error: unknown) => {
        failed.add(id);
        context.notify(`Could not load the animals’ stories: ${errorMessage(error)}`);
        context.arrived();
      },
    );
    return file;
  }

  return {
    group(id) {
      const data = loaded.get(id);
      if (data !== undefined) return data;
      if (failed.has(id)) return 'failed';
      load(id).catch(() => undefined);
      return 'loading';
    },
    load,
    all: () => Promise.all(LIFE_GROUPS.map(load)),
    pictures: () => pictures,
    doors: () => doors,
  };
}
