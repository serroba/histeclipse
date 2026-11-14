/**
 * Writes `public/data/passages.json` from the texts it is built of, and checks the file kept in
 * the repository is what they make: after they change, rewrite it with
 * `pnpm vitest run src/text/passages.build.test.ts -u`.
 */

import { describe, expect, it } from 'vitest';

import eclipses from '../../public/data/famous-eclipses.json';
import spacecraft from '../../public/data/spacecraft.json';
import { loadFamousEclipses } from '../data/famousEclipses';
import { loadSpacecraft } from '../data/spacecraft';
import { WHYS } from '../sources/registry';
import { LAYER_GROUPS } from '../state/layerCatalog';
import { MOON_FACTS } from './moonFacts';
import {
  eclipsePassages,
  missionPassages,
  loadPassages,
  moonPassages,
  whyPassages,
  type Passages,
} from './passages';

const serve = (body: unknown) => () => Promise.resolve(new Response(JSON.stringify(body)));

describe('the passages file', () => {
  it('Given the whys, the moons, the famous eclipses and the missions, Then the file kept is what they make', async () => {
    const famous = await loadFamousEclipses('famous-eclipses.json', serve(eclipses));
    const record = await loadSpacecraft('spacecraft.json', serve(spacecraft));
    const built: Passages = {
      schemaVersion: 1,
      passages: [
        ...whyPassages(
          WHYS,
          LAYER_GROUPS.flatMap((group) => group.layers),
        ),
        ...moonPassages(MOON_FACTS),
        ...eclipsePassages(famous),
        ...missionPassages(record.craft),
      ],
    };
    const text = `${JSON.stringify(built)}\n`;
    await expect(text).toMatchFileSnapshot('../../public/data/passages.json');
    // And it reads back through its schema.
    await expect(loadPassages('passages.json', serve(built))).resolves.toEqual(built);
  });
});
