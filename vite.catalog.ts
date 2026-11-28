/**
 * The data catalogue, written with the site (#1317): `data/catalog.json` lists every dataset under
 * `public/data`, from the files as they are at build time (`src/data/servedCatalog.ts`). The dev
 * server answers the same address, so the catalogue is never a file to keep by hand.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import type { Plugin } from 'vite';

import { catalogueOf, type Catalogue, type ServedFile } from './src/data/servedCatalog.ts';

const ADDRESS = 'data/catalog.json';

/** Every file under `folder`, by its path from there. */
function filesUnder(folder: string, prefix = ''): ServedFile[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry): ServedFile[] => {
    const path = join(folder, entry.name);
    const name = `${prefix}${entry.name}`;
    if (entry.isDirectory()) return filesUnder(path, `${name}/`);
    return [{ path: name, bytes: statSync(path).size }];
  });
}

/** The catalogue of the data under `root`'s `public/data`, as it is now. */
export function servedCatalogue(root: string): Catalogue {
  const data = join(root, 'public', 'data');
  return catalogueOf(
    filesUnder(data),
    (path) => JSON.parse(readFileSync(join(data, path), 'utf8')) as unknown,
  );
}

/** Serve the catalogue in development and write it into the build. */
export function catalogue(): Plugin {
  return {
    name: 'histeclipse-catalogue',
    configureServer(server) {
      server.middlewares.use(`/${ADDRESS}`, (_request, response) => {
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.end(JSON.stringify(servedCatalogue(server.config.root)));
      });
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: ADDRESS,
        source: JSON.stringify(servedCatalogue(process.cwd())),
      });
    },
  };
}
