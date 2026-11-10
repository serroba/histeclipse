/**
 * Checks on the shape of `src` that only ratchet one way (#383, part of #384). Each number or
 * list here may only shrink: lower it in the PR that earns it, and the test asks you to.
 */

/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

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
 * The imports between folders that close a cycle today: each is a way back to a folder that
 * reaches this one. Remove an entry when its imports go; never add one.
 */
const KNOWN_CYCLE_EDGES: readonly string[] = [
  // Within the domain: the data files lean on the calendars, eclipses and deep time, which lean
  // back on the data's loaders and tables.
  'astro -> data',
  'astro -> time',
  'data -> deepTime',
  'data -> eclipses',
  'data -> time',
  'deepTime -> data',
  'eclipses -> data',
  'eclipses -> time',
  'time -> data',
  // Source ids, keys of the sources registry, used by the data (#380 moves them down).
  'data -> sources',
  'deepTime -> sources',
  'sources -> data',
  // The view state builds its unions from the domain's types; the registry names its layers.
  'sources -> state',
  'state -> astro',
  'state -> data',
  'state -> deepTime',
  'state -> eclipses',
  'state -> sources',
  'state -> time',
];

/** Methods on the `Globe` interface in `globe/scene.ts`: new things drawn are layers (#379). */
const GLOBE_METHODS = 49;

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

  it('the Globe interface does not grow: draw new things with globe.addLayer', () => {
    const scene = sources['./globe/scene.ts'] ?? '';
    const body = /^export interface Globe \{\n([\s\S]*?)^\}/m.exec(scene)?.[1] ?? '';
    const methods = body.split('\n').filter((line) => /^ {2}[a-zA-Z]+[(<]/.test(line)).length;
    expect(methods, `Globe has ${String(methods)} methods; set GLOBE_METHODS to it`).toBe(
      GLOBE_METHODS,
    );
  });
});
