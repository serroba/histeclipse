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
  nearestFinds,
  type FossilsAt,
  type Fossils,
} from '../../data/fossils';
import { loadPictures, type Pictures } from '../../data/pictures';
import type { DeepNotePart } from '../../ui/deepChips';
import type { MarkerCardContent } from '../../ui/markerCard';
import { fromAFossil } from '../../explore/related';
import { layerTurned, roundMa } from '../../state/viewState';
import { formatMa } from '../../time/format';
import { errorMessage } from '../../util/errors';
import { loadOnce } from '../../state/loadOnce';
import { feature } from '../feature';
import { createFinds } from './finds';
import { findsLayer } from './findsLayer';
import { fossilLayer } from './fossilLayer';
import './fossils.css';

/**
 * The note under the bar: a key for each group found, what was found, and the source; with none
 * found, a jump to the nearest finds (#948).
 */
function note(at: FossilsAt, nearest: { ma: number; go: () => void } | null): DeepNotePart[] {
  return [
    ...at.totals.flatMap((total) =>
      total.count > 0 ? [{ key: `fossil-key is-${total.id}` }, ' '] : [],
    ),
    fossilsText(at),
    ...(nearest === null || at.cells.length > 0
      ? []
      : [' ', { text: `Go to the nearest finds, ${formatMa(nearest.ma)}`, run: nearest.go }]),
    ' Source: ',
    { text: 'the Paleobiology Database', href: 'https://paleobiodb.org' },
    ' (CC BY 4.0).',
  ];
}

export const fossilsFeature = feature({
  id: 'fossils',
  needs: ['cards', 'tree'],
  picks: 'fossil',
  deepChip: { label: 'Fossils', why: 'fossils' },
  // Shown in deep time, by the deep-time view (which watches the genus marked, #309).
  watches: () => [],
  mount(context) {
    const cellsOnGlobe = context.globe.addLayer(fossilLayer);
    const findsOnGlobe = context.globe.addLayer(findsLayer);
    const finds = createFinds(context);
    const load = loadOnce<Fossils>({
      fetch: () => loadFossils(`${context.base}data/fossils.json`, context.fetchJson),
      what: 'the fossils',
      context,
    });
    let loadOn = false;
    let at: FossilsAt | null = null;
    let pictures: Pictures | null = null;
    let picturesLoading = false;
    let shown: string | null = null;
    let temperatureOn = false;

    function cardFor(key: string): MarkerCardContent | null {
      const fossils = load.value();
      if (fossils === null || at === null) return null;
      const cell = at.cells.find(
        (each) => `${each.group}:${String(each.latitude)}:${String(each.longitude)}` === key,
      );
      if (cell === undefined) return null;
      const genus = cell.genera[0]?.[0];
      return {
        ...fossilCard(fossils, cell, at, pictures),
        // The climate of its time (#731), at the same moment.
        related: fromAFossil(temperatureOn).map((step) => ({
          ...step,
          run: () => {
            context.change((state) => layerTurned(state, 'temperature', true));
          },
        })),
        ...(genus === undefined
          ? {}
          : {
              action: {
                label: `${genus} on the tree through time`,
                run: () => {
                  context.tree.openLineages(cell.group, genus);
                },
              },
            }),
      };
    }

    return {
      load: () => load.report(loadOn),
      // The dinosaurs' lines through time, from the layer's row in the Layers panel.
      action: () => ({
        label: 'Their tree through time',
        run: () => {
          context.change((state) => ({ ...state, lineages: { group: 'dinosaurs', pick: null } }));
        },
      }),
      deep(state, moment) {
        temperatureOn = state.layers.has('temperature');
        // Fossils are counted by 5 million years: a matter of the 540 Myr span.
        const on = state.deepScale === 'all' && state.layers.has('fossils');
        loadOn = on && moment !== null;
        if (moment === null || !on) {
          at = null;
          cellsOnGlobe.update(null);
          findsOnGlobe.update(null);
          return moment === null
            ? null
            : { offered: moment.scale === 'all', on: false, note: null };
        }
        const offered = moment.scale === 'all';
        const fossils = load.value();
        if (fossils === null) {
          load.want();
          const failed = load.status() === 'failed';
          return {
            offered,
            on: true,
            note: [failed ? 'Fossils: could not load.' : 'Fossils: loading…'],
          };
        }
        at = fossilsAt(fossils, moment.ma);
        cellsOnGlobe.update(at.cells);
        const marked = finds.shownAt(state.finds, moment.ma);
        findsOnGlobe.update(marked.finds);
        const ma = nearestFinds(fossils, moment.ma);
        const go = (): void => {
          if (ma !== null) context.change((state) => ({ ...state, ma: roundMa(ma) }));
        };
        return {
          offered,
          on: true,
          note: [...note(at, ma === null ? null : { ma, go }), ...marked.note],
        };
      },
      pick(key) {
        const card = cardFor(key);
        if (card === null) return;
        shown = key;
        context.cards.show(card);
        if (pictures !== null || picturesLoading) return;
        picturesLoading = true;
        loadPictures(`${context.base}data/fossil-pictures.json`, context.fetchJson).then(
          (loaded) => {
            pictures = loaded;
            // Its picture, if its card is still the one open.
            const again = shown === null ? null : cardFor(shown);
            if (context.cards.open() && again !== null) context.cards.show(again);
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
});
