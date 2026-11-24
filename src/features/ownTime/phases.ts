/**
 * An event's phases on its own clock (#1173, #1191): what was happening from when, and whose
 * studies say so. Chicxulub's are the impacts'; the end-Permian's, the extinctions'.
 *
 * Pure.
 */

import { SOURCES, type SourceId } from '../../sources/registry';

export interface EventPhase {
  readonly id: string;
  /** Seconds after the event it begins (negative: before). */
  readonly from: number;
  readonly title: string;
  readonly text: string;
  readonly sources: readonly { readonly name: string; readonly url: string }[];
}

/** The phase showing at `seconds` since the event: the last to have begun by then. */
export function phaseAt(phases: readonly EventPhase[], seconds: number): EventPhase | undefined {
  let found: EventPhase | undefined;
  for (const phase of phases) if (phase.from <= seconds) found = phase;
  return found;
}

/** A phase, its sources looked up in the registry. */
export function phase(
  id: string,
  from: number,
  title: string,
  text: string,
  sources: readonly SourceId[],
): EventPhase {
  return {
    id,
    from,
    title,
    text,
    sources: sources.map((source) => ({ name: SOURCES[source].name, url: SOURCES[source].url })),
  };
}
