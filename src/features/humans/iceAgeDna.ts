/**
 * The ice-age DNA sites of the Humans layer (#1059): the AADR's people, gathered by place once
 * their file has come, marked from their oldest person's date on, and each place's card. Only
 * our own species: none while the reader shows only another; all while only DNA.
 */

import type { HumanSite, HumansShown } from '../../data/humanClaims';
import {
  dnaCard,
  dnaPlaces,
  dnaSitesAt,
  type DnaPlace,
  type IceAgeGenomes,
} from '../../data/iceAgeGenomes';
import type { Lazy } from './lazy';

export interface IceAgeDna {
  /** The DNA sites to mark `ka` thousand years ago, and how many people they hold by then. */
  at(ka: number, only: HumansShown): { sites: readonly HumanSite[]; people: number };
  card(id: string): ReturnType<typeof dnaCard>;
}

export function iceAgeDna(file: Lazy<IceAgeGenomes>): IceAgeDna {
  let gathered: { from: IceAgeGenomes; places: readonly DnaPlace[] } | null = null;
  const places = (): readonly DnaPlace[] | null => {
    const data = file.value;
    if (data === null) return null;
    if (gathered?.from !== data) gathered = { from: data, places: dnaPlaces(data) };
    return gathered.places;
  };
  return {
    at(ka, only) {
      file.ask();
      const all = places();
      const ours = only === 'all' || only === 'sapiens' || only === 'dna';
      if (all === null || !ours) return { sites: [], people: 0 };
      const sites = dnaSitesAt(all, ka);
      const people = all
        .flatMap((place) => place.entries)
        .filter((entry) => entry.bp / 1000 >= ka).length;
      return { sites, people };
    },
    card(id) {
      const all = places();
      return all === null || file.value === null ? null : dnaCard(file.value, all, id);
    },
  };
}
