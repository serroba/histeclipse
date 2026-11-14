# End-to-end tests

Features are written as scenarios: each test is a story of Given, When and Then steps
(`test.step`) in plain Playwright. A bug starts as a scenario that fails, then gets fixed.

## Projects

| Project         | Runs                                 | Why                                                                                                                |
| --------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `desktop`       | everything                           | Chrome on a laptop screen                                                                                          |
| `mobile`        | everything                           | Chrome on a Pixel 7: touch, a narrow screen                                                                        |
| `desktop-120hz` | journeys, time, layers, ice, history | frames at exactly 120 Hz, as on a fast Mac or phone: animation that counts frames instead of time goes wrong there |

CI also runs the `desktop` project on macOS, whose GPU limits differ from Linux's (a shader
once passed on Linux and drew a black globe on a Mac). After each deploy, the scenarios tagged
`@live` (via `LIVE` in `support.ts`) run against the live site: what production adds to the
tested build, such as its host, its edge cache and headers, and a stale page after a release.
The whole suite runs there daily. Against the live site, browsers add `histeclipse-live-test`
to their user agent, so analytics can leave them out.

## Journeys

What a reader does from landing to leaving, across features (`journeys.spec.ts`):

| Journey                                                               | Covers                                                          |
| --------------------------------------------------------------------- | --------------------------------------------------------------- |
| A newcomer starts with a famous eclipse and looks at the sky that day | welcome, famous eclipses, eclipse card, Sky view, Orbit         |
| A historian follows the eclipses seen from one empire                 | Layers, states and empires, Seen from, stepping, shared link    |
| A reader travels into the ice ages and back to the day they left      | time switch, deep time, Ice ages, Play to the present, Holocene |
| A link someone shares opens exactly what they saw                     | link state, famous eclipse, both sources of borders             |

## Features

| File                | Feature                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| `time.spec.ts`      | Picking the Holocene or deep time                                                                       |
| `layers.spec.ts`    | The Layers panel: what the globe overlays, and when each layer has data                                 |
| `sheet.spec.ts`     | The deep-time bar as a sheet: folding and swiping its details                                           |
| `humans.spec.ts`    | Humans in the ice ages: dated finds, and competing claims side by side                                  |
| `genomes.spec.ts`   | Ancient genomes: AADR genomes counted by region around the year shown                                   |
| `history.spec.ts`   | Travelling through the Holocene: playing the years, states coming and going                             |
| `ice.spec.ts`       | Ice sheets in the ice ages: Batchelor et al.'s outlines and their range                                 |
| `fullview.spec.ts`  | Full view: clearing the panels, and deep time's strip                                                   |
| `chart.spec.ts`     | Geological time along the slider: the chart's units in its colours                                      |
| `air.spec.ts`       | The air in the ice ages: CO₂ and methane against 1750                                                   |
| `ways.spec.ts`      | Ways of life: ArchaeoGLOBE's regions by how people lived                                                |
| `rocks.spec.ts`     | Rocks at the surface: Macrostrat's map, and deep time at a rock's age                                   |
| `fossils.spec.ts`   | Fossils in deep time: PBDB finds where they lay then                                                    |
| `tree.spec.ts`      | The tree of life: a taxon's line to the first cells, from a find, Layers or a link                      |
| `poles.spec.ts`     | Poles and the magnetic field in deep time: the spin axis, magnetic north, and every reversal (GTS 2020) |
| `impacts.spec.ts`   | Impact craters: today and where they lay, each with a card                                              |
| `craters.spec.ts`   | Impacts through time: each crater's path as its plate moved, in 3D                                      |
| `lineages.spec.ts`  | Life through time: each fossil group's genera as a radial tree of time, beside the map of the moment    |
| `volcanoes.spec.ts` | Volcanic eruptions: GVP's eruptions near the year, each with a card                                     |
| `periods.spec.ts`   | Named periods: PeriodO's periods for the place picked, each by its source                               |
| `sources.spec.ts`   | Why this? The sources of what is on screen, each with its book and licence                              |
| `playback.spec.ts`  | Playing deep time on a slow connection: map after map, loaded ahead                                     |
| `smoke.spec.ts`     | Everything else: loading, links, eclipses, views, sky, the Sun, deep time                               |

`support.ts` holds the shared steps and the `test` every file imports, which takes the
project's refresh rate.

## Timing baseline

CI writes `test-results/timings.json` and `timings.md` for each browser job, even
on test failures. The small `timings-*` artifacts are retained for 30 days; the Actions
job summary lists project counts and the 20 slowest scenarios, including retry cost.
The JSON records every selected scenario, its project, outcome and each attempt.
Use run ID, run attempt, shard and platform to group reports without mixing reruns.

Summed attempt duration includes parallel work: it is not wall time or runner-minutes.
The report's wall time covers Playwright, not setup or queueing; use Actions job timestamps
for runner cost and workflow timestamps for overall CI latency. Compare execution counts,
retry rates and p95 latency across representative PR runs before changing shard counts.
Test selection and retries are unchanged by reporting (#645, epic #644).
