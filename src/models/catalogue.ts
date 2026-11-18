/**
 * The telescopes' models (#859-#864, #873, epic #865): one entry each, by the telescopes
 * record's id (`catalogueEntry.ts` says what an entry holds). The cards (`telescopeModels.ts`),
 * the scene's craft (`spaceScenes.ts`) and the ground sites are all derived from it, so adding a
 * telescope is its builder in a family's file and one entry in `spaceCatalogue.ts` or
 * `groundCatalogue.ts`.
 */

import type { CatalogueEntry } from './catalogueEntry';
import { GROUND_CATALOGUE } from './groundCatalogue';
import { SPACE_CATALOGUE } from './spaceCatalogue';

export const CATALOGUE: readonly CatalogueEntry[] = [...SPACE_CATALOGUE, ...GROUND_CATALOGUE];
