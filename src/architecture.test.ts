/**
 * Checks on the shape of `src` that only ratchet one way (#383, part of #384). Each number or
 * list here may only shrink. A count may sit below its limit: lower the limit only when the test
 * asks, once the count is well below it, so that PRs working side by side do not all edit the
 * same line (#479).
 */

/// <reference types="node" />
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';

// Read from disk on each run, not through `import.meta.glob`: Vitest's module cache can keep an
// old list of files, and the check would then pass on an out-of-date picture of src.
const SRC = import.meta.dirname;
const sources: Readonly<Record<string, string>> = Object.fromEntries(
  readdirSync(SRC, { recursive: true, encoding: 'utf8' })
    .filter((path) => path.endsWith('.ts') && !path.endsWith('.test.ts'))
    .map((path) => [`./${path.split('\\').join('/')}`, readFileSync(join(SRC, path), 'utf8')]),
);

/** The folder under `src` a path is in, or `app` for a file at the top. */
function folderOf(path: string): string {
  const [first = '', second] = path.replace(/^\.\//, '').split('/');
  return second === undefined ? 'app' : first;
}

function resolve(from: string, specifier: string): string {
  const parts = from.replace(/^\.\//, '').split('/').slice(0, -1);
  for (const step of specifier.split('/')) {
    if (step === '..') parts.pop();
    else if (step !== '.') parts.push(step);
  }
  return `./${parts.join('/')}`;
}

const IMPORT =
  /(?:import|export)[^'";]*?from\s*['"](\.[^'"]+)['"]|import\(\s*['"](\.[^'"]+)['"]\s*\)/g;

/** Folder → the folders it imports from (not counting itself). */
function folderGraph(): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();
  for (const [path, text] of Object.entries(sources)) {
    const from = folderOf(path);
    const edges = graph.get(from) ?? new Set<string>();
    graph.set(from, edges);
    for (const match of text.matchAll(IMPORT)) {
      const specifier = match[1] ?? match[2] ?? '';
      const target = resolve(path, specifier);
      if (target.startsWith('./..')) continue;
      const to = folderOf(target);
      if (to !== from) edges.add(to);
    }
  }
  return graph;
}

/** The feature a path is in (`features/<name>/…`), or null outside the feature folders. */
function featureOf(path: string): string | null {
  const [top, name, rest] = path.replace(/^\.\//, '').split('/');
  return top === 'features' && rest !== undefined ? (name ?? null) : null;
}

/** What a source imports, each resolved to a path under `src` without its extension. */
function importsOf(path: string, text: string): string[] {
  return [...text.matchAll(IMPORT)].map((match) => resolve(path, match[1] ?? match[2] ?? ''));
}

/** The folders that hold the page's pieces: a piece one feature alone uses belongs in it. */
const PIECES = ['ui', 'globe', 'story', 'sky', 'tablets'];

/** Pieces one feature alone uses that stay outside it, and why (#487). Never add one lightly. */
const SHARED_ON_PURPOSE: Readonly<Record<string, string>> = {
  './story/seeded': "the story's own tests use it too",
};

function reaches(graph: Map<string, Set<string>>, from: string, to: string): boolean {
  const seen = new Set<string>();
  const queue = [from];
  while (queue.length > 0) {
    const next = queue.pop() ?? '';
    if (next === to) return true;
    if (seen.has(next)) continue;
    seen.add(next);
    queue.push(...(graph.get(next) ?? []));
  }
  return false;
}

/**
 * The imports between folders that close a cycle: none since #490. An import that would close
 * one goes the other way, or what it needs moves down to where both sides can reach it.
 */
const KNOWN_CYCLE_EDGES: readonly string[] = [];

/** Methods on the `Globe` interface in `globe/globe.ts`: new things drawn are layers (#379). */
const GLOBE_METHODS = 39;

/**
 * Variables `startApp` keeps at its top level, which any of its functions may change (#442).
 * The parts of the page keep their own; this only comes down, to none.
 */
const APP_LETS = 0;

/**
 * The decisions `startApp` makes itself: its `if`s and ternaries (#474). The parts decide what
 * is theirs, and pure functions what the input means; this only comes down.
 */
const APP_CONDITIONALS = 4;

/** How far below its limit a count may fall before the limit must come down with it (#479). */
const COUNT_SLACK = 3;

/** A count kept at most its limit, and the limit brought down once the count is well below. */
function ratchet(count: number, limit: number, what: string, name: string): void {
  expect(count, `${what} is ${String(count)}, over ${name} (${String(limit)})`).toBeLessThanOrEqual(
    limit,
  );
  expect(
    limit - count,
    `${what} is ${String(count)}: lower ${name} to ${String(count)}`,
  ).toBeLessThanOrEqual(COUNT_SLACK);
}

describe('the shape of src', () => {
  it('no folder imports its way back into itself, beyond the cycles already known', () => {
    const graph = folderGraph();
    const inCycles = [...graph]
      .flatMap(([from, targets]) => [...targets].map((to) => [from, to] as const))
      .filter(([from, to]) => reaches(graph, to, from))
      .map(([from, to]) => `${from} -> ${to}`)
      .sort();
    expect(inCycles, 'a new cycle between folders: import downwards instead').toEqual(
      [...KNOWN_CYCLE_EDGES].sort(),
    );
  });

  it('no feature imports another: they meet through the page, in app.ts (#442)', () => {
    const across = Object.entries(sources).flatMap(([path, text]) => {
      const [top, feature] = path.replace(/^\.\//, '').split('/');
      if (top !== 'features' || feature === undefined || !path.includes(`/${feature}/`)) return [];
      return [...text.matchAll(IMPORT)]
        .map((match) => resolve(path, match[1] ?? match[2] ?? ''))
        .filter((target) => {
          const [, , other] = target.split('/');
          return (
            target.startsWith('./features/') &&
            other !== undefined &&
            other !== feature &&
            target.split('/').length > 3
          );
        })
        .map((target) => `${path} -> ${target}`);
    });
    expect(across, 'pass what one feature needs of another through its context').toEqual([]);
  });

  it("outside a feature, only its index is imported: the rest is the feature's own (#487)", () => {
    const reaching = Object.entries(sources).flatMap(([path, text]) =>
      importsOf(path, text)
        .filter((target) => {
          const [top, name, inner] = target.replace(/^\.\//, '').split('/');
          return (
            top === 'features' &&
            inner !== undefined &&
            inner !== 'index' &&
            featureOf(path) !== (name ?? null)
          );
        })
        .map((target) => `${path} -> ${target}`),
    );
    expect(reaching, "export it from the feature's index.ts, and import that").toEqual([]);
  });

  it('a piece of the page that one feature alone uses lives in that feature (#487)', () => {
    const users = new Map<string, Set<string | null>>();
    for (const [path, text] of Object.entries(sources)) {
      for (const target of importsOf(path, text)) {
        const owners = users.get(target) ?? new Set<string | null>();
        owners.add(featureOf(path));
        users.set(target, owners);
      }
    }
    const single = [...users]
      .filter(([target, owners]) => {
        const [only] = owners;
        return (
          PIECES.includes(folderOf(target)) &&
          owners.size === 1 &&
          only !== null &&
          only !== undefined
        );
      })
      .map(([target]) => target)
      .sort();
    expect(single, 'move it into the feature that uses it, with its CSS and tests').toEqual(
      Object.keys(SHARED_ON_PURPOSE).sort(),
    );
  });

  it("startApp's shared variables only come down", () => {
    const app = sources['./app.ts'] ?? '';
    const lets = app.split('\n').filter((line) => /^ {2}let /.test(line)).length;
    ratchet(lets, APP_LETS, "startApp's top-level lets", 'APP_LETS');
  });

  it("startApp's conditionals only come down", () => {
    const code = (sources['./app.ts'] ?? '')
      .split('\n')
      .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
      .join('\n');
    const conditionals = [...code.matchAll(/\bif \(|[^?]\?\s/g)].length;
    ratchet(conditionals, APP_CONDITIONALS, "app.ts's ifs and ternaries", 'APP_CONDITIONALS');
  });

  it('a part of the Earth shader is light: its GLSL and uniforms, loaded with the globe (#379)', () => {
    // The globe builds its shader from the parts once, as it starts, so each part is in the
    // first download: it brings only what the shader needs. Its layer, and anything it loads,
    // goes in a module of its own.
    const parts = Object.entries(sources).filter(([, text]) =>
      /^export const \w+: EarthPart</m.test(text),
    );
    expect(parts.length, 'the parts were found').toBeGreaterThan(0);
    // Every specifier: `from '…'`, a bare `import '…'`, and `import('…')`.
    const SPECIFIER = /(?:\bfrom|\bimport)\s*\(?\s*['"]([^'"]+)['"]/g;
    const heavy = parts.flatMap(([path, text]) =>
      [...text.matchAll(SPECIFIER)]
        .map((match) => match[1] ?? '')
        .map((specifier) => (specifier.startsWith('.') ? resolve(path, specifier) : specifier))
        .filter((target) => target !== 'three' && !target.startsWith('./globe/'))
        .map((target) => `${path} -> ${target}`),
    );
    expect(heavy, 'a part imports only three and the globe').toEqual([]);
  });

  it('the Globe interface does not grow: draw new things with globe.addLayer', () => {
    const contract = sources['./globe/globe.ts'] ?? '';
    const body = /^export interface Globe \{\n([\s\S]*?)^\}/m.exec(contract)?.[1] ?? '';
    expect(body, 'the Globe interface was found in globe/globe.ts').not.toBe('');
    const methods = body.split('\n').filter((line) => /^ {2}[a-zA-Z]+[(<]/.test(line)).length;
    ratchet(methods, GLOBE_METHODS, "Globe's methods", 'GLOBE_METHODS');
  });
});

/** The line limits set in eslint.boundaries.js, which lint enforces (#383). */
function lineLimits(): Record<string, number> {
  const config = readFileSync(join(SRC, '..', 'eslint.boundaries.js'), 'utf8');
  const block = /export const LINE_LIMITS = \{([\s\S]*?)\};/.exec(config)?.[1] ?? '';
  return Object.fromEntries(
    [...block.matchAll(/'([^']+)':\s*(\d+)/g)].map((match) => [match[1] ?? '', Number(match[2])]),
  );
}

/** The most lines any file may have, set in eslint.boundaries.js. */
function maxLines(): number {
  const config = readFileSync(join(SRC, '..', 'eslint.boundaries.js'), 'utf8');
  return Number(/export const MAX_LINES = (\d+);/.exec(config)?.[1] ?? Number.NaN);
}

/** Lines as ESLint's max-lines counts them. */
function lineCount(text: string): number {
  const lines = text.split('\n').length;
  return text.endsWith('\n') ? lines - 1 : lines;
}

/** How far below its limit a file may shrink before the limit must come down with it. */
const SLACK = 50;

describe('the largest files only shrink', () => {
  const limits = Object.entries(lineLimits());

  it('has limits to check', () => {
    expect(limits.length).toBeGreaterThan(0);
  });

  it.each(limits)('the limit on %s follows it down', (file, limit) => {
    const lines = lineCount(readFileSync(join(SRC, file), 'utf8'));
    expect(
      lines,
      `src/${file} is ${String(lines)} lines, within MAX_LINES: take it off LINE_LIMITS`,
    ).toBeGreaterThan(maxLines());
    expect(
      limit - lines,
      `src/${file} is ${String(lines)} lines: lower its LINE_LIMITS entry in eslint.boundaries.js to ${String(lines)}`,
    ).toBeLessThanOrEqual(SLACK);
  });
});

/** Files the unit tests do not reach, in coverage.untested.js (#625): their number only falls. */
const UNTESTED_FILES = 133;
/** And their lines: lowered when the files shrink by more than UNTESTED_SLACK. */
const UNTESTED_LINES = 26_274;
/** Lines the untested files may shrink by before UNTESTED_LINES must come down with them. */
const UNTESTED_SLACK = 200;

/** The files coverage.untested.js names, as paths from the repository's root. */
function untested(): string[] {
  const list = readFileSync(join(SRC, '..', 'coverage.untested.js'), 'utf8');
  const block = /export const UNTESTED = \[([\s\S]*?)\];/.exec(list)?.[1] ?? '';
  return [...block.matchAll(/'([^']+)'/g)].map((match) => match[1] ?? '');
}

describe('the code the unit tests do not reach only shrinks (#625)', () => {
  const files = untested();

  it('names files, one by one, each still there', () => {
    expect(files.length, 'coverage.untested.js was read').toBeGreaterThan(0);
    expect(
      files.filter((file) => file.includes('*')),
      'no patterns',
    ).toEqual([]);
    expect(
      files.filter((file) => !existsSync(join(SRC, '..', file))),
      'take files that are gone off coverage.untested.js',
    ).toEqual([]);
  });

  it('has no more files than before: a new file gets tests', () => {
    ratchet(files.length, UNTESTED_FILES, 'Untested files', 'UNTESTED_FILES');
  });

  it('has no more lines than before: logic goes in tested modules', () => {
    const lines = files.reduce(
      (sum, file) => sum + lineCount(readFileSync(join(SRC, '..', file), 'utf8')),
      0,
    );
    expect(
      lines,
      `untested files have ${String(lines)} lines, over UNTESTED_LINES`,
    ).toBeLessThanOrEqual(UNTESTED_LINES);
    expect(
      UNTESTED_LINES - lines,
      `untested files have ${String(lines)} lines: lower UNTESTED_LINES to ${String(lines)}`,
    ).toBeLessThanOrEqual(UNTESTED_SLACK);
  });
});

/**
 * Lines in `src/style.css` (#382): a component's rules go in a `.css` file beside it, imported
 * by it, so this may only come down, to the page-wide rules and the shared tokens.
 */
const STYLE_CSS_LINES = 789;

describe('style.css only shrinks', () => {
  const lines = lineCount(readFileSync(join(SRC, 'style.css'), 'utf8'));

  it('takes no new rules: put them in a .css file beside the code they style', () => {
    expect(
      lines,
      `src/style.css is ${String(lines)} lines, over ${String(STYLE_CSS_LINES)}`,
    ).toBeLessThanOrEqual(STYLE_CSS_LINES);
  });

  it('has its limit follow it down', () => {
    expect(
      STYLE_CSS_LINES - lines,
      `src/style.css is ${String(lines)} lines: set STYLE_CSS_LINES to ${String(lines)}`,
    ).toBeLessThanOrEqual(SLACK);
  });
});

/** A number set in eslint.boundaries.js. */
function boundaryNumber(name: string): number {
  const config = readFileSync(join(SRC, '..', 'eslint.boundaries.js'), 'utf8');
  return Number(new RegExp(`export const ${name} = (\\d+);`).exec(config)?.[1] ?? Number.NaN);
}

/** The files with functions over the limits, and how many, as eslint.boundaries.js lists them. */
function functionLimits(): Record<string, number> {
  const config = readFileSync(join(SRC, '..', 'eslint.boundaries.js'), 'utf8');
  const block = /export const FUNCTION_LIMITS = \{([\s\S]*?)\};/.exec(config)?.[1] ?? '';
  return Object.fromEntries(
    [...block.matchAll(/'([^']+)':\s*(\d+)/g)].map((match) => [match[1] ?? '', Number(match[2])]),
  );
}

/** How far below its count a file may fall before the count must come down with it. */
const FUNCTION_SLACK = 1;

describe('long and tangled functions only come down (#489)', () => {
  const limits = functionLimits();

  it('has limits to check', () => {
    expect(Object.keys(limits).length).toBeGreaterThan(0);
    expect(boundaryNumber('MAX_FUNCTION_LINES')).toBeGreaterThan(0);
    expect(boundaryNumber('MAX_COMPLEXITY')).toBeGreaterThan(0);
  });

  it('each listed file keeps no more functions over the limits than it had', async () => {
    const eslint = new ESLint({
      cwd: join(SRC, '..'),
      overrideConfigFile: true,
      overrideConfig: [
        {
          files: ['**/*.ts'],
          languageOptions: { parser: tseslint.parser },
          rules: {
            'max-lines-per-function': [
              'error',
              {
                max: boundaryNumber('MAX_FUNCTION_LINES'),
                skipBlankLines: true,
                skipComments: true,
                IIFEs: true,
              },
            ],
            complexity: ['error', boundaryNumber('MAX_COMPLEXITY')],
          },
        },
      ],
    });
    const results = await eslint.lintFiles(Object.keys(limits).map((file) => `src/${file}`));
    const counts = new Map(
      results.map((result) => [
        relative(SRC, result.filePath).split('\\').join('/'),
        result.messages.filter(
          (message) =>
            message.ruleId === 'max-lines-per-function' || message.ruleId === 'complexity',
        ).length,
      ]),
    );
    const report = (file: string, limit: number): string =>
      `${file}: ${String(counts.get(file) ?? 0)} (limit ${String(limit)})`;
    const entries = Object.entries(limits);
    expect(
      entries
        .filter(([file, limit]) => (counts.get(file) ?? 0) > limit)
        .map(([f, l]) => report(f, l)),
      "a function grew past the limits: split it, rather than raising its file's count",
    ).toEqual([]);
    expect(
      entries
        .filter(([file, limit]) => limit - (counts.get(file) ?? 0) > FUNCTION_SLACK)
        .map(([f, l]) => report(f, l)),
      'lower these FUNCTION_LIMITS counts in eslint.boundaries.js (and remove those at 0)',
    ).toEqual([]);
  }, 120_000);
});
