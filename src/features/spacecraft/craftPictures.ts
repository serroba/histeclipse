/**
 * The telescopes' pictures for their cards (#798): asked for with the first card opened, not
 * before, and asked again by the next card if they could not be loaded.
 */

import {
  loadTelescopePictures,
  picturesOf,
  type TelescopePictures,
} from '../../data/telescopePictures';
import type { MarkerCardContent } from '../../ui/markerCard';
import type { CardPictures } from '../../ui/pictureStrip';
import { errorMessage } from '../../util/errors';
import type { FeatureContext } from '../feature';

interface CraftPictures {
  /** A craft's pictures, once they are known; none for most craft. */
  of(craft: string): CardPictures | undefined;
  /** Ask for them, once; `then` runs when they have come. */
  ask(then: () => void): void;
}

function craftPictures(context: FeatureContext<'cards'>): CraftPictures {
  let pictures: TelescopePictures | null = null;
  let asked = false;
  return {
    of: (craft) => picturesOf(pictures, craft, context.base),
    ask(then) {
      if (asked) return;
      asked = true;
      loadTelescopePictures(`${context.base}data/telescope-pictures.json`, context.fetchJson).then(
        (all) => {
          pictures = all;
          then();
        },
        (error: unknown) => {
          asked = false;
          context.notify(`Could not load the telescopes’ pictures: ${errorMessage(error)}`);
        },
      );
    },
  };
}

/**
 * Opens a craft's card: at once as `cardOf` has it, and again with its pictures once they have
 * come, if its card is still the one open. Nothing for a craft `cardOf` does not know.
 */
export function craftCards(
  context: FeatureContext<'cards'>,
  cardOf: (craft: string) => MarkerCardContent | null,
): (craft: string) => void {
  const pictures = craftPictures(context);
  let picked: string | null = null;
  function withPictures(craft: string): MarkerCardContent | null {
    const card = cardOf(craft);
    const shots = pictures.of(craft);
    return card === null || shots === undefined ? card : { ...card, pictures: shots };
  }
  return (craft) => {
    const card = withPictures(craft);
    if (card === null) return;
    picked = craft;
    context.cards.show(card);
    pictures.ask(() => {
      const again = picked === null ? null : withPictures(picked);
      if (context.cards.open() && again?.pictures !== undefined) context.cards.show(again);
    });
  };
}
