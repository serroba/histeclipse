/**
 * A layer as the reader is offered it (#380): its id, its name, what it shows, the spans of time
 * it draws on and how far its data reaches. Each layer has a file of its own here, below the
 * view's state, so the URL, the Layers panel and the search read one description; how it is
 * drawn is its feature's, in `src/features`.
 */

import type { Span } from '../deepTime/scale';
import type { WhyId } from '../sources/registry';

/** The times a layer's data covers (#751). */
export interface Coverage {
  readonly years?: readonly [number, number];
  readonly oldestMa?: number;
  readonly gaps?: readonly number[];
}

export interface LayerEntry<Id extends string = string> {
  readonly id: Id;
  readonly label: string;
  readonly about: string;
  /** The spans of time it draws on. */
  readonly spans: readonly Span[];
  /** How far its data reaches, said where it draws nothing. */
  readonly reach: string;
  /** Where going to its span lands, when somewhere is better than the span's present end. */
  readonly arrive?: { readonly ma: number; readonly label: string };
  /**
   * The times its data covers within its spans (#751), as its files reach: astronomical years in
   * the years, the oldest million years ago it reaches in deep time, and years it has none for.
   * Absent where the layer covers all of its spans.
   */
  readonly covers?: Coverage;
  /** A list of its own to find its things in (#850): its chip opens it. */
  readonly list?: true;
  /**
   * Its icon beside its name: path data in the site's style, a 24-unit box drawn in 1.7 strokes
   * (see `ui/icons`).
   */
  readonly icon: readonly string[];
  /** Where it comes from: its why in the sources registry. */
  readonly why: WhyId;
}

/** A layer's entry, its id kept as written: the ids together are the `Layer` type. */
export function layer<const Id extends string>(entry: LayerEntry<Id>): LayerEntry<Id> {
  return entry;
}
