/**
 * "Why here?": what each layer on the map has at one place, said plainly, each fact tied to the
 * why of its source. The map is drawn from these same records; this reads them back for a point.
 *
 * Pure; the panel that shows it is `ui/whySheet.ts`.
 */

import type { Territory } from '../data/empires';
import type { RockUnit } from '../data/rocks';
import { WAY_NAMES, type WaysAt } from '../data/waysOfLife';
import type { GeoPoint } from '../state/viewState';
import { insideWrapped } from '../util/polygons';
import type { WhyId } from './registry';

export interface HereFact {
  /** What layer the fact is from. */
  readonly title: string;
  readonly text: string;
  /** The why of where it comes from. */
  readonly why: WhyId;
  readonly link?: { readonly label: string; readonly href: string };
}

/** A place in words: 36.4°N 43.2°E. */
export function placeText(place: GeoPoint): string {
  const lat = `${Math.abs(place.latitude).toFixed(1)}°${place.latitude < 0 ? 'S' : 'N'}`;
  const lon = `${Math.abs(place.longitude).toFixed(1)}°${place.longitude < 0 ? 'W' : 'E'}`;
  return `${lat} ${lon}`;
}

/** The states drawn over a place. */
export function statesHere(territories: readonly Territory[], place: GeoPoint): Territory[] {
  return territories.filter((territory) =>
    insideWrapped(territory.rings, place.longitude, place.latitude),
  );
}

const LEVEL_WORDS = { 1: 'present but minimal', 2: 'common', 3: 'widespread' } as const;

export interface HereInput {
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
  /** The ways of life of the moment rated nearest, if the layer is on and loaded. */
  readonly ways: { readonly at: WaysAt; readonly momentText: string } | null;
  /** The rock unit at the place, if the layer is on and loaded. */
  readonly rock: RockUnit | null | undefined;
}

/** What each layer on the map has at the place, from the records it is drawn from. */
export function hereFacts(input: HereInput): HereFact[] {
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
  if (input.ways !== null) {
    const { at, momentText } = input.ways;
    const region = at.regions.find((each) =>
      insideWrapped(each.rings, input.place.longitude, input.place.latitude),
    );
    facts.push(
      region === undefined
        ? {
            title: 'Ways of life',
            text: `ArchaeoGLOBE rates no region here for ${momentText}.`,
            why: 'ways',
          }
        : {
            title: 'Ways of life',
            text: `${region.name}: ${region.ways.map((way) => WAY_NAMES[way]).join(' and ')}, ${LEVEL_WORDS[region.level]}, as archaeologists rated it for ${momentText}.`,
            why: 'ways',
          },
    );
  }
  if (input.rock !== undefined) {
    facts.push(
      input.rock === null
        ? { title: 'Rocks', text: 'No map unit of Macrostrat’s here.', why: 'rocks' }
        : {
            title: 'Rocks',
            text: `${input.rock.name}: ${input.rock.lith}, from ${String(input.rock.bottomMa)} to ${String(input.rock.topMa)} million years ago.`,
            why: 'rocks',
          },
    );
  }
  return facts;
}
