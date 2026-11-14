/**
 * Related discoveries (#731): a few curated next views from an object's card, each saying where
 * it goes and any change of time. Only what the data supports: a crater whose age is known and
 * whose place then the plates give, a find in the ice ages, a fossil's moment, a craft's
 * mission. Kept short: at most two from any card.
 */

import type { Anchor } from '../text/passages';
import { formatMa } from '../time/format';
import { destinationAnchor, destinationById } from './destinations';

/** A next view: what it is, and where it goes, in words. */
export interface Related {
  readonly label: string;
  readonly explain: string;
}

/** Deep time's reconstructions, where a crater's place then is known: the last 540 Myr. */
const RECONSTRUCTED_MA = 540;

/** Close enough to a crater's age that the reader is already there. */
const THERE_MA = 5;

/**
 * From a crater: the Earth when it struck, at the middle of its dated range, if that range is
 * known, within the reconstructions, and not where the reader already is.
 */
export function whenItStruck(
  olderMa: number | null,
  youngerMa: number | null,
  shownMa: number | null,
): (Related & { readonly ma: number }) | null {
  if (olderMa === null || youngerMa === null) return null;
  const ma = Math.round(((olderMa + youngerMa) / 2) * 10) / 10;
  if (ma > RECONSTRUCTED_MA) return null;
  if (shownMa !== null && Math.abs(shownMa - ma) <= THERE_MA) return null;
  const range =
    olderMa === youngerMa ? '' : ` (dated ${formatMa(olderMa)} to ${formatMa(youngerMa)})`;
  return {
    ma,
    label: 'Earth when it struck',
    explain: `Goes to ${formatMa(ma)}${range}, the crater where the plates had it.`,
  };
}

/** From a human find in the ice ages: the dispersal models (unless drawn), and ancient DNA. */
export function fromAFind(dispersalOn: boolean): {
  readonly spread: Related | null;
  readonly dna: Related;
} {
  return {
    spread: dispersalOn
      ? null
      : {
          label: 'People spreading out of Africa',
          explain: 'Same moment, with a model of the dispersal drawn; two models to compare.',
        },
    dna: {
      label: 'Ancient DNA near here',
      explain: 'Goes to 3000 BCE, in the years, with ancient genomes counted by region.',
    },
  };
}

/** From a fossil: the climate of its time, at the same moment. */
export function fromAFossil(temperatureOn: boolean): Related[] {
  return temperatureOn
    ? []
    : [
        {
          label: 'The climate then',
          explain: 'Same moment, the surface coloured by its temperature.',
        },
      ];
}

/** From a craft: its mission's journey, unless it is the one followed. */
export function fromACraft(missionTitle: string, followed: boolean, start: string): Related[] {
  return followed
    ? []
    : [
        {
          label: `Follow ${missionTitle}`,
          explain: `Goes to ${start}, its journey played from the start.`,
        },
      ];
}

/** A destination's view, facing a place instead of its own: ancient DNA near a find. */
export function destinationNear(
  id: string,
  place: { readonly latitude: number; readonly longitude: number },
): Anchor | null {
  const destination = destinationById(id);
  if (destination === undefined) return null;
  const anchor = destinationAnchor(destination);
  const view = new URLSearchParams(anchor.view);
  view.set('cam', `${place.latitude.toFixed(4)},${place.longitude.toFixed(4)},3.00`);
  return { ...anchor, view: view.toString().replaceAll('%2C', ',').replaceAll('%3A', ':') };
}
