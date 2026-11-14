import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/** The repository's root, from this file. */
const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** Every file git tracks, with its mode: 120000 is a symbolic link. */
function tracked(): { mode: string; path: string }[] {
  const listing = execFileSync('git', ['ls-files', '--stage', '-z'], {
    cwd: ROOT,
    encoding: 'utf8',
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
