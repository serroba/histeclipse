/**
 * What the states have at one place, for "Why here?": Cliopatria's states drawn over it, read
 * back from the borders the map is drawn from. Pure.
 */

import type { Territory } from '../../data/empires';
import type { GeoPoint } from '../../state/viewState';
import { insideWrapped } from '../../util/polygons';
import type { HereFact } from '../../sources/registry';

/** The states drawn over a place. */
export function statesHere(territories: readonly Territory[], place: GeoPoint): Territory[] {
  return territories.filter((territory) =>
    insideWrapped(territory.rings, place.longitude, place.latitude),
  );
}

export interface StatesInput {
  readonly place: GeoPoint;
  /** The year shown, in words. */
  readonly yearText: string;
  /** The states layer, if on: whose borders, and Cliopatria's states of the year shown. */
  readonly states: {
    readonly source: 'cliopatria' | 'ohm' | 'both';
    readonly territories: readonly Territory[] | null;
    /** The year Cliopatria's borders are of, in words, when not the year shown. */
    readonly asOf: string | null;
  } | null;
}

/** What the states have at the place, from the borders they are drawn from. */
export function statesFacts(input: StatesInput): HereFact[] {
  const facts: HereFact[] = [];
  const { states } = input;
  if (states !== null && states.source !== 'ohm') {
    const found = states.territories === null ? null : statesHere(states.territories, input.place);
    const when = states.asOf ?? input.yearText;
    facts.push(
      found === null
        ? { title: 'States', text: 'Cliopatria’s borders are loading.', why: 'empires-cliopatria' }
        : found.length === 0
          ? {
              title: 'States',
              text: `Cliopatria draws no state here in ${when}. It maps states, not every people: land with no state drawn was not empty.`,
              why: 'empires-cliopatria',
            }
          : {
              title: 'States',
              text: `Cliopatria draws ${found.map(({ name }) => name).join(' and ')} here in ${when}.`,
              why: 'empires-cliopatria',
              ...(found[0] === undefined || found[0].wikipedia === ''
                ? {}
                : {
                    link: {
                      label: `${found[0].wikipedia} on Wikipedia`,
                      href: `https://en.wikipedia.org/wiki/${encodeURIComponent(found[0].wikipedia.replaceAll(' ', '_'))}`,
                    },
                  }),
            },
    );
  }
  if (states !== null && states.source !== 'cliopatria') {
    facts.push({
      title: 'States',
      text: 'OpenHistoricalMap’s borders come as lines and names, not areas, so the state under a point is not looked up: see the names nearby.',
      why: 'empires-ohm',
    });
  }
  return facts;
}
