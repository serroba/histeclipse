# Focused GPU probes

The required macOS GPU job runs five production smoke scenarios for the Sun, planets, sky and
eclipse materials, then five component probes against production scene factories. The latter
mount the Earth with the complete eclipse shader parts and carbon-14 glow, and every chapter
of the Sun, air-shower, land and water stories. Chapters settle explicitly instead of playing
for seconds. Each scene gets a real WebGL renderer on the Mac runner.

`index.html` and `harness.ts` are test-only Vite entry points, excluded from the production
acceptance project and from the production build. They do not ship in the site. The actual
production scene modules are imported directly: no shaders are copied into the tests.

Each chapter must report a completed draw, emit no JavaScript/shader errors and produce a
compositor screenshot with foreground pixels. Pixel statistics are read by the browser's own
PNG decoder; a rendered flag alone cannot detect a black canvas. This checks meaningful output,
not a pixel-perfect scientific or visual baseline. The full application rendering narratives
still run on macOS nightly; Phoria and the lineage fan are 2D-canvas renderers, not WebGL shader
families that need a separate Mac shader gate.

Run `pnpm exec playwright test --config playwright.gpu.config.ts`. The separate output directory
and `TIMING_REPORT_NAME=timings-components` in CI preserve both the production and component
reports. The production HTML report also keeps a separate component subfolder.
