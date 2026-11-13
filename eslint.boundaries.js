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
 * `src/architecture.test.ts` asks for a limit to come down once it is 50 lines above its file:
 * lower it then, not in every PR that shortens the file, so PRs side by side do not all edit
 * the same line (#479).
 */
export const LINE_LIMITS = {
  'app.ts': 789,
  'globe/scene.ts': 1325,
  'ui/deepTimeBar.ts': 779,
  'sky/skyScene.ts': 971,
  'features/treeOfLife/lineagesSheet.ts': 583,
  'ui/impactPathsSheet.ts': 744,
  'features/shower/airShower.ts': 719,
  'features/shower/sunCore.ts': 713,
  'globe/showerAnimation.ts': 618,
  'features/shower/leafScene.ts': 520,
  'time/calendars.ts': 481,
  'ui/whySheet.ts': 435,
};

/**
 * Most lines of code a function in `src` may have, blank lines and comments aside (#489): a file
 * can stay short while one function in it does too much.
 */
export const MAX_FUNCTION_LINES = 80;

/** Most paths through a function in `src` (#489): more, and it decides too much on its own. */
export const MAX_COMPLEXITY = 15;

/**
 * The files with functions over those limits when they came in, and how many: a count may only
 * come down, and the entry goes at none. `src/architecture.test.ts` counts them; lint holds
 * every other file to the limits. Lower a count when the test asks, not in every PR (#479).
 */
export const FUNCTION_LIMITS = {
  'app.ts': 1,
  'data/impacts.ts': 1,
  'data/lineages.ts': 1,
  'features/bodies/bodyBar.ts': 1,
  'features/bodies/index.ts': 3,
  'features/bodies/moonNameLayer.ts': 2,
  'features/bodies/placeNameLayer.ts': 1,
  'features/bodies/planets.ts': 1,
  'features/boundaries/boundariesSheet.ts': 1,
  'features/boundaries/boundaryWheel.ts': 1,
  'features/boundaries/holoceneChart.ts': 2,
  'features/boundaries/index.ts': 1,
  'features/carbonMade/carbonMadeCard.ts': 1,
  'features/carbonMade/index.ts': 2,
  'features/cycle/cycleTrack.ts': 1,
  'features/cycle/index.ts': 1,
  'features/dates/index.ts': 1,
  'features/deepSurfaces/index.ts': 1,
  'features/deepTime/deepGlance.ts': 1,
  'features/deepTime/index.ts': 3,
  'features/eclipses/index.ts': 1,
  'features/eclipses/seen.ts': 1,
  'features/empires/index.ts': 1,
  'features/famous/famousPanel.ts': 1,
  'features/fossils/index.ts': 1,
  'features/humans/index.ts': 1,
  'features/iceAges/index.ts': 2,
  'features/impacts/index.ts': 1,
  'features/layersPanel/layersPanel.ts': 2,
  'features/moment/index.ts': 1,
  'features/records/index.ts': 1,
  'features/records/tabletPanel.ts': 1,
  'features/shower/airShower.ts': 3,
  'features/shower/index.ts': 2,
  'features/shower/leafScene.ts': 2,
  'features/shower/showerStage.ts': 1,
  'features/shower/sunCore.ts': 1,
  'features/sky/index.ts': 1,
  'features/temperature/temperatureLayer.ts': 1,
  'features/texts/searchPanel.ts': 1,
  'features/treeOfLife/lineagesSheet.ts': 1,
  'features/treeOfLife/treeSheet.ts': 1,
  'features/years/index.ts': 1,
  'features/years/radiocarbonStrip.ts': 1,
  'globe/impactAnimation.ts': 1,
  'globe/moonMeshes.ts': 1,
  'globe/planetMeshes.ts': 1,
  'globe/scene.ts': 1,
  'globe/showerAnimation.ts': 3,
  'globe/showerSteps.ts': 1,
  'sky/skyScene.ts': 1,
  'state/url.ts': 1,
  'state/urlSync.ts': 1,
  'story/storyScene.ts': 1,
  'text/wordpiece.ts': 1,
  'ui/datingCard.ts': 1,
  'ui/deepTimeBar.ts': 3,
  'ui/historyTrack.ts': 1,
  'ui/impactPathsSheet.ts': 3,
  'ui/periodBands.ts': 2,
  'ui/seaLevelChart.ts': 1,
  'ui/timeline.ts': 1,
  'ui/whySheet.ts': 2,
  'ui/yearWheel.ts': 2,
  'ui/zoomRail.ts': 1,
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

/**
 * The function limits as lint rules (#489).
 * @returns {import('eslint').Linter.RulesRecord}
 */
function functionRules() {
  return {
    'max-lines-per-function': [
      'error',
      { max: MAX_FUNCTION_LINES, skipBlankLines: true, skipComments: true, IIFEs: true },
    ],
    complexity: ['error', MAX_COMPLEXITY],
  };
}

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
  {
    files: ['src/**/*.ts'],
    ignores: ['src/**/*.test.ts', ...Object.keys(FUNCTION_LIMITS).map((file) => `src/${file}`)],
    rules: functionRules(),
  },
];
