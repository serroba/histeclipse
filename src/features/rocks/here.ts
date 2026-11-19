/**
 * What the rocks have at one place, for "Why here?": the map unit there, read back from the
 * records the map is drawn from. Pure.
 */

import type { RockUnit } from '../../data/rocks';
import type { HereFact } from '../../sources/registry';

/** The unit at the place, or that the map has none there. */
export function rockFact(rock: RockUnit | null): HereFact {
  return rock === null
    ? { title: 'Rocks', text: 'No map unit of Macrostrat’s here.', why: 'rocks' }
    : {
        title: 'Rocks',
        text: `${rock.name}: ${rock.lith}, from ${String(rock.bottomMa)} to ${String(rock.topMa)} million years ago.`,
        why: 'rocks',
      };
}
