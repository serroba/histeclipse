/**
 * What life through time says and how it moves (#358, #601), worked out apart from the page:
 * a span of time in words, a name's rank and family, how many genera a group holds, the line
 * under the tree for the moment shown, the playhead's step, and the zoom about a point. Pure and
 * unit-tested; the sheet is `lineagesSheet.ts`.
 */

import { ancestry, isGenus, isWithin, type Lineage, type Lineages } from '../../data/lineages';

/** Seconds to play a group from its first line to its last. */
const PLAY_SECONDS = 24;

/** A time in millions of years: whole from 10, else to a tenth. */
export function formatMa(ma: number): string {
  return ma >= 10 ? String(Math.round(ma)) : String(Math.round(ma * 10) / 10);
}

/** "from 227 million years ago to 66", or "… to today". */
export function span(first: number, last: number): string {
  const from = `${formatMa(first)} million years ago`;
  return last <= 0 ? `from ${from} to today` : `from ${from} to ${formatMa(last)}`;
}

export function capital(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** A rank as it is said: a clade is a group. */
export function rankWord(rank: string): string {
  return rank === 'clade' ? 'group' : rank;
}

/** The nearest family above a genus, or its parent's name if none is a family. */
export function familyOf(lineages: Lineages, index: number): string {
  const line = ancestry(lineages, index);
  const family = [...line].reverse().find((node) => node.rank === 'family');
  return family?.name ?? line.at(-2)?.name ?? '';
}

/** How many of `genera` lie within the node at `index`. */
export function generaWithin(lineages: Lineages, genera: readonly number[], index: number): number {
  return genera.filter((genus) => isWithin(lineages, genus, index)).length;
}

/** What a name is, for its tooltip: a genus's family and species, or a group's size. */
export function tipKind(lineages: Lineages, genera: readonly number[], node: Lineage): string {
  return isGenus(node)
    ? `${familyOf(lineages, node.index) || 'Genus'} · ${String(node.species)} species`
    : `${capital(rankWord(node.rank))} of ${String(generaWithin(lineages, genera, node.index))} genera`;
}

/** What a name picked is, under the tree: a genus's species named, or a group's genera here. */
export function pickedKind(lineages: Lineages, genera: readonly number[], node: Lineage): string {
  return isGenus(node)
    ? `Genus, ${String(node.species)} species named`
    : `${capital(rankWord(node.rank))} of ${String(generaWithin(lineages, genera, node.index))} genera here`;
}

/** The moment shown and the genera living then: the line beside the slider, and the map's caption. */
export function momentWords(
  at: number,
  living: number,
): { readonly line: string; readonly caption: string } {
  const when = at < 0.5 ? 'Today' : `${String(Math.round(at))} million years ago`;
  const genera = living === 1 ? '1 genus' : `${living.toLocaleString('en')} genera`;
  return {
    line: `${when} · ${genera} living`,
    caption: `The world ${when === 'Today' ? 'today' : when}, and where the ${genera} then living were found: filled in these 5 million years, a ring where last found`,
  };
}

/**
 * The playhead `seconds` on from `at`, playing from `oldest` to `youngest` in PLAY_SECONDS; and
 * whether it plays on, or has reached the end.
 */
export function playStep(
  at: number,
  oldest: number,
  youngest: number,
  seconds: number,
): { readonly at: number; readonly playing: boolean } {
  const next = at - ((oldest - youngest) / PLAY_SECONDS) * seconds;
  return { at: next, playing: next > youngest };
}

/** How the tree is zoomed: a scale from 1 to 40, and how far it is moved, in pixels. */
export interface Zoom {
  readonly zoom: number;
  readonly panX: number;
  readonly panY: number;
}

/** Zoom by `factor` about (x, y), keeping the point there where it is; at 1, centred again. */
export function zoomAbout(
  now: Zoom,
  x: number,
  y: number,
  factor: number,
  middle: { readonly x: number; readonly y: number },
): Zoom {
  const zoom = Math.min(40, Math.max(1, now.zoom * factor));
  if (zoom === 1) return { zoom, panX: 0, panY: 0 };
  const applied = zoom / now.zoom;
  return {
    zoom,
    panX: x - middle.x - (x - middle.x - now.panX) * applied,
    panY: y - middle.y - (y - middle.y - now.panY) * applied,
  };
}
