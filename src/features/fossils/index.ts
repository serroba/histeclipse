/**
 * Fossils through deep time (PBDB) on the feature contract (#380): on the 540 Myr span, the finds
 * of four groups of animals where they lay then, a count to tap in each cell; their chip and note
 * in the deep-time bar; each cell's card, with its genera's pictures once they load, and a way to
 * the tree of life through time.
 */

import {
  fossilCard,
  fossilsAt,
  fossilsText,
  loadFossils,
  type FossilsAt,
  type Fossils,
} from '../../data/fossils';
import { loadPictures, type Pictures } from '../../data/pictures';
import type { DeepNotePart } from '../../ui/deepChips';
import type { MarkerCardContent } from '../../ui/markerCard';
import { errorMessage } from '../../util/errors';
import type { Feature } from '../feature';
import { fossilLayer } from './fossilLayer';

/** The note under the bar: a key for each group found, what was found, and the source. */
function note(at: FossilsAt): DeepNotePart[] {
  return [
    ...at.totals.flatMap((total) =>
      total.count > 0 ? [{ key: `fossil-key is-${total.id}` }, ' '] : [],
    ),
    fossilsText(at),
    ' Source: ',
    { text: 'the Paleobiology Database', href: 'https://paleobiodb.org' },
    ' (CC BY 4.0).',
  ];
}

export const fossilsFeature: Feature = {
  id: 'fossils',
  picks: 'fossil',
  deepChip: { label: 'Fossils', icon: 'fossils', why: 'fossils' },
  // Shown in deep time, by the deep-time view: nothing to watch besides.
  watches: () => [],
  mount(context) {
    const cellsOnGlobe = context.globe.addLayer(fossilLayer);
    let fossils: Fossils | null = null;
    let loading = false;
    let at: FossilsAt | null = null;
    let pictures: Pictures | null = null;
    let picturesLoading = false;
    let shown: string | null = null;

    function cardFor(key: string): MarkerCardContent | null {
      if (fossils === null || at === null) return null;
      const cell = at.cells.find(
        (each) => `${each.group}:${String(each.latitude)}:${String(each.longitude)}` === key,
      );
      if (cell === undefined) return null;
      const genus = cell.genera[0]?.[0];
      return {
        ...fossilCard(fossils, cell, at, pictures),
        ...(genus === undefined
          ? {}
          : {
              action: {
                label: `${genus} on the tree through time`,
                run: () => {
                  context.openLineages(cell.group, genus);
                },
              },
            }),
      };
    }

    return {
      deep(state, moment) {
        // Fossils are counted by 5 million years: a matter of the 540 Myr span.
        const on = state.deepScale === 'all' && state.layers.has('fossils');
        if (moment === null || !on) {
          at = null;
          cellsOnGlobe.update(null);
          return moment === null
            ? null
            : { offered: moment.scale === 'all', on: false, note: null };
        }
        const offered = moment.scale === 'all';
        if (fossils === null) {
          if (!loading) {
            loading = true;
            loadFossils(`${context.base}data/fossils.json`, context.fetchJson).then(
              (loaded) => {
                fossils = loaded;
                context.refresh();
              },
              (error: unknown) => {
                loading = false;
                context.notify(`Could not load the fossils: ${errorMessage(error)}`);
              },
            );
          }
          return { offered, on: true, note: ['Fossils: loading…'] };
        }
        at = fossilsAt(fossils, moment.ma);
        cellsOnGlobe.update(at.cells);
        return { offered, on: true, note: note(at) };
      },
      pick(key) {
        const card = cardFor(key);
        if (card === null) return;
        shown = key;
        context.showCard(card);
        if (pictures !== null || picturesLoading) return;
        picturesLoading = true;
        loadPictures(`${context.base}data/fossil-pictures.json`, context.fetchJson).then(
          (loaded) => {
            pictures = loaded;
            // Its picture, if its card is still the one open.
            const again = shown === null ? null : cardFor(shown);
            if (context.cardOpen() && again !== null) context.showCard(again);
          },
          (error: unknown) => {
            picturesLoading = false;
            context.notify(`Could not load the fossils’ pictures: ${errorMessage(error)}`);
          },
        );
      },
      unpick() {
        shown = null;
      },
    };
  },
};
