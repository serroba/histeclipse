/**
 * All subjects (#750): every layer the site draws, found in Explore under its topic, so nothing
 * falls back to knowing Layers. Built from the layer catalogue Layers itself uses, not a second
 * list: a layer added there is a subject here. Picking one turns it on and, where it draws
 * nothing at the moment shown, goes where its data is: an explicit navigation, as a destination
 * is, never a side effect of a layer toggle.
 */

import { LAYER_GROUPS, type LayerChoice } from '../state/layerCatalog';
import type { Layer, Span } from '../state/viewState';
import { LAST_GLACIAL_MAXIMUM_MA } from '../state/viewState';
import type { Topic } from './destinations';

/** The catalogue's groups are named as the topics are (#728). */
const GROUP_TOPICS: Readonly<Record<string, Topic>> = {
  People: 'people',
  Earth: 'earth',
  Life: 'life',
  Climate: 'climate',
  Space: 'space',
};

export interface Subject {
  readonly layer: Layer;
  readonly label: string;
  readonly about: string;
  readonly reach: string;
}

/** Each topic's subjects, in the catalogue's order. */
export function subjectsIn(topic: Topic): Subject[] {
  return LAYER_GROUPS.filter((group) => GROUP_TOPICS[group.name] === topic).flatMap((group) =>
    group.layers.map(({ id, label, about, reach }) => ({ layer: id, label, about, reach })),
  );
}

/** The topic a catalogue group belongs to, if its name is a topic's. */
export function groupTopic(name: string): Topic | undefined {
  return GROUP_TOPICS[name];
}

/** Where each deep span opens a subject without a moment of its own. */
const SPAN_MOMENTS: Readonly<Record<Exclude<Span, 'years'>, number>> = {
  ice: LAST_GLACIAL_MAXIMUM_MA,
  all: 66,
  eons: 2500,
};

const CHOICES: ReadonlyMap<Layer, LayerChoice> = new Map(
  LAYER_GROUPS.flatMap((group) => group.layers.map((choice) => [choice.id, choice] as const)),
);

/** The span a link shows: the years, or the deep scale it names. */
function spanOf(params: URLSearchParams): Span {
  if (params.get('ma') === null) return 'years';
  const scale = params.get('scale');
  return scale === 'ice' || scale === 'eons' ? scale : 'all';
}

/**
 * The link picking `layer` gives: the reader's, with the layer on; where it draws nothing on the
 * span shown, at the first span it draws on (at its own moment there, if it has one).
 */
export function subjectQuery(layer: Layer, current: string): string {
  const params = new URLSearchParams(current);
  const layers = new Set((params.get('layers') ?? '').split(',').filter(Boolean));
  layers.add(layer);
  params.set('layers', [...layers].join(','));
  const choice = CHOICES.get(layer);
  const span = spanOf(params);
  const to = choice?.spans[0];
  if (choice !== undefined && to !== undefined && !choice.spans.includes(span)) {
    if (to === 'years') {
      params.delete('ma');
      params.delete('scale');
    } else {
      params.set('ma', String(choice.arrive?.ma ?? SPAN_MOMENTS[to]));
      params.set('scale', to);
    }
  }
  return params.toString().replaceAll('%2C', ',').replaceAll('%3A', ':');
}
