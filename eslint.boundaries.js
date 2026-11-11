// @ts-check
/**
 * One import direction for `src` (#378): a folder may import from its own tier or the tiers
 * below it, never above. Parts low in the stack can then change and be tested without the app
 * around them, and the app's wiring cannot leak down into the maths and the data.
 */

/** Lowest first. */
export const TIERS = [
  // Shared vocabulary and helpers; imports nothing from the rest of `src`.
  ['core', 'util'],
  // The domain: astronomy, calendars, eclipses, deep time, the data files and their parsing.
  ['astro', 'time', 'eclipses', 'deepTime', 'data'],
  // What the reader is looking at, and where each thing shown comes from.
  ['state', 'sources'],
  // Drawing it.
  ['globe', 'sky', 'story', 'tablets'],
  // The page around it, what is reported about it, and the site's texts to search.
  ['ui', 'telemetry', 'text'],
  // Features, each a folder of its own on one contract (#380): domain, drawing and card together.
  ['features'],
  // The wiring: `src/app.ts`, `src/main.ts`.
  ['app', 'main'],
];

/**
 * Imports against the direction that exist today, each to be removed rather than added to:
 * file (from `src/`) → the folders above it that it still reaches.
 */
export const EXCEPTIONS = {
  // Source ids are keys of the sources registry; they move below it with the feature contract (#380).
  'data/radiocarbonEvents.ts': ['sources'],
  'deepTime/polarWander.ts': ['sources'],
  'deepTime/polarWander.test.ts': ['sources'],
  // Tests checking the maths against the renderer's own helpers.
  'astro/planets.test.ts': ['sky'],
  'astro/precession.test.ts': ['globe'],
};

/** Most lines a file in `src` may have (#383): tests aside, a file this long does too much. */
export const MAX_LINES = 400;

/**
 * The files longer than MAX_LINES when it came in: each may only shrink, to MAX_LINES and off this
 * list. New work goes into a feature (#380) or a globe layer (#379), or a new file, instead.
 * `src/architecture.test.ts` asks for a limit to come down once it is 50 lines above its file.
 * Some are mostly content, not code (the deep-time milestones): theirs is to move into data
 * files, as the sources registry's did (#383).
 */
export const LINE_LIMITS = {
  'app.ts': 1443,
  'globe/scene.ts': 3140,
  'ui/deepTimeBar.ts': 1166,
  'sky/skyScene.ts': 1267,
  'ui/lineagesSheet.ts': 1105,
  'deepTime/milestones.ts': 1016,
  'ui/impactPathsSheet.ts': 744,
  'story/airShower.ts': 719,
  'story/sunCore.ts': 713,
  'globe/showerAnimation.ts': 618,
  'story/leafScene.ts': 520,
  'state/url.ts': 489,
  'time/calendars.ts': 481,
  'ui/whySheet.ts': 435,
};

const ROOT_FILES = new Set(TIERS[TIERS.length - 1]);

/**
 * @param {readonly string[]} names
 * @returns {import('eslint').Linter.RuleEntry}
 */
function rule(names) {
  if (names.length === 0) return 'off';
  const folders = names.filter((name) => !ROOT_FILES.has(name));
  const files = names.filter((name) => ROOT_FILES.has(name));
  // One or more steps up: features sit a folder deeper.
  const up = '(\\.\\./)+';
  const patterns = [];
  if (folders.length > 0) {
    patterns.push({
      regex: `^${up}(${folders.join('|')})(/|$)`,
      message: 'Imports go down the tiers in eslint.boundaries.js, not up (#378).',
    });
  }
  if (files.length > 0) {
    patterns.push({
      regex: `^${up}(${files.join('|')})$`,
      message: 'Only the entry point imports the app wiring (#378).',
    });
  }
  return ['error', { patterns }];
}

/**
 * @param {number} max
 * @returns {import('eslint').Linter.RuleEntry}
 */
const maxLines = (max) => ['error', { max, skipBlankLines: false, skipComments: false }];

/** @param {number} tier */
const above = (tier) => TIERS.slice(tier + 1).flat();

/** @type {import('eslint').Linter.Config[]} */
export const boundaries = [
  ...TIERS.flatMap((names, tier) =>
    names
      .filter((name) => !ROOT_FILES.has(name))
      .map((name) => ({
        files: [`src/${name}/**/*.ts`],
        rules: { 'no-restricted-imports': rule(above(tier)) },
      })),
  ),
  ...Object.entries(EXCEPTIONS).map(([file, allowed]) => {
    const tier = TIERS.findIndex((names) => names.includes(file.split('/')[0] ?? ''));
    return {
      files: [`src/${file}`],
      rules: {
        'no-restricted-imports': rule(above(tier).filter((name) => !allowed.includes(name))),
      },
    };
  }),
  {
    files: ['src/**/*.ts'],
    ignores: ['src/**/*.test.ts'],
    rules: { 'max-lines': maxLines(MAX_LINES) },
  },
  ...Object.entries(LINE_LIMITS).map(([file, max]) => ({
    files: [`src/${file}`],
    rules: { 'max-lines': maxLines(max) },
  })),
];
