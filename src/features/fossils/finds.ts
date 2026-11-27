/**
 * One genus's finds on the globe (#309), or a group of genera's: the `finds` the link names, from
 * its group's lines through time (PBDB, `public/data/time-tree/`), each group's file loaded the
 * first time it is asked for. At each moment, the sites to ring and what the note says of them.
 */

import { findsAt, findsOf } from '../../data/fossilFinds';
import { loadLineages, type LineageGroup, type Lineages } from '../../data/lineages';
import type { FossilFinds } from '../../state/viewState';
import { roundMa } from '../../state/viewState';
import { formatMa } from '../../time/format';
import type { DeepNotePart } from '../../ui/deepChips';
import { loadOnce, type LoadOnce } from '../../state/loadOnce';
import type { FeatureCore } from '../feature';
import type { Finds } from './findsLayer';

export interface FindsShown {
  readonly finds: Finds | null;
  /** What the note adds: its sites, or where the nearest are, and a way to stop marking it. */
  readonly note: readonly DeepNotePart[];
}

/** What the note says of a genus's finds at a moment, and its ways on. */
function findsNote(
  name: string,
  shown: { readonly sites: number; readonly nearest: number | null; readonly within: number },
  go: (ma: number) => void,
  stop: () => void,
): DeepNotePart[] {
  const around = `within ${String(shown.within)} million years of this moment`;
  const said =
    shown.sites > 0
      ? `${name}, ringed: found at ${String(shown.sites)} ${shown.sites === 1 ? 'site' : 'sites'} ${around}.`
      : `${name}: no finds ${around}.`;
  const { nearest } = shown;
  return [
    ' ',
    { text: said, testId: 'fossil-finds' },
    ...(nearest === null
      ? []
      : [
          ' ',
          {
            text: `Go to its nearest finds, ${formatMa(nearest)}`,
            run: () => {
              go(nearest);
            },
          },
        ]),
    ' ',
    { text: `Stop marking ${name}`, run: stop },
  ];
}

export function createFinds(context: FeatureCore): {
  shownAt(finds: FossilFinds | null, ma: number): FindsShown;
} {
  const groups = new Map<LineageGroup, LoadOnce<Lineages>>();
  function group(id: LineageGroup): LoadOnce<Lineages> {
    let load = groups.get(id);
    if (load === undefined) {
      load = loadOnce({
        fetch: () => loadLineages(`${context.base}data/time-tree/${id}.json`, context.fetchJson),
        what: 'the genera’s finds',
        context,
        retryInNotice: true,
      });
      groups.set(id, load);
    }
    return load;
  }
  const none: FindsShown = { finds: null, note: [] };

  return {
    shownAt(finds, ma) {
      if (finds === null) return none;
      const load = group(finds.group);
      const lineages = load.value();
      if (lineages === null) {
        load.want();
        return {
          finds: null,
          note: [
            load.status() === 'failed' ? ' Its finds could not load.' : ' Its finds: loading…',
          ],
        };
      }
      const stop = (): void => {
        context.change((state) => ({ ...state, finds: null }));
      };
      const node = lineages.nodes.find((each) => each.pbdb === finds.pbdb);
      if (node === undefined) {
        return {
          finds: null,
          note: [
            ' The genus to mark is not among the lines through time.',
            ' ',
            {
              text: 'Stop marking it',
              run: stop,
            },
          ],
        };
      }
      const at = findsAt(findsOf(lineages, node.index), ma, lineages.stepMa);
      return {
        finds: { group: finds.group, sites: at.sites },
        note: findsNote(
          node.name,
          { sites: at.sites.length, nearest: at.nearest, within: lineages.stepMa / 2 },
          (to) => {
            context.change((state) => ({ ...state, ma: roundMa(to) }));
          },
          stop,
        ),
      };
    },
  };
}
