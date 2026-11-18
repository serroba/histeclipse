/**
 * Destinations (#726): named views worth arriving at, found by topic rather than by span
 * (docs/navigation.md). Each is data: its view is a link's query, opened like a search anchor's
 * (`anchorQuery`): where it looks, when, and what is open replace the reader's; their display
 * settings stay; its layers are added to theirs. Nothing here loads a dataset: a destination's
 * layers load their own data once the view turns them on.
 */

import type { Body } from '../state/viewState';
import { PRESENT_YEAR } from '../time/present';
import { anchorQuery } from '../text/anchors';
import type { TimeFrame } from './frame';
import type { Anchor } from '../text/passages';

/** What Explore groups destinations by; a destination may sit under several. */
export const TOPICS = ['space', 'earth', 'life', 'people', 'climate'] as const;
export type Topic = (typeof TOPICS)[number];

export interface Destination {
  /** Stable: links carry it as `explore=<id>`. */
  readonly id: string;
  readonly label: string;
  readonly topics: readonly Topic[];
  /** One or two sentences: what the view shows. */
  readonly description: string;
  /** Questions the view answers, as a visitor might ask them. */
  readonly questions: readonly string[];
  /** The body the view is of. */
  readonly body: Body;
  /** The view it opens: a link's query, as a search anchor's `view`. */
  readonly view: string;
  /** The time worth seeing it over (#729); its view's moment lies inside. */
  readonly frame: TimeFrame;
}

export const DESTINATIONS: readonly Destination[] = [
  {
    id: 'gravitational-waves',
    label: 'A gravitational wave',
    topics: ['space'],
    description:
      'GW150914, the first gravitational wave heard, 14 September 2015: a ring of free masses and the space about it stretched and squeezed as it passes.',
    questions: ['What does a gravitational wave do to space?', 'What did LIGO detect?'],
    body: 'earth',
    frame: { kind: 'years', from: 2015, to: 2016 },
    view: 'cam=30.5630,-90.7740,3.00&t=2015-09-14T09:50Z&wave=gw150914',
  },
  {
    id: 'moon-landings',
    label: 'Moon landings',
    topics: ['space'],
    description:
      'Apollo 11 coming down in the Sea of Tranquillity, 20 July 1969; search finds every other mission and landing.',
    questions: ['Where did people first walk on the Moon?'],
    body: 'moon',
    frame: { kind: 'years', from: 1969, to: 1972 },
    view: 'focus=moon&cam=0.6875,23.4333,1.80&layers=spacecraft&mission=d00273&t=1969-07-20T20:17Z',
  },
  {
    id: 'space-age',
    label: 'The space age',
    topics: ['space'],
    description:
      'Every craft sent beyond Earth orbit, from Luna 1 in January 1959, flying among the planets as time plays.',
    questions: ['What was the first craft to leave Earth?'],
    body: 'sun',
    frame: { kind: 'years', from: 1959, to: PRESENT_YEAR },
    view: 'focus=sun&cam=66.5607,-90.0000,301.05&layers=spacecraft,orbits&t=1959-01-02T16:41Z',
  },
  {
    id: 'ozone-hole',
    label: 'The ozone hole',
    topics: ['climate'],
    description:
      'The ozone layer as a surface round the Earth, the hole an opening over Antarctica on its widest day in 2006; its own bar plays the years it has data for, 1970 to 2025.',
    questions: ['What does the ozone hole look like?', 'Is the ozone hole closing?'],
    body: 'earth',
    frame: { kind: 'years', from: 1970, to: 2025 },
    view: 'cam=-60.0000,40.0000,3.40&layers=ozone&t=2006-09-22T12:00Z',
  },
  {
    id: 'human-origins',
    label: 'Human origins',
    topics: ['people', 'life'],
    description:
      'Dated finds of our species and its relatives, from Jebel Irhoud about 315,000 years ago, with competing dates side by side.',
    questions: ['Where were the first Homo sapiens?', 'When did people leave Africa?'],
    body: 'earth',
    frame: { kind: 'ma', from: 0.32, to: 0.04 },
    view: 'ma=0.315&scale=ice&layers=humans&cam=10.0000,5.0000,3.00',
  },
  {
    id: 'ancient-dna',
    label: 'Ancient DNA',
    topics: ['people'],
    description:
      'Dated ancient genomes counted by region around the year shown, here 3000 BCE, as herders spread across the steppe.',
    questions: ['Where has ancient DNA been read from people of 5,000 years ago?'],
    body: 'earth',
    frame: { kind: 'years', from: -4999, to: -999 },
    view: 't=-2999-06-01T12:00Z&layers=genomes&cam=50.0000,40.0000,3.00',
  },
  {
    id: 'states-and-empires',
    label: 'States and empires',
    topics: ['people'],
    description:
      'Borders of states through history; here the Roman Empire at its largest, in 117 CE, and its neighbours.',
    questions: ['How far did the Roman Empire reach?'],
    body: 'earth',
    frame: { kind: 'years', from: -3399, to: PRESENT_YEAR },
    view: 't=0117-08-01T12:00Z&layers=empires&cam=40.0000,20.0000,3.00',
  },
  {
    id: 'ancient-australia',
    label: 'Ancient Australia',
    topics: ['earth', 'life'],
    description:
      'Australia 100 million years ago, still joined to Antarctica far to the south, with the fossils found from that time.',
    questions: ['Where was Australia when dinosaurs lived?'],
    body: 'earth',
    // Where the plates had central Australia (Gosses Bluff) 100 million years ago (PALEOMAP).
    frame: { kind: 'ma', from: 120, to: 80 },
    view: 'ma=100&scale=all&layers=plates,fossils&cam=-46.3300,122.8100,3.00',
  },
  {
    id: 'moving-continents',
    label: 'Moving continents',
    topics: ['earth'],
    description:
      'Pangaea 250 million years ago, the continents in one, and the plates that carried them apart.',
    questions: ['What did Earth look like when the continents were one?'],
    body: 'earth',
    frame: { kind: 'ma', from: 300, to: 180 },
    view: 'ma=250&scale=all&layers=plates&cam=0.0000,20.0000,3.00',
  },
  {
    id: 'age-of-dinosaurs',
    label: 'The age of dinosaurs',
    topics: ['life'],
    description:
      'The last dinosaurs, 70 million years ago: where their fossils and their neighbours’ have been found and recorded.',
    questions: ['Where have the last dinosaurs been found?'],
    body: 'earth',
    frame: { kind: 'ma', from: 80, to: 66 },
    view: 'ma=70&scale=all&layers=fossils&cam=40.0000,-100.0000,3.00',
  },
  {
    id: 'last-ice-age',
    label: 'The last ice age',
    topics: ['climate', 'earth'],
    description:
      'The Last Glacial Maximum, 21,000 years ago: ice sheets over North America and Europe, and the sea about 120 m lower.',
    questions: ['How far did the ice reach 21,000 years ago?'],
    body: 'earth',
    frame: { kind: 'ma', from: 0.03, to: 0.015 },
    view: 'ma=0.021&scale=ice&layers=sealevel&cam=55.0000,-40.0000,3.00',
  },
  {
    id: 'hothouse-earth',
    label: 'A hothouse Earth',
    topics: ['climate'],
    description:
      'The Paleocene–Eocene Thermal Maximum, 56 million years ago: one of the warmest times since the dinosaurs.',
    questions: ['How warm has Earth been?'],
    body: 'earth',
    frame: { kind: 'ma', from: 60, to: 50 },
    view: 'ma=56&scale=all&layers=temperature&cam=20.0000,0.0000,3.00',
  },
];

/** The destination with this id, if there is one. */
export function destinationById(id: string): Destination | undefined {
  return DESTINATIONS.find((destination) => destination.id === id);
}

/** The destinations under a topic, in the registry's order. */
export function destinationsIn(topic: Topic): Destination[] {
  return DESTINATIONS.filter((destination) => destination.topics.includes(topic));
}

/** A destination as an anchor to open: its view, saying which destination it is. */
export function destinationAnchor(destination: Destination): Anchor {
  return {
    body: destination.body,
    label: destination.label,
    view: `${destination.view}&explore=${destination.id}`,
  };
}

/**
 * The link to open: for a link naming a destination and no view of its own (no `t`, `ma` or
 * `cam`), the destination's view laid over it, as opening it would; any other link as it is.
 */
export function arrivalSearch(search: string): string {
  const params = new URLSearchParams(search);
  const id = params.get('explore');
  if (id === null || ['t', 'ma', 'cam'].some((key) => params.has(key))) return search;
  const destination = destinationById(id);
  if (destination === undefined) return search;
  return `?${anchorQuery(destinationAnchor(destination), params.toString())}`;
}
