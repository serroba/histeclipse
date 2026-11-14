# PR browser acceptance suite

The required Linux job sets `E2E_SCOPE=acceptance`. The desktop project selects `@acceptance`,
the mobile project selects `@mobile`, and the 120 Hz project selects two playback wiring checks.
A scenario can carry both tags. The selection is deliberate: shared business behaviour runs
once on desktop; mobile concentrates on touch, sheet interaction, narrow layouts and a few
cross-feature journeys. A default local run still runs the full desktop/mobile regression suite.

## Assurance retained

- First load, textured output, shared links and Back/Forward.
- Eclipse selection/rendering/playback, globe picking and sky navigation.
- Deep-time and historical travel, layer state and representative data-backed feature cards.
- Actual search/semantic model loading, source navigation and historical calendars.
- Mobile touch, drag sheets, viewport boundaries, tap sizes and upright sky framing.
- Actual GPU assurance in the separate macOS job; the two animation wiring checks at 120 Hz.

Domain permutations remain in unit/property tests. The ice-age controller has feature integration
tests; controls, picker callbacks, chart SVG output and explanations have isolated DOM tests.
The lineage fan hit test is now independent of the canvas, and the remaining pointer journey
uses a known genus rather than scanning thousands of screen positions.

Other existing E2E scenarios remain nightly/on demand as extended regression coverage during
migration. They have **not** all been replaced by unit tests. Removing a scenario entirely requires
a behaviour-to-replacement mapping and evidence that the replacement catches its regression.
New browser tests must be deliberately selected for PR acceptance or documented as extended;
put new calculation/presentation permutations at their faster boundary.

## Selected execution counts

| File | Desktop | Mobile | 120 Hz |
| ---- | ------: | -----: | -----: |

Use `E2E_SCOPE=acceptance pnpm test:e2e --list` to audit the selection. Timings are recorded per
attempt; counts alone are not a runtime guarantee. Measure Actions job duration and runner-minutes
before tuning the two shards or expanding acceptance. The baseline Linux matrix scheduled 538
executions (522 passed, 16 skipped in the sampled run); this selection schedules 78.
