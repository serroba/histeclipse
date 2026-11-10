/**
 * The models the site serves, fetched before Vite serves or builds it (#393): each file
 * `models.lock.json` pins, from its repository at its revision, checked against its SHA-256 and
 * written under `public/models/`, which git ignores for files this large. A file already there
 * and matching is kept, so this asks the network once.
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { Plugin } from 'vite';

interface Lock {
  readonly name: string;
  readonly repo: string;
  readonly revision: string;
  readonly files: Readonly<Record<string, string>>;
  /** The files the site serves; the rest are the pipeline's. */
  readonly site: readonly string[];
}

async function sha256Of(path: string): Promise<string | null> {
  try {
    return createHash('sha256')
      .update(await readFile(path))
      .digest('hex');
  } catch {
    return null;
  }
}

export async function fetchModels(root: string): Promise<void> {
  const raw = await readFile(join(root, 'models.lock.json'), 'utf8');
  const { embedding } = JSON.parse(raw) as { embedding: Lock };
  for (const name of embedding.site) {
    const sha256 = embedding.files[name];
    if (sha256 === undefined) throw new Error(`models.lock.json pins no ${name}`);
    const path = join(root, 'public', 'models', embedding.name, name);
    if ((await sha256Of(path)) === sha256) continue;
    const url = `https://huggingface.co/${embedding.repo}/resolve/${embedding.revision}/${name}`;
    const response = await fetch(url, { headers: { 'User-Agent': 'histeclipse-build' } });
    if (!response.ok) throw new Error(`${url}: HTTP ${String(response.status)}`);
    const body = Buffer.from(await response.arrayBuffer());
    const digest = createHash('sha256').update(body).digest('hex');
    if (digest !== sha256) {
      throw new Error(`${name}: SHA-256 ${digest} does not match the pinned ${sha256}`);
    }
    await mkdir(dirname(path), { recursive: true });
    await writeFile(`${path}.part`, body);
    await rename(`${path}.part`, path);
  }
}

/** Fetch the models before serving or building; never under the unit tests. */
export function models(): Plugin {
  return {
    name: 'histeclipse-models',
    apply: () => process.env['VITEST'] === undefined,
    async buildStart() {
      await fetchModels(process.cwd());
    },
  };
}
