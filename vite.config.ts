import { defineConfig } from 'vitest/config';

import { models } from './vite.models.ts';

export default defineConfig({
  // Served at https://histeclipse.limits.world/ (#240). Relative, so the build also works under
  // a path, as it once did at serroba.github.io/histeclipse/: every page is index.html at the
  // site's root, so './' always resolves to the right place.
  base: './',
  plugins: [models()],
  build: {
    target: 'es2023',
    sourcemap: true,
    // three.js alone is ~500 kB minified (~140 kB gzipped); one chunk is fine for now.
    chunkSizeWarningLimit: 700,
  },
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // Browser/WebGL glue: the Playwright suite in e2e/ covers it in a real browser. Keep
      // these files thin and put logic in unit-tested modules.
      exclude: [
        'src/**/*.test.ts',
        'src/main.ts',
        'src/telemetry/start.ts',
        'src/app.ts',
        'src/globe/scene.ts',
        'src/globe/solarShaders.ts',
        'src/globe/temperatureShader.ts',
        'src/globe/empireCanvas.ts',
        'src/globe/arrivalGrid.ts',
        'src/globe/planetMeshes.ts',
        'src/globe/moonMeshes.ts',
        'src/features/spacecraft/craftLayer.ts',
        'src/features/asteroids/beltLayer.ts',
        'src/text/embedder.ts',
        'src/text/meaningLoader.ts',
        'src/globe/layerHost.ts',
        'src/features/volcanoes/volcanoLayer.ts',
        'src/globe/impactLayer.ts',
        'src/features/fossils/fossilLayer.ts',
        'src/features/genomes/genomeLayer.ts',
        'src/features/humans/humanSiteLayer.ts',
        'src/globe/placeNameLayer.ts',
        'src/globe/moonNameLayer.ts',
        'src/globe/magneticNorthLayer.ts',
        'src/globe/labelTexture.ts',
        'src/globe/historyPaintLayers.ts',
        'src/globe/iceOutlineLayer.ts',
        'src/globe/impactAnimation.ts',
        'src/globe/showerAnimation.ts',
        'src/sky/skyScene.ts',
        'src/sky/skyLabels.ts',
        'src/story/sunCore.ts',
        'src/story/airShower.ts',
        'src/story/leafScene.ts',
        'src/story/boundaryWheel.ts',
        'src/story/storyScene.ts',
        'src/ui/**',
      ],
      thresholds: {
        statements: 95,
        branches: 95,
        functions: 95,
        lines: 95,
      },
    },
  },
});
