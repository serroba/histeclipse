import { describe, expect, it } from 'vitest';

import { servedCatalogue } from '../../vite.catalog';
import { catalogueOf, reuseOf, type ServedFile } from './servedCatalog';

const file = (path: string, bytes = 10): ServedFile => ({ path, bytes });

function entry(files: readonly ServedFile[], contents: Readonly<Record<string, unknown>>) {
  const { datasets } = catalogueOf(files, (path) => contents[path]);
  expect(datasets).toHaveLength(1);
  const [only] = datasets;
  if (only === undefined) throw new Error('no entry');
  return only;
}

describe('reuseOf', () => {
  it.each([
    ['CC BY 4.0', 'open'],
    ['CC BY-SA 4.0', 'open'],
    ['CC0 1.0', 'open'],
    ['ODbL 1.0', 'open'],
    ['Open Government Licence v3.0', 'open'],
    ['none stated (US Government work)', 'open'],
    ['Public domain (a work of the US Government)', 'open'],
    ['CC BY-NC 4.0', 'source'],
    ['CC BY 4.0; some of its station data are for non-commercial use only', 'source'],
    ['none stated; freely available from the IAP, credited', 'source'],
    ['shapefiles on OSF (no licence stated)', 'source'],
    ['CC BY-ND 4.0', 'unstated'],
    ['Smith et al. (2020), Nature 1, 2', 'unstated'],
  ] as const)('%s is %s', (licence, reuse) => {
    expect(reuseOf(licence)).toBe(reuse);
  });
});

describe('catalogueOf', () => {
  it('makes one dataset of a folder, with its describing files as parts', () => {
    const made = entry(
      [
        file('sst/index.json', 100),
        file('sst/deep.json', 50),
        file('sst/1990-01.png', 7),
        file('sst/surface/1990-02.png', 7),
        file('sst/-100.json', 5),
        file('sst/people/3.json', 5),
      ],
      {
        'sst/index.json': {
          schemaVersion: 2,
          credit: 'NOAA',
          source: 'https://example.org/sst',
          licence: 'CC BY 4.0',
          units: '°C',
          files: 'YYYY-MM.png',
        },
        'sst/deep.json': { schemaVersion: 1, credit: 'IAP, CC0', unit: 'ZJ' },
      },
    );
    expect(made).toEqual({
      id: 'sst',
      path: 'data/sst/',
      reuse: 'open',
      files: { json: 4, png: 2 },
      bytes: 174,
      parts: [
        { file: 'deep.json', schemaVersion: 1, credit: 'IAP, CC0', units: 'ZJ', reuse: 'open' },
        {
          file: 'index.json',
          schemaVersion: 2,
          credit: 'NOAA',
          source: 'https://example.org/sst',
          licence: 'CC BY 4.0',
          units: '°C',
          files: 'YYYY-MM.png',
          reuse: 'open',
        },
      ],
    });
  });

  it('makes one dataset of the top files that share a name', () => {
    const made = entry([file('vectors.json'), file('vectors.bin', 90)], {
      'vectors.json': { schemaVersion: 1 },
    });
    expect(made).toMatchObject({
      id: 'vectors',
      path: 'data/vectors',
      reuse: 'unstated',
      files: { json: 1, bin: 1 },
      bytes: 100,
    });
    expect(entry([file('stars.json')], { 'stars.json': [] })).toMatchObject({
      path: 'data/stars.json',
      parts: [{ file: 'stars.json', reuse: 'unstated' }],
    });
  });

  it('reads the credit and licence of each source inside a file', () => {
    const made = entry([file('ozone/history.json')], {
      'ozone/history.json': {
        hole: { credit: 'NASA', licence: 'Public domain' },
        gases: { credit: 'NOAA', licence: 'Public domain' },
        sources: [{ credit: 'ESA', licence: 'CC BY-NC 4.0' }, 4],
        deep: { deeper: { deepest: { licence: 'never read' } } },
        rows: Array.from({ length: 40 }, () => ({ licence: 'never read' })),
        licence: 7,
      },
    });
    expect(made.parts[0]).toEqual({
      file: 'history.json',
      credit: 'NASA; NOAA; ESA',
      licence: 'Public domain; CC BY-NC 4.0',
      reuse: 'source',
    });
    expect(made.reuse).toBe('source');
  });

  it('is unstated when one part says nothing, and has no kind for a file without one', () => {
    const made = entry(
      [file('humans/claims.json'), file('humans/species.json'), file('humans/README')],
      {
        'humans/claims.json': { schemaVersion: 2 },
        'humans/species.json': { credit: 'x', licence: 'CC BY 4.0' },
      },
    );
    expect(made.reuse).toBe('unstated');
    expect(made.files).toEqual({ json: 2, '': 1 });
    expect(entry([file('tiles/1.json')], {}).reuse).toBe('unstated');
  });

  it('sorts datasets by name and says what each reuse means', () => {
    const made = catalogueOf([file('b.json'), file('a/index.json')], () => ({}));
    expect(made.datasets.map((dataset) => dataset.id)).toEqual(['a', 'b']);
    expect(made.schemaVersion).toBe(1);
    expect(Object.keys(made.reuse)).toEqual(['open', 'source', 'unstated']);
  });
});

describe('the data the site serves', () => {
  const served = servedCatalogue(process.cwd());
  const byId = new Map(served.datasets.map((dataset) => [dataset.id, dataset]));

  it('has every dataset described by at least one file', () => {
    expect(served.datasets.length).toBeGreaterThan(80);
    expect(served.datasets.filter((dataset) => dataset.parts.length === 0)).toEqual([]);
  });

  // Decided in #1316: data under terms that are its maker's to give is marked, never offered.
  it.each([
    'volcanoes',
    'volcano-details',
    'dispersal',
    'icesheets',
    'ocean-currents',
    'ocean-temperature',
    'ocean-heat-map',
  ])('marks %s as to get from its source', (id) => {
    expect(byId.get(id)?.reuse).toBe('source');
  });

  it('offers what is openly licensed', () => {
    expect(byId.get('eruptions')?.reuse).toBe('open');
    expect(byId.get('empires')?.reuse).toBe('open');
  });
});
