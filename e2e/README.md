# End-to-end tests

Features are written as scenarios: each test is a story of Given, When and Then steps
(`test.step`) in plain Playwright. A bug starts as a scenario that fails, then gets fixed.

## Projects

| Project         | Runs                        | Why                                                                                                                |
| --------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `desktop`       | everything                  | Chrome on a laptop screen                                                                                          |
| `mobile`        | everything                  | Chrome on a Pixel 7: touch, a narrow screen                                                                        |
| `desktop-120hz` | journeys, time, layers, ice | frames at exactly 120 Hz, as on a fast Mac or phone: animation that counts frames instead of time goes wrong there |

CI also runs the `desktop` project on macOS, whose GPU limits differ from Linux's (a shader
once passed on Linux and drew a black globe on a Mac). After each deploy the whole suite runs
again against the live site.

## Journeys

What a reader does from landing to leaving, across features (`journeys.spec.ts`):

| Journey                                                               | Covers                                                          |
| --------------------------------------------------------------------- | --------------------------------------------------------------- |
| A newcomer starts with a famous eclipse and looks at the sky that day | welcome, famous eclipses, eclipse card, Sky view, Orbit         |
| A historian follows the eclipses seen from one empire                 | Layers, states and empires, Seen from, stepping, shared link    |
| A reader travels into the ice ages and back to the day they left      | time switch, deep time, Ice ages, Play to the present, Holocene |
| A link someone shares opens exactly what they saw                     | link state, famous eclipse, both sources of borders             |

## Features

| File             | Feature                                                                   |
| ---------------- | ------------------------------------------------------------------------- |
| `time.spec.ts`   | Picking the Holocene or deep time                                         |
| `layers.spec.ts` | The Layers panel: what the globe overlays, and when each layer has data   |
| `sheet.spec.ts`  | The deep-time bar as a sheet: folding and swiping its details             |
| `smoke.spec.ts`  | Everything else: loading, links, eclipses, views, sky, the Sun, deep time |

`support.ts` holds the shared steps and the `test` every file imports, which takes the
project's refresh rate.
