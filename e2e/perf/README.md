# Rendering audit

How much work the page does during representative interactions, measured the same way each time
so builds can be compared (#661). Findings live in [FINDINGS.md](FINDINGS.md).

## Running it

```sh
pnpm build
AUDIT_COMMIT=$(git rev-parse --short HEAD) REPEATS=3 PROFILE=1 \
  pnpm exec playwright test --config playwright.perf.config.ts
```

- Run on a machine with a real GPU and nothing else busy: no test suite, build or second audit
  alongside. The config launches Chromium with Metal (`--use-angle=metal`), one page at a time.
- `--project desktop` or `--project phone` runs one profile. `-g "sky drag"` runs one scenario.
- `REPEATS` (default 3) repeats each scenario. Compare medians, never a single sample.
- `PROFILE=1` also saves a CPU profile of the first repeat's active phase
  (`*.cpuprofile`, open it in the DevTools Performance panel).
- `CPU_THROTTLE` overrides the phone's fourfold CPU slowdown. `PERF_PORT` (default 4187) moves
  the preview server.
- Results land in `test-results/rendering-audit/<project>-<scenario>.json`, with the
  environment: browser, GPU, viewport, device scale, throttle, cache state and commit.

The scenario matrix is not a CI gate: its numbers depend on the machine. Required CI keeps
behavioural checks (idle stages stop requesting frames, e2e/gpu/scenes.spec.ts) without timing
thresholds.

## Profiles

| Project | Viewport   | Scale | CPU         | Input |
| ------- | ---------- | ----: | ----------- | ----- |
| desktop | 1440 × 900 |     1 | as is       | mouse |
| phone   | 412 × 915  | 2.625 | 4× throttle | mouse |

The phone profile slows the CPU only; the Mac's GPU stays fast, so it shows main-thread cost,
not a phone's GPU cost. The HTTP cache is warm: each repeat reloads the page in the same
browser context.

## Scenario matrix

Each scenario opens a page, waits until no animation frame has been requested for 500 ms, then
measures three phases:

1. **active**: the interaction itself.
2. **settle**: from the end of the interaction until 500 ms pass without an animation-frame
   callback (capped at 15 s; `quiet: false` means it never came to rest).
3. **rest**: two seconds more, which should be empty.

| Scenario                              | Active phase                                                 |
| ------------------------------------- | ------------------------------------------------------------ |
| globe idle                            | 3 s of nothing                                               |
| globe drag                            | a one-second mouse drag, a move every frame or so            |
| globe flight out to the Moon and back | the zoom rail out to the Moon's orbit, then back to Earth    |
| eclipse plays, then pauses            | the eclipse of Thales at 60 min/s for 4 s                    |
| eclipse scrubbed by keyboard          | 60 ArrowRight presses on the eclipse's time slider           |
| deep time plays, then pauses          | 250 Ma at 5 Myr/s for 4 s                                    |
| sky idle                              | 3 s of the night sky over Babylon in 3000 BCE                |
| sky drag                              | a one-second drag across that sky                            |
| sky glide to the Sun, on to the globe | a tap on the Sun: the sky's glide, then the globe takes over |
| globe to sky and back                 | Sky, 2 s there, Orbit, 1 s back on the globe                 |
| carbon-14 story plays, then pauses    | Replay of the air-shower story for 4 s, then Pause           |

## What is counted

From the page (`probe.ts`, installed before the app's scripts):

- **callbacks**: animation-frame callbacks run; **awake frames**: display frames with any.
- **gap**: the time between awake frames (median, 95th percentile, worst). It includes deliberate
  pauses inside a scenario, so read the worst gap against the action.
- **draws / drawFrames**: WebGL draw calls, and the frames with any, per canvas (named by the
  nearest `data-testid`: `globe`, `sky`, `story-3d`). A hidden view drawing shows up here.
- **sizeSets**: canvas `width`/`height` assignments per canvas, and how many set the value it
  already had. Each one reallocates the drawing buffer, even an unchanged one.
- **longFrames**: long animation frames (50 ms or more): count, total, blocking and worst.

From Chromium (`Performance.getMetrics`): main-thread task, script, layout and style time and
counts, and the JS heap at the end of the phase. Task time includes the probe's own small
overhead. Treat all times as comparisons on one machine, never as CPU or battery percentages.

Allocations and garbage collection are not counted: the heap figure only shows that nothing
grows without bound across repeats. Use a DevTools allocation profile when a finding needs it.

## Earth intermediate-map comparison (#689)

`pnpm exec playwright test --config playwright.perf.config.ts --project=desktop earthMap.perf.ts`
compares the existing 8192 map with an experimental 4096 map in the same production application.
Only the intermediate-map response is replaced; the tile manifest, tile images, camera, date and
viewport are unchanged. Three interleaved trials per map capture synchronous large-bitmap
`texSubImage2D` call durations (including other large maps; inspect the raw list), and screenshots
at 2.4, 1.6, 1.3 and 1.008 Earth radii show the transition from the base map to tiles. Difference
images amplify channel differences fourfold; numeric differences include the whole canvas, so
they are evidence to inspect, not a perceptual-quality score.

The separate **Earth map comparison** workflow can run this diagnostic on a real Mac GPU. It
also runs when the comparison itself changes in a PR. It adds no timing threshold or scenario
to the required CI gate. Its artifact contains screenshots, amplified differences and raw metrics.
Keep the 8192 source asset available for comparisons while evaluating the visual trade-off.

Results and the decision to retain the 8192 map: [EARTH-MAP.md](EARTH-MAP.md).
