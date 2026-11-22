/**
 * The features on the contract (#380) as mounted together (#474): shown at each moment, each
 * shown again when what it watches changes, their chips in deep time, a marker tapped, and what
 * the Layers panel says of each.
 */

import { changed } from '../state/store';
import type { LayerLoad } from '../state/activeLayers';
import type { HereFact } from '../sources/registry';
import type { Layer, ViewState } from '../state/viewState';
import type { DeepChip, DeepChipView } from '../ui/deepChips';
import type {
  Capabilities,
  DeepBarFields,
  DeepMoment,
  Feature,
  FeatureCore,
  LayerAction,
} from './feature';

export interface Features {
  /** The moment shown: `jdTT` in Terrestrial Time, or null before it is known. */
  show(state: ViewState, jdTT: number | null): void;
  /** The moment kept: each feature shown again only if what it watches changed. */
  redraw(state: ViewState, previous: ViewState | null, jdTT: number | null): void;
  /** Deep time shown: the chips of those that have one, by layer. */
  deep(state: ViewState, moment: DeepMoment): Map<Layer, DeepChipView>;
  /** Deep time shown: the fields of the bar's view the features have, together (#909). */
  deepBar(state: ViewState, moment: DeepMoment): Required<DeepBarFields>;
  /** Deep time (#1077): the finds of all the features, Ma, that play eases near. */
  finds(state: ViewState): number[];
  /** Deep time left. */
  deepOff(state: ViewState): void;
  /** A marker tapped: whether it was one of theirs, and if so, picked. */
  pick(key: string): boolean;
  /** What the Layers panel says under each feature's layer. */
  said(): (readonly [Layer, string | null])[];
  /** The step each feature offers from its row in the Layers panel (#909). */
  actions(): (readonly [Layer, LayerAction | null])[];
  /** How each feature's layer's load stands, where it is loading or failed (#751). */
  loads(): (readonly [Layer, LayerLoad | null])[];
  /** What the features have at the place picked, for "Why here?" (#893), each with its layer. */
  here(state: ViewState): (readonly [Layer, HereFact])[];
}

/** Deep time's bar with none of the layers' fields filled: what each says while off. */
function deepBarOff(state: ViewState): Required<DeepBarFields> {
  return {
    air: { on: false },
    plateMotion: null,
    coastline: null,
    ice: { drawn: false, oldestKa: null, standIn: null },
    iceOutlines: null,
    seaIce: null,
    seaLevel: { on: false },
    temperature: {
      on: false,
      wanted: state.temperatureModel,
      shown: null,
      show: state.temperatureShow,
      changing: false,
      readings: [],
      note: null,
    },
    temperatureDrawn: false,
  };
}

/** The chips in deep time's bar, of the features that have one, in their order. */
export function deepChipsOf(features: readonly Feature[]): DeepChip[] {
  return features
    .filter((feature) => feature.deepChip !== undefined)
    .map((feature, index) => ({ feature, index }))
    .sort(
      (a, b) =>
        (a.feature.deepChipOrder ?? 0) - (b.feature.deepChipOrder ?? 0) || a.index - b.index,
    )
    .flatMap(({ feature }) =>
      feature.deepChip === undefined ? [] : [{ layer: feature.id, ...feature.deepChip }],
    );
}

export function mountFeatures(
  features: readonly Feature[],
  core: FeatureCore,
  capabilities: Capabilities,
): Features {
  const mounted = features.map((feature) => ({
    feature,
    shown: feature.mount(core, capabilities),
  }));
  return {
    show(state, jdTT) {
      if (jdTT === null) return;
      for (const { shown } of mounted) shown.show?.(state, jdTT);
    },
    redraw(state, previous, jdTT) {
      if (previous === null || jdTT === null) return;
      for (const { feature, shown } of mounted) {
        if (changed(feature.watches(previous), feature.watches(state))) shown.show?.(state, jdTT);
      }
    },
    deep(state, moment) {
      const chips = new Map<Layer, DeepChipView>();
      for (const { feature, shown } of mounted) {
        const chip = shown.deep?.(state, moment) ?? null;
        if (chip !== null) chips.set(feature.id, chip);
      }
      return chips;
    },
    deepBar(state, moment) {
      const fields = deepBarOff(state);
      for (const { shown } of mounted) Object.assign(fields, shown.deepBar?.(state, moment));
      return fields;
    },
    finds(state) {
      return mounted.flatMap(({ shown }) => shown.finds?.(state) ?? []);
    },
    deepOff(state) {
      for (const { shown } of mounted) shown.deep?.(state, null);
    },
    pick(key) {
      const [kind] = key.split(':');
      for (const { shown } of mounted) shown.unpick?.();
      const picked = mounted.find(({ feature }) => feature.picks === kind);
      picked?.shown.pick?.(key.slice(key.indexOf(':') + 1));
      return picked !== undefined;
    },
    said: () => mounted.map(({ feature, shown }) => [feature.id, shown.said?.() ?? null] as const),
    actions: () =>
      mounted.map(({ feature, shown }) => [feature.id, shown.action?.() ?? null] as const),
    loads: () => mounted.map(({ feature, shown }) => [feature.id, shown.load?.() ?? null] as const),
    here: (state) =>
      mounted.flatMap(({ feature, shown }) => {
        const facts = [shown.here?.(state) ?? []].flat();
        return facts.map((fact) => [feature.id, fact] as const);
      }),
  };
}
