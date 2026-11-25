/**
 * The features on the contract (#380) as mounted together (#474): shown at each moment, each
 * shown again when what it watches changes, their chips in deep time, a marker tapped, and what
 * the Layers panel says of each.
 */

import { changed } from '../state/store';
import { begin, end } from '../util/frameLedger';
import type { Brief, LayerLoad } from '../state/activeLayers';
import type { HereFact } from '../sources/registry';
import type { StoryDate } from '../deepTime/storyDate';
import type { Layer, ViewState } from '../state/viewState';
import type { DeepChip, DeepChipView } from '../ui/deepChips';
import type {
  AppCapabilities,
  Capabilities,
  DeepBarFields,
  DeepMoment,
  Feature,
  FeatureCore,
  LayerAction,
} from './feature';
import { createFormation } from './formation';
import { createOwnTime } from './ownTime';

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
  /** A marker tapped, or named by an anchor: whether it was one of theirs, and if so, picked. */
  readonly pick: (key: string) => boolean;
  /** What the Layers panel says under each feature's layer. */
  said(): (readonly [Layer, string | null])[];
  /** The step each feature offers from its row in the Layers panel (#909). */
  actions(): (readonly [Layer, LayerAction | null])[];
  /** How each feature's layer's load stands, where it is loading or failed (#751). */
  loads(): (readonly [Layer, LayerLoad | null])[];
  /** What each feature's chip says beside its name (#1159). */
  briefs(): (readonly [Layer, Brief | null])[];
  /** What the features have at the place picked, for "Why here?" (#893), each with its layer. */
  here(state: ViewState): (readonly [Layer, HereFact])[];
  /** The moment an event's own clock is at, lent deep time's header and bar (#1222). */
  readonly storyDate: () => StoryDate | null;
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

/** Whether the reader asks for less motion. */
const lessMotion = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function mountFeatures(
  features: readonly Feature[],
  core: FeatureCore,
  lent: AppCapabilities,
): Features {
  // Made from the others, here rather than in the app: one clock shared by the layers (#1191).
  const ownTime = createOwnTime(core, lent);
  const capabilities: Capabilities = { ...lent, ownTime };
  // The aeons begin with Earth and the Moon forming (#1218), on that clock.
  const formation = createFormation(capabilities, lessMotion);
  const mounted = features.map((feature) => ({
    feature,
    shown: feature.mount(core, capabilities),
    // Its names in the frame ledger (#1196), made once.
    ledger: { show: `feature.${feature.id}`, deep: `feature.${feature.id}.deep` },
  }));
  return {
    show(state, jdTT) {
      if (jdTT === null) return;
      formation.show(state);
      for (const { shown, ledger } of mounted) {
        if (shown.show === undefined) continue;
        // Each feature timed on its own, so a long frame says which made it long (#1196).
        begin();
        shown.show(state, jdTT);
        end(ledger.show);
      }
    },
    redraw(state, previous, jdTT) {
      if (previous === null || jdTT === null) return;
      formation.show(state);
      for (const { feature, shown, ledger } of mounted) {
        if (shown.show === undefined) continue;
        if (!changed(feature.watches(previous), feature.watches(state))) continue;
        begin();
        shown.show(state, jdTT);
        end(ledger.show);
      }
    },
    deep(state, moment) {
      const chips = new Map<Layer, DeepChipView>();
      for (const { feature, shown, ledger } of mounted) {
        if (shown.deep === undefined) continue;
        begin();
        const chip = shown.deep(state, moment);
        end(ledger.deep);
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
    briefs: () =>
      mounted.map(({ feature, shown }) => [feature.id, shown.brief?.() ?? null] as const),
    here: (state) =>
      mounted.flatMap(({ feature, shown }) => {
        const facts = [shown.here?.(state) ?? []].flat();
        return facts.map((fact) => [feature.id, fact] as const);
      }),
    storyDate: () => ownTime.lent(),
  };
}
