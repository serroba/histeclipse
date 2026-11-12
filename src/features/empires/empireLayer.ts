/**
 * Past states on the globe (#379): their territories and borders painted over the ground, on top
 * of the history map's other parts, and the names of the largest pinned to the surface. Names
 * are kept from year to year, so one that stays stays where it is.
 */

import { Vector3 } from 'three';

import { labelPoint, namedByBoth, type Territory } from '../../data/empires';
import type { OhmYear } from '../../data/ohmBorders';
import { paintBorders, paintTerritories } from '../../globe/empireCanvas';
import { geoToVector } from '../../globe/geo';
import {
  HISTORY_PAINT_ORDER,
  SURFACE_PRIORITY,
  type LayerFactory,
  type SurfaceLabel,
} from '../../globe/layerHost';

/** Past states to draw: Cliopatria's filled territories, OpenHistoricalMap's border lines, or both. */
export interface EmpireLayer {
  readonly territories: readonly Territory[];
  readonly ohm: OhmYear | null;
  /** States that appeared or went since the year drawn before, to name on the map a while. */
  readonly changes?: readonly StateChange[];
}

/** A state that appeared or went, and where its name goes. */
export interface StateChange {
  readonly name: string;
  readonly kind: 'new' | 'gone';
  readonly point: { readonly latitude: number; readonly longitude: number };
  /** How large it is drawn: the larger ones are named first. */
  readonly area: number;
}

/**
 * How many states are named as new or gone at once, the largest first: as the years fly by in
 * a busy century, more would light up most of the map and read as flicker.
 */
const STATE_CHANGES_SHOWN = 4;
/** A state's name at this size or larger (its larger states) is placed before the markers. */
const MAJOR_STATE_SIZE = 14;

/** How long a state that appeared or went stays named as such, ms (its CSS animation's too). */
const STATE_CHANGE_MS = 4000;

/** A state's name; `major` for the larger states' and those just come or gone. */
type StateLabel = SurfaceLabel & { readonly id: string; readonly major: boolean };

/** A name to show: what it says, where, how large, and its class. */
interface Wanted {
  readonly name: string;
  readonly point: { readonly latitude: number; readonly longitude: number };
  readonly size: number;
  readonly kind: string;
  /** Set for a state just come or gone: how far into its animation, ms (negative). */
  readonly delay?: number;
}

/**
 * Those that came or went lately (kept in `recentStates`), the largest few, carrying on their
 * animations.
 */
function changedNames(
  recentStates: Map<string, { readonly change: StateChange; readonly at: number }>,
  shown: EmpireLayer,
  now: number,
): Wanted[] {
  for (const change of shown.changes ?? []) recentStates.set(change.name, { change, at: now });
  const present = new Set([
    ...shown.territories.map(({ name }) => name),
    ...(shown.ohm?.labels ?? []).map(({ name }) => name),
  ]);
  for (const [name, { change, at }] of recentStates) {
    if (now - at > STATE_CHANGE_MS || present.has(name) !== (change.kind === 'new')) {
      recentStates.delete(name);
    }
  }
  return [...recentStates.entries()]
    .sort((a, b) => b[1].change.area - a[1].change.area)
    .slice(0, STATE_CHANGES_SHOWN)
    .map(([name, { change, at }]) => ({
      name,
      point: change.point,
      size: 13,
      kind: `empire-label is-${change.kind}`,
      delay: -Math.round(now - at),
    }));
}

/**
 * Names of the larger states first; as the camera comes closer, more fit between them. Those
 * shown the year before keep their place ahead of the rest, so names don't trade places as
 * borders shift a little from year to year. Then OpenHistoricalMap's, set apart in italics.
 */
function stateNames(
  shown: EmpireLayer,
  named: ReadonlySet<string>,
  shownBefore: ReadonlySet<string>,
): Wanted[] {
  const wasShown = (name: string, size: number) =>
    shownBefore.has(`empire-label|${String(size)}|${name}`);
  const sizeOf = (area: number) => Math.round(10 + Math.min(6, Math.sqrt(area) / 4));
  const ranked = shown.territories
    .map((territory) => ({ territory, label: labelPoint(territory) }))
    .filter(({ territory }) => !named.has(territory.name))
    .sort((a, b) => b.label.area - a.label.area)
    .slice(0, 80)
    .sort(
      (a, b) =>
        Number(wasShown(b.territory.name, sizeOf(b.label.area))) -
        Number(wasShown(a.territory.name, sizeOf(a.label.area))),
    )
    .map(({ territory, label }) => ({
      name: territory.name,
      point: label,
      size: sizeOf(label.area),
    }));
  // A state OpenHistoricalMap names too, near where Cliopatria does, is named once, marked
  // as named by both (#163).
  const ohmLabels = shown.ohm?.labels ?? [];
  const both = namedByBoth(
    ranked.map(({ name, point }) => ({
      name,
      latitude: point.latitude,
      longitude: point.longitude,
    })),
    ohmLabels,
  );
  const cliopatriaNames = ranked.map((label) => ({
    ...label,
    kind: both.shared.has(label.name) ? 'empire-label is-both' : 'empire-label',
  }));
  const ohmNames = ohmLabels
    .filter(({ name }, index) => !named.has(name) && !both.repeated.has(index))
    .slice(0, 120)
    .map((label) => ({ name: label.name, point: label, size: 11, kind: 'empire-label is-ohm' }));
  return [...cliopatriaNames, ...ohmNames];
}

/**
 * A state's name, not yet in the page. Its size, if `known`, is kept and it waits hidden; if
 * not, it is unseen until measured.
 */
function newLabel(
  id: string,
  { name, point, size, kind, delay }: Wanted,
  known: { readonly width: number; readonly height: number } | undefined,
): StateLabel {
  const element = document.createElement('span');
  element.className = kind;
  element.textContent = name;
  element.style.fontSize = `${String(size)}px`;
  if (delay !== undefined) element.style.animationDelay = `${String(delay)}ms`;
  if (known === undefined) element.style.visibility = 'hidden';
  else element.hidden = true;
  return {
    id,
    // The larger states, and those just come or gone (which carry a delay).
    major: size >= MAJOR_STATE_SIZE || delay !== undefined,
    element,
    position: new Vector3(...geoToVector(point, 1.01)),
    width: known?.width ?? 0,
    height: known?.height ?? 0,
  };
}

/** The past states drawn for the year shown; null hides them. */
export const empiresLayer: LayerFactory<EmpireLayer | null> = (host) => {
  // Names of the largest territories shown, placed on the globe each frame.
  const layer = document.createElement('div');
  layer.className = 'empire-labels';
  host.container.append(layer);
  const slot = host.historyPaint(HISTORY_PAINT_ORDER.states);
  const majorNames = host.surfaceSlot(SURFACE_PRIORITY.majorStates);
  const minorNames = host.surfaceSlot(SURFACE_PRIORITY.minorStates);
  let labels: StateLabel[] = [];
  // The sizes of the states' names already laid out, by class, size and name: as the years
  // play, most names come back step after step.
  const labelSizes = new Map<string, { readonly width: number; readonly height: number }>();
  // States that appeared or went lately, by name: named on the map for a while.
  const recentStates = new Map<string, { readonly change: StateChange; readonly at: number }>();

  /**
   * The labels for `wanted`, those already made kept (taken out of `before`). A name not seen
   * before is laid out once, unseen, so its real size is known for keeping names apart; one
   * seen before keeps its size, and costs no layout.
   */
  function made(wanted: readonly Wanted[], before: Map<string, StateLabel>): StateLabel[] {
    const fresh: StateLabel[] = [];
    const all = wanted.map((label) => {
      const { name, point, size, kind } = label;
      const id = `${kind}|${String(size)}|${name}`;
      const kept = before.get(id);
      if (kept !== undefined) {
        before.delete(id);
        kept.position.set(...geoToVector(point, 1.01));
        return kept;
      }
      const known = labelSizes.get(id);
      const entry = newLabel(id, label, known);
      layer.append(entry.element);
      if (known === undefined) fresh.push(entry);
      return entry;
    });
    host.measure(fresh);
    for (const { id, width, height } of fresh) labelSizes.set(id, { width, height });
    return all;
  }

  return {
    update(shown) {
      slot.show(
        shown === null
          ? null
          : (canvas) => {
              paintTerritories(canvas, shown.territories);
              if (shown.ohm !== null) paintBorders(canvas, shown.ohm.borders);
            },
      );
      const previous = labels;
      const before = new Map(previous.map((entry) => [entry.id, entry]));
      const shownBefore = new Set(
        previous.filter(({ element }) => element.hidden === false).map(({ id }) => id),
      );
      labels = [];
      if (shown === null) recentStates.clear();
      else {
        const changed = changedNames(recentStates, shown, performance.now());
        const named = new Set(changed.map(({ name }) => name));
        labels = made([...changed, ...stateNames(shown, named, shownBefore)], before);
      }
      // Names no longer wanted go; the rest are placed now, before the frame is painted.
      const kept = new Set(labels.map(({ element }) => element));
      for (const { element } of previous) if (!kept.has(element)) element.remove();
      majorNames.set(labels.filter(({ major }) => major));
      minorNames.set(labels.filter(({ major }) => !major));
      const data = host.container.dataset;
      data['empires'] = shown === null ? 'off' : String(shown.territories.length);
      data['statesChanged'] = String(
        labels.filter(({ element }) => /\bis-(new|gone)\b/.test(element.className)).length,
      );
      const ohm = shown === null ? null : shown.ohm;
      data['ohmBorders'] = ohm === null ? 'off' : String(ohm.borders.length);
    },
  };
};
