/**
 * The planetary boundaries as a layer (#434) on the feature contract (#380): in the years, the
 * wheel beside the globe for the latest assessment made by the year shown (Richardson et al.
 * 2023 from 2023, the Planetary Health Check 2026 from 2026), the earlier beside it to compare.
 * A boundary picked offers the layers that draw it (`boundary` in their entry, `src/layers`):
 * the wheel and the layers are one set, not two places. The data load with the layer.
 */

import {
  BOUNDARY_NAMES,
  loadPlanetaryBoundaries,
  statusOf,
  valueText,
  type AssessmentId,
  type BoundaryId,
  type PlanetaryBoundaries,
} from '../../data/planetaryBoundaries';
import { LAYER_GROUPS, type LayerChoice } from '../../state/layerCatalog';
import { loadOnce } from '../../state/loadOnce';
import { withLayer, type ViewState } from '../../state/viewState';
import { feature } from '../feature';
import { assessmentIn, wheelOf } from './wheelModel';
import {
  boundariesPanel,
  STATUS_WORDS,
  type BoundariesView,
  type BoundaryDetail,
} from './wheelPanel';

/** Each boundary's layers, from the layers' own entries. */
const DRAWN_BY: ReadonlyMap<BoundaryId, readonly LayerChoice[]> = (() => {
  const all = LAYER_GROUPS.flatMap((group) => group.layers);
  return new Map(
    (Object.keys(BOUNDARY_NAMES) as BoundaryId[]).map((id) => [
      id,
      all.filter((layer) => layer.boundary === id),
    ]),
  );
})();

const NAMES: Readonly<Record<AssessmentId, string>> = {
  phc2026: 'Planetary Health Check 2026',
  richardson2023: 'Richardson et al. (2023)',
};

/** What a boundary picked says, in `assessment`, with `other`'s values beside if compared. */
export function detailOf(
  data: PlanetaryBoundaries,
  id: BoundaryId,
  assessment: AssessmentId,
  other: AssessmentId | null,
  layers: ReadonlySet<string>,
): BoundaryDetail | null {
  const boundary = data.boundaries.find((each) => each.id === id);
  if (boundary === undefined) return null;
  const status = statusOf(boundary, assessment);
  return {
    id,
    name: boundary.name,
    status: status === null ? 'not assessed' : STATUS_WORDS[status],
    // The file's words are the 2026 report's.
    summary: assessment === 'phc2026' ? boundary.summary : null,
    values: boundary.variables.flatMap((variable) => {
      const now = valueText(variable, assessment);
      if (now === null) return [];
      const then = other === null ? null : valueText(variable, other);
      const proposed = variable.proposed === true ? ' (proposed regional boundary)' : '';
      return [`${variable.name}${proposed}: ${now}${then === null ? '' : `; 2023: ${then}`}`];
    }),
    layers: (DRAWN_BY.get(id) ?? []).map(({ id: layer, label }) => ({
      id: layer,
      label,
      on: layers.has(layer),
    })),
  };
}

/** The panel's view of `data` in the year shown, as the reader has set it. */
export function boundariesView(
  data: PlanetaryBoundaries,
  assessment: AssessmentId,
  choices: { readonly compare: boolean; readonly picked: BoundaryId | null },
  layers: ReadonlySet<string>,
): BoundariesView {
  const offered = assessment === 'phc2026';
  const other = offered && choices.compare ? 'richardson2023' : null;
  const wheel = wheelOf(data, assessment, other);
  return {
    wheel,
    heading: `${NAMES[assessment]}: ${String(wheel.crossed)} of 9 boundaries crossed.`,
    compare: { offered, on: other !== null, label: 'Compare with 2023 (pale bars)' },
    picked:
      choices.picked === null ? null : detailOf(data, choices.picked, assessment, other, layers),
  };
}

export const boundariesFeature = feature({
  id: 'boundaries',
  needs: [],
  watches: (state) => [state.layers, state.mode, state.ma, state.focus],
  mount(context) {
    let compare = false;
    let picked: BoundaryId | null = null;
    let last: ViewState | null = null;
    let shownFor = '';
    let on = false;
    let said: string | null = null;
    const again = (): void => {
      shownFor = '';
      if (last !== null) show(last);
    };
    const panel = context.globe.addLayer(
      boundariesPanel({
        pick(id) {
          picked = id;
          again();
        },
        compare(next) {
          compare = next;
          again();
        },
        turnOn(layer) {
          context.change((state) => ({ ...state, layers: withLayer(state.layers, layer, true) }));
        },
      }),
    );
    const load = loadOnce<PlanetaryBoundaries>({
      fetch: () =>
        loadPlanetaryBoundaries(`${context.base}data/planetary-boundaries.json`, context.fetchJson),
      what: 'the planetary boundaries',
      context,
    });

    function show(state: ViewState): void {
      last = state;
      on =
        state.layers.has('boundaries') &&
        state.mode === 'globe' &&
        state.ma === null &&
        state.focus === 'earth';
      const assessment = assessmentIn(state.time.date.year);
      const data = load.value();
      const key = [on, load.status(), assessment, compare, picked, [...state.layers].join()].join();
      if (key === shownFor) return;
      shownFor = key;
      if (!on || assessment === null) {
        said = null;
        panel.update(null);
        return;
      }
      if (data === null) {
        load.want();
        said =
          load.status() === 'failed'
            ? 'Could not load the planetary boundaries.'
            : 'Loading the planetary boundaries…';
        panel.update(null);
        return;
      }
      const view = boundariesView(data, assessment, { compare, picked }, state.layers);
      said = view.heading;
      panel.update(view);
    }

    return {
      show,
      said: () => said,
      load: () => load.report(on),
    };
  },
});
