import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { loadLifePictures, silhouetteCredit } from './lifePictures';

const body = readFileSync('public/data/life-stories/pictures.json', 'utf8');
const served = () => loadLifePictures('pictures.json', () => Promise.resolve(new Response(body)));

describe('the animals’ pictures, as served', () => {
  it('reads the file: every silhouette credited and licensed, shown from PhyloPic', async () => {
    const entries = Object.values((await served()).names);
    const silhouettes = entries.flatMap(({ silhouette }) =>
      silhouette === null ? [] : [silhouette],
    );
    expect(silhouettes.length).toBeGreaterThan(1000);
    for (const silhouette of silhouettes) {
      expect(silhouetteCredit(silhouette)).toBe(
        `${silhouette.of}, by ${silhouette.by}, ${silhouette.licence}`,
      );
    }
  });

  it('has the lion’s genus: a silhouette of one of its species, and its page on Wikipedia', async () => {
    const panthera = (await served()).names['Panthera'];
    expect(panthera?.silhouette?.of.startsWith('Panthera')).toBe(true);
    expect(panthera?.wikipedia?.page).toBe('https://en.wikipedia.org/wiki/Panthera');
    expect(panthera?.wikipedia?.image?.licence).toBeTruthy();
  });

  it('keeps no name with neither a silhouette nor a page', async () => {
    for (const entry of Object.values((await served()).names)) {
      expect(entry.silhouette !== null || entry.wikipedia !== null).toBe(true);
    }
  });
});
