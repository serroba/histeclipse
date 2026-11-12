/**
 * The features on the contract (#380) as mounted together (#474): shown at each moment, each
 * shown again when what it watches changes, their chips in deep time, a marker tapped, and what
 * the Layers panel says of each.
 */

import { changed } from '../state/store';
import type { Layer, ViewState } from '../state/viewState';
import type { DeepChipView } from '../ui/deepChips';
import type { DeepMoment, Feature, FeatureContext } from './feature';

export interface Features {
  /** The moment shown: `jdTT` in Terrestrial Time. */
  show(state: ViewState, jdTT: number): void;
  /** The moment kept: each feature shown again only if what it watches changed. */
  redraw(state: ViewState, previous: ViewState | null, jdTT: number | null): void;
  /** Deep time shown: the chips of those that have one, by layer. */
  deep(state: ViewState, moment: DeepMoment): Map<Layer, DeepChipView>;
  /** Deep time left. */
  deepOff(state: ViewState): void;
  /** A marker tapped: whether it was one of theirs, and if so, picked. */
  pick(key: string): boolean;
  /** What the Layers panel says under each feature's layer. */
  said(): (readonly [Layer, string | null])[];
}

export function mountFeatures(features: readonly Feature[], context: FeatureContext): Features {
  const mounted = features.map((feature) => ({ feature, shown: feature.mount(context) }));
  return {
    show(state, jdTT) {
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
  };
}
