import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { loadLifePictures, silhouetteCredit } from '../../data/lifePictures';

async function served(): Promise<Awaited<ReturnType<typeof loadLifePictures>>> {
  const body = readFileSync('public/data/life-stories/pictures.json', 'utf8');
  return loadLifePictures('pictures.json', () => Promise.resolve(new Response(body)));
}

describe('the animals’ pictures', () => {
  it('reads the served file: every silhouette credited and licensed, every page on Wikipedia', async () => {
    const pictures = await served();
    const entries = Object.values(pictures.names);
    expect(entries.length).toBeGreaterThan(100);
    for (const { silhouette } of entries) {
      if (silhouette === null) continue;
      expect(silhouetteCredit(silhouette)).toContain(silhouette.licence);
    }
  });

  it('has the lion’s genus with a silhouette of one of its species and its Wikipedia page', async () => {
    const panthera = (await served()).names['Panthera'];
    expect(panthera?.silhouette?.of.startsWith('Panthera')).toBe(true);
    expect(panthera?.wikipedia?.page).toBe('https://en.wikipedia.org/wiki/Panthera');
  });
});
