/**
 * Every data file the site serves opens with the same header (#1318): its sources by their ids
 * here, its credit, licence, the day fetched and what the site changed. The files not there yet
 * are listed in `headerless.json`, which only shrinks: a file brought up to the header must leave
 * the list, and no new file may join it.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { servedCatalogue } from '../../vite.catalog';
import { HeaderSchema } from '../data/header';
import headerless from './headerless.json' with { type: 'json' };
import { SOURCES } from './registry';

const data = join(process.cwd(), 'public', 'data');

/** Each describing file, by its path under `data/`. */
const described = servedCatalogue(process.cwd()).datasets.flatMap((dataset) =>
  dataset.parts.map((part) =>
    dataset.path.endsWith('/') ? `${dataset.id}/${part.file}` : part.file,
  ),
);

const headers = new Map(
  described.map((path) => {
    const read: unknown = JSON.parse(readFileSync(join(data, path), 'utf8'));
    return [path, v.safeParse(HeaderSchema, read)] as const;
  }),
);

const withHeader = [...headers].flatMap(([path, parsed]) =>
  parsed.success ? [[path, parsed.output] as const] : [],
);

describe('the headers of the served data', () => {
  it('lists exactly the files still without one', () => {
    const without = [...headers].filter(([, parsed]) => !parsed.success).map(([path]) => path);
    expect(without.sort()).toEqual([...headerless].sort());
  });

  it('has files with one already', () => {
    expect(withHeader.length).toBeGreaterThan(0);
  });

  it.each(withHeader)('%s names sources the registry has, under their licences', (_, header) => {
    for (const id of header.sources) {
      expect(Object.keys(SOURCES)).toContain(id);
      const licence = (SOURCES as Readonly<Record<string, { licence?: string }>>)[id]?.licence;
      if (licence !== undefined) expect(header.licence).toContain(licence);
    }
  });
});
