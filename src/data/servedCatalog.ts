/**
 * The catalogue of the data the site serves (#1317): one entry for each dataset under `data/`,
 * saying where its files are, what each says of its own credit, source, licence and units, and
 * whether it may be taken from here. The build writes it to `data/catalog.json`
 * (`vite.catalog.ts`), from the files themselves, so it cannot list what is not served nor miss
 * what is.
 *
 * It repeats what the files state and adds nothing: a dataset whose files name no licence reads
 * `unstated` until its header says (#1318).
 */

/** A file under `public/data`, by its path from there, with `/` between folders. */
export interface ServedFile {
  readonly path: string;
  readonly bytes: number;
}

/**
 * Whether a dataset may be taken from this site. `open`: its licence lets anyone reuse it, with
 * the credit it asks. `source`: shown here, but its terms are its maker's to give (non-commercial,
 * or no licence stated), so get it from the source. `unstated`: the file does not say yet.
 */
export type Reuse = 'open' | 'source' | 'unstated';

/** What one describing file says of itself. */
interface CataloguePart {
  readonly file: string;
  readonly schemaVersion?: number;
  /** Ids in the site's registry of sources, where the file has its header (#1318). */
  readonly sources?: readonly string[];
  readonly credit?: string;
  readonly source?: string;
  readonly licence?: string;
  readonly accessed?: string;
  /** What this site did to the source's data. */
  readonly changes?: string;
  /** One text, or one for each column. */
  readonly units?: string | Readonly<Record<string, string>>;
  /** How its other files are named, where it says (`YYYY-MM.png`). */
  readonly files?: string;
  readonly reuse: Reuse;
}

interface CatalogueEntry {
  readonly id: string;
  /** From the site's root: a folder ends in `/`. */
  readonly path: string;
  readonly reuse: Reuse;
  /** How many files of each kind, by extension. */
  readonly files: Readonly<Record<string, number>>;
  readonly bytes: number;
  readonly parts: readonly CataloguePart[];
}

export interface Catalogue {
  readonly schemaVersion: 1;
  readonly about: string;
  readonly reuse: Readonly<Record<Reuse, string>>;
  readonly datasets: readonly CatalogueEntry[];
}

const ABOUT =
  'Every dataset this site serves under data/, written by the build from the files themselves. ' +
  'Each part repeats what its file states. Credit the sources, not this site.';

const REUSE: Readonly<Record<Reuse, string>> = {
  open: 'Its licence lets anyone reuse it, with the credit it asks.',
  source:
    'Shown here; get it from the source. Its terms are non-commercial, or its maker states no licence.',
  unstated: 'The file does not state its licence yet. Ask its source before reusing it.',
};

/** One file a century, a step or a tile: data, not a description of it. */
const CHUNK = /^-?\d+(?:\.\d+)?\.json$/;

const RESTRICTED = /non-?commercial|\bBY-NC\b|all rights reserved/i;
const NONE_STATED = /none stated|no licence stated/i;
const PUBLIC = /US Government|public domain/i;
const OPEN =
  /\bCC0\b|\bCC BY(?:-SA)?\b(?!-)|\bODbL\b|Open Government Licence|\bGPL\b|\bMIT\b|free and open|open access|no restrictions/i;

/** What a licence, in its maker's words, lets a reader do with the copy served here. */
export function reuseOf(licence: string): Reuse {
  if (RESTRICTED.test(licence)) return 'source';
  if (PUBLIC.test(licence)) return 'open';
  if (NONE_STATED.test(licence)) return 'source';
  return OPEN.test(licence) ? 'open' : 'unstated';
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Lists longer than this are data, not descriptions; nothing under them is read. */
const LONGEST_LIST = 32;

/**
 * Every text a file gives under one of `keys`, at its top or up to two levels in: a file drawn
 * from several sources states each one's credit and licence in its own part.
 */
function stated(json: unknown, keys: readonly string[], depth = 0): string[] {
  if (Array.isArray(json)) {
    if (json.length > LONGEST_LIST) return [];
    return json.flatMap((item: unknown) => stated(item, keys, depth));
  }
  if (!isRecord(json)) return [];
  const found: string[] = [];
  for (const [key, value] of Object.entries(json)) {
    if (keys.includes(key)) {
      if (typeof value === 'string') found.push(value);
    } else if (depth < 2) {
      found.push(...stated(value, keys, depth + 1));
    }
  }
  return found;
}

function joined(texts: readonly string[]): string | undefined {
  const distinct = [...new Set(texts)];
  return distinct.length === 0 ? undefined : distinct.join('; ');
}

function text(json: Readonly<Record<string, unknown>>, key: string): string | undefined {
  const value = json[key];
  return typeof value === 'string' ? value : undefined;
}

function texts(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const found = value.filter((item: unknown) => typeof item === 'string');
  return found.length === 0 ? undefined : found;
}

function unitsOf(top: Readonly<Record<string, unknown>>): CataloguePart['units'] {
  const units = top['units'];
  if (isRecord(units)) {
    const named = Object.entries(units).filter(
      (pair): pair is [string, string] => typeof pair[1] === 'string',
    );
    if (named.length > 0) return Object.fromEntries(named);
  }
  return text(top, 'units') ?? text(top, 'unit');
}

function partOf(file: string, json: unknown): CataloguePart {
  const top = isRecord(json) ? json : {};
  const version = top['schemaVersion'];
  const credit = joined(stated(json, ['credit']));
  const licence = joined(stated(json, ['licence', 'license']));
  const source = text(top, 'source');
  const units = unitsOf(top);
  const sources = texts(top['sources']);
  const accessed = text(top, 'accessed');
  const changes = text(top, 'changes');
  const files = text(top, 'files');
  const terms = licence ?? credit;
  return {
    file,
    ...(typeof version === 'number' ? { schemaVersion: version } : {}),
    ...(sources === undefined ? {} : { sources }),
    ...(credit === undefined ? {} : { credit }),
    ...(source === undefined ? {} : { source }),
    ...(licence === undefined ? {} : { licence }),
    ...(accessed === undefined ? {} : { accessed }),
    ...(changes === undefined ? {} : { changes }),
    ...(units === undefined ? {} : { units }),
    ...(files === undefined ? {} : { files }),
    reuse: terms === undefined ? 'unstated' : reuseOf(terms),
  };
}

/** The strictest of its parts: one part to get from the source makes the dataset so. */
function reuseOfAll(parts: readonly CataloguePart[]): Reuse {
  if (parts.some((part) => part.reuse === 'source')) return 'source';
  return parts.length > 0 && parts.every((part) => part.reuse === 'open') ? 'open' : 'unstated';
}

function extension(path: string): string {
  const name = path.slice(path.lastIndexOf('/') + 1);
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot + 1);
}

interface Gathered {
  readonly folder: boolean;
  readonly files: ServedFile[];
}

/**
 * The catalogue of `files`. A folder is one dataset; so are the files at the top that share a
 * name (`passage-vectors.json` and `.bin`). `read` gives a JSON file's content: it is asked only
 * for the files that describe a dataset, never for the chunks.
 */
export function catalogueOf(
  files: readonly ServedFile[],
  read: (path: string) => unknown,
): Catalogue {
  const gathered = new Map<string, Gathered>();
  for (const file of files) {
    const slash = file.path.indexOf('/');
    const folder = slash >= 0;
    const id = folder ? file.path.slice(0, slash) : file.path.replace(/\.[^.]*$/, '');
    const entry = gathered.get(id) ?? { folder, files: [] };
    entry.files.push(file);
    gathered.set(id, entry);
  }
  const datasets = [...gathered.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([id, { folder, files: own }]): CatalogueEntry => {
      const counts: Record<string, number> = {};
      for (const file of own) {
        const kind = extension(file.path);
        counts[kind] = (counts[kind] ?? 0) + 1;
      }
      const parts = own
        .map((file) => (folder ? file.path.slice(id.length + 1) : file.path))
        .filter((name) => name.endsWith('.json') && !name.includes('/') && !CHUNK.test(name))
        .sort()
        .map((name) => partOf(name, read(folder ? `${id}/${name}` : name)));
      return {
        id,
        path: folder ? `data/${id}/` : `data/${own.length === 1 ? (own[0]?.path ?? id) : id}`,
        reuse: reuseOfAll(parts),
        files: counts,
        bytes: own.reduce((sum, file) => sum + file.bytes, 0),
        parts,
      };
    });
  return { schemaVersion: 1, about: ABOUT, reuse: REUSE, datasets };
}
