import { describe, expect, it } from 'vitest';

import data from '../../public/data/fossils.json';
import { fossilsAt, fossilsText, loadFossils, type Fossils } from './fossils';

const serve = (body: unknown) => (): Promise<Response> => Promise.resolve(Response.json(body));

const small: Fossils = {
  schemaVersion: 1,
  credit: 'PBDB',
  source: 'https://paleobiodb.org',
  accessed: '2026-11-03',
  stepMa: 5,
  cellDegrees: 5,
  groups: [
    { id: 'trilobites', name: 'Trilobites', occurrences: 1, counts: [[250, 0, 0, 1]] },
    {
      id: 'dinosaurs',
      name: 'Non-avian dinosaurs',
      occurrences: 7,
      counts: [
        [65, 50, -85, 2],
        [65, 50, -80, 5],
      ],
    },
  ],
};

describe('fossils', () => {
  it('load and check, the real file too', async () => {
    const loaded = await loadFossils('fossils.json', serve(data));
    expect(loaded.groups.map((group) => group.id)).toEqual([
      'trilobites',
      'ammonoids',
      'dinosaurs',
      'mammals',
    ]);
    await expect(loadFossils('x', serve({ ...small, accessed: 'yesterday' }))).rejects.toThrow();
  });

  it('give the finds of the step holding a moment, most first, by cell centre', () => {
    const at = fossilsAt(small, 67);
    expect([at.from, at.to]).toEqual([70, 65]);
    expect(at.cells).toEqual([
      { group: 'dinosaurs', latitude: 52.5, longitude: -77.5, count: 5 },
      { group: 'dinosaurs', latitude: 52.5, longitude: -82.5, count: 2 },
    ]);
    expect(at.totals).toEqual([
      { id: 'trilobites', name: 'Trilobites', count: 0 },
      { id: 'dinosaurs', name: 'Non-avian dinosaurs', count: 7 },
    ]);
  });

  it('say what was found, and that counts follow the record, not the animals', () => {
    expect(fossilsText(fossilsAt(small, 67))).toBe(
      'Fossils, 70–65 million years ago, where they lay then: Non-avian dinosaurs 7. Counts show where fossils have been found and recorded, not how many animals lived.',
    );
    expect(fossilsText(fossilsAt(small, 500))).toBe(
      'Fossils, 505–500 million years ago: none of these groups found.',
    );
  });

  it('find dinosaurs in the late Cretaceous and trilobites in the Cambrian of the real file', async () => {
    const loaded = await loadFossils('fossils.json', serve(data));
    const dinosaurs = fossilsAt(loaded, 67).totals.find((total) => total.id === 'dinosaurs');
    expect(dinosaurs?.count).toBeGreaterThan(100);
    const trilobites = fossilsAt(loaded, 510).totals.find((total) => total.id === 'trilobites');
    expect(trilobites?.count).toBeGreaterThan(100);
    // After the end-Cretaceous, a handful only: finds whose dated range straddles it.
    const after = fossilsAt(loaded, 60).totals.find((total) => total.id === 'dinosaurs');
    expect(after?.count).toBeLessThan(10);
  });
});
