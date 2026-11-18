/**
 * The telescopes' models for their cards (#859-#862, epic #865), by the record's ids, derived
 * from the catalogue (`catalogue.ts`): each built from its operator's published sizes, its
 * caption saying which parts are placed by eye. The same object each time, so a card shown again
 * keeps its view.
 */

import { CATALOGUE } from './catalogue';
import { BUILT, DAY, type CatalogueEntry } from './catalogueEntry';
import { lazyModel, withView, type LazyModel } from './lazyModel';

const made = new Map<string, LazyModel>();

/** An entry's model for its card: the same object each time. */
export function cardModel(entry: CatalogueEntry): LazyModel {
  let model = made.get(entry.id);
  if (model === undefined) {
    model = lazyModel(
      `${entry.name} in 3D: drag to turn it, pinch or scroll to zoom`,
      `${entry.opening ?? BUILT} ${entry.caption}`,
      entry.kind === 'space' ? entry.sun : DAY,
      withView(entry.build),
    );
    made.set(entry.id, model);
  }
  return model;
}

const BY_ID: ReadonlyMap<string, CatalogueEntry> = new Map(
  CATALOGUE.map((entry) => [entry.id, entry]),
);

/** A telescope's model, by its id in the record, if it has one yet. */
export function telescopeModel(id: string): LazyModel | undefined {
  const entry = BY_ID.get(id);
  return entry === undefined ? undefined : cardModel(entry);
}
