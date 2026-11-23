import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/** The repository's root, from this file. */
const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** Every file git tracks, with its mode: 120000 is a symbolic link. */
function tracked(): { mode: string; path: string }[] {
  const listing = execFileSync('git', ['ls-files', '--stage', '-z'], {
    cwd: ROOT,
    encoding: 'utf8',
    // The listing outgrew the 1 MB default once the data held thousands of map files (#590).
    maxBuffer: 64 * 1024 * 1024,
  });
  return listing
    .split('\0')
    .filter((line) => line !== '')
    .map((line) => {
      const [mode = '', , rest = ''] = line.split(' ');
      return { mode, path: rest.split('\t')[1] ?? '' };
    });
}

describe('what the repository holds (#708)', () => {
  it('holds no symbolic links: one names a place on one machine, and a checkout can loop on it', () => {
    const files = tracked();
    expect(files.length, 'git listed the files').toBeGreaterThan(100);
    expect(files.filter(({ mode }) => mode === '120000').map(({ path }) => path)).toEqual([]);
  });
});

/** The most one file the site serves may weigh as it travels (#221): text gzipped, the rest as is. */
const SERVED_BUDGET = 4 * 1024 * 1024;
/** What GitHub Pages and Cloudflare send gzipped (Brotli where asked, smaller still). */
const COMPRESSED = /\.(json|txt|md|svg)$/;

describe('what the site serves (#221)', () => {
  it(`sends no file over ${String(SERVED_BUDGET / 1024 / 1024)} MB: split it, round it or shrink it first`, () => {
    const served = tracked().filter(({ path }) => path.startsWith('public/'));
    expect(served.length, 'git listed the public files').toBeGreaterThan(100);
    // Only a file already over as stored is compressed to check: compressing never grows one,
    // and compressing them all took seconds, past the test's time on a busy machine.
    const sent = served.map(({ path }) => {
      const bytes = readFileSync(join(ROOT, path));
      const over = bytes.length > SERVED_BUDGET && COMPRESSED.test(path);
      return { path, size: over ? gzipSync(bytes).length : bytes.length };
    });
    expect(sent.filter(({ size }) => size > SERVED_BUDGET)).toEqual([]);
  });
});
