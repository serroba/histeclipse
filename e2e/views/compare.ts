/**
 * The site's views compared between two builds (#628): `pnpm compare:views <base> <branch>`.
 * Captures the base build's views (views.spec.ts) into a folder, then the branch's, failing on
 * any difference; the report is in test-results/views-report, the images in test-results/views.
 */

import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [base, branch, ...rest] = process.argv.slice(2);
if (base === undefined || branch === undefined) {
  console.error('Usage: pnpm compare:views <base-url> <branch-url> [playwright options]');
  process.exit(2);
}
const folder = process.env['VIEWS_DIR'] ?? mkdtempSync(join(tmpdir(), 'histeclipse-views-'));

/** Capture the views of the build at `url`, with `options` for Playwright; its exit status. */
function capture(url: string, ...options: string[]): number {
  const run = spawnSync(
    'pnpm',
    ['exec', 'playwright', 'test', '--config', 'playwright.views.config.ts', ...options, ...rest],
    { stdio: 'inherit', env: { ...process.env, VIEWS_URL: url, VIEWS_DIR: folder } },
  );
  return run.status ?? 1;
}

process.stdout.write(`The base's views (${base}), into ${folder}\n`);
if (capture(base, '--update-snapshots=all') !== 0) {
  console.error('Could not capture the base build.');
  process.exit(1);
}
process.stdout.write(`The branch's views (${branch}), compared with them\n`);
process.exit(capture(branch));
