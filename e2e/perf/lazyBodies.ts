/**
 * Whether the features split into a front and a body (#220) still load only their front with the
 * site. A feature is split when its front (`index.ts`) imports `./body` when first wanted; its
 * other files belong to the body
 * and should reach the page only when it is first wanted. A static import from a front, or a
 * re-export that drags a body module along (the extinctions' search passages did, keeping 130 KB
 * in the main chunk), puts them back in a startup chunk without failing anything else.
 *
 * Run after `pnpm build`: it reads `dist/index.html` for the startup chunks (the entry and what
 * it preloads), and each chunk's source map for the source files whose code is in it.
 *
 *   node --experimental-strip-types e2e/perf/lazyBodies.ts
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';

/** The files of a split feature's folder that are its front, loaded with the site. */
const FRONT = new Set(['index.ts', 'needs.ts', 'views.ts']);

/** Files of split features that load with the site on purpose, and why. */
const WITH_THE_SITE: Readonly<Record<string, string>> = {
  'spacecraft/launches.ts': 'the launches bar, a part of the page (#702)',
  'spacecraft/launchList.ts': 'the launches bar',
  'spacecraft/launchPace.ts': 'the launches bar',
  'spacecraft/dayPlay.ts': 'the launches bar',
  'spacecraft/missionPlay.ts': 'the launches bar',
  'spacecraft/programs.ts': 'the launches bar',
  'empires/files.ts': 'the border files, read by the eclipses and the routes too',
  'extinctions/lavaFlowsPart.ts': 'a part of the Earth shader the globe is made with',
  'extinctions/anoxicSeasPart.ts': 'a part of the Earth shader the globe is made with',
};

const VLQ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** One segment of a source map's mappings, decoded: its fields, as deltas. */
function decodeSegment(segment: string): number[] {
  const fields: number[] = [];
  let value = 0;
  let shift = 0;
  for (const char of segment) {
    const digit = VLQ.indexOf(char);
    value += (digit & 31) << shift;
    if ((digit & 32) === 0) {
      fields.push(value & 1 ? -(value >> 1) : value >> 1);
      value = 0;
      shift = 0;
    } else shift += 5;
  }
  return fields;
}

/**
 * The source files with code in `file` (a built chunk), each with how many bytes of it; none for
 * a chunk without a source map, such as Vite's own preload helper.
 */
function sourcesIn(file: string): Map<string, number> {
  if (!existsSync(`${file}.map`)) return new Map();
  const code = readFileSync(file, 'utf8').split('\n');
  const map = JSON.parse(readFileSync(`${file}.map`, 'utf8')) as {
    sources: string[];
    mappings: string;
  };
  const bytes = new Map<string, number>();
  let source = 0;
  map.mappings.split(';').forEach((line, index) => {
    let column = 0;
    const segments: [number, number][] = [];
    for (const segment of line.split(',')) {
      if (segment === '') continue;
      const fields = decodeSegment(segment);
      column += fields[0] ?? 0;
      if (fields.length > 1) source += fields[1] ?? 0;
      segments.push([column, fields.length > 1 ? source : -1]);
    }
    const length = code[index]?.length ?? 0;
    segments.forEach(([start, from], at) => {
      if (from < 0) return;
      const end = segments[at + 1]?.[0] ?? length;
      const name = map.sources[from] ?? '';
      bytes.set(name, (bytes.get(name) ?? 0) + end - start);
    });
  });
  return bytes;
}

/** The entry module and the modules the page preloads with it. */
function startupChunks(): string[] {
  const html = readFileSync('dist/index.html', 'utf8');
  return [...html.matchAll(/(?:src|href)="\.?\/?(assets\/[^"]+\.js)"/g)].map(
    (match) => `dist/${match[1] ?? ''}`,
  );
}

/**
 * The split features: those whose front imports its body when first wanted. Not every
 * `body.ts` is one: the cycle's names a celestial body.
 */
function splitFeatures(): string[] {
  return readdirSync('src/features', { withFileTypes: true })
    .filter((entry) => {
      const front = `src/features/${entry.name}/index.ts`;
      return (
        entry.isDirectory() &&
        existsSync(front) &&
        readFileSync(front, 'utf8').includes("import('./body')")
      );
    })
    .map((entry) => entry.name);
}

const split = splitFeatures();
const leaks = new Map<string, number>();
for (const chunk of startupChunks()) {
  for (const [source, bytes] of sourcesIn(chunk)) {
    const match = /src\/features\/([^/]+)\/(.+)$/.exec(source);
    if (match === null || bytes === 0) continue;
    const [, feature = '', file = ''] = match;
    if (!split.includes(feature) || FRONT.has(file)) continue;
    if (`${feature}/${file}` in WITH_THE_SITE) continue;
    const key = `src/features/${feature}/${file}`;
    leaks.set(key, (leaks.get(key) ?? 0) + bytes);
  }
}

if (leaks.size > 0) {
  console.error('Files of split features that load with the site (bytes in startup chunks):');
  for (const [file, bytes] of [...leaks].sort((a, b) => b[1] - a[1]))
    console.error(`  ${String(bytes).padStart(7)}  ${file}`);
  console.error(
    '\nA front, or something else loaded with the site, imports these, directly or through a\n' +
      're-export. Import them only from the body, or, if one must load with the site, add it to\n' +
      'WITH_THE_SITE in e2e/perf/lazyBodies.ts with the reason.',
  );
  process.exit(1);
}
process.stdout.write(
  `The ${String(split.length)} split features load only their fronts with the site.\n`,
);
