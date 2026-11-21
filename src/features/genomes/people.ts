/**
 * The people of the AADR (#1059), loaded file by file as cards need them and kept: a region's
 * card waits for the files of its rows, and shows without them if they cannot be had.
 */

import { peopleFilesFor, type AncientGenomes } from '../../data/ancientGenomes';
import { loadPeople, peopleAt, type PersonAt } from '../../data/genomePeople';
import type { Fetch } from '../../util/fetchJson';

type People = Awaited<ReturnType<typeof loadPeople>>;

/** How to have the people on some rows of the genomes file: from files loaded once each. */
export function peopleLoader(
  base: string,
  fetchJson: Fetch,
): (data: AncientGenomes, rows: readonly number[]) => Promise<PersonAt> {
  const files = new Map<number, Promise<People>>();
  const file = (n: number): Promise<People> => {
    const known = files.get(n);
    if (known !== undefined) return known;
    const loading = loadPeople(`${base}data/genomes/people/${String(n)}.json`, fetchJson);
    files.set(n, loading);
    // Not kept when it fails, so the next card asks again.
    loading.catch(() => files.delete(n));
    return loading;
  };
  return (data, rows) =>
    Promise.all(peopleFilesFor(data, rows).map(file)).then(peopleAt, () => () => undefined);
}
