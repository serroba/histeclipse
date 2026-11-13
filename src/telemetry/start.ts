import { trace } from '@opentelemetry/api';

import { cachedViewAttributes, probeGpu } from './attributes';
import type { TelemetryConfig } from './config';
import { fetchEdgeAttributes } from './edge';
import { startLongFrames } from './frameWatch';

/**
 * Starts the Honeycomb browser SDK: page load, data-file fetches, clicks, web vitals, uncaught
 * errors and the longest long animation frames (#636). Every span also carries the view shown
 * (from the URL), the GPU's capabilities, and the country Cloudflare places the reader in. The
 * SDK is a separate chunk loaded only when a key is configured, so builds without one (CI, local
 * dev without `.env.local`) ship and run none of it.
 */
export async function startTelemetry(config: TelemetryConfig): Promise<void> {
  // Asked before the SDK starts, so the first spans have it and the request itself has none.
  const [{ HoneycombWebSDK }, { getWebAutoInstrumentations }, edge] = await Promise.all([
    import('@honeycombio/opentelemetry-web'),
    import('@opentelemetry/auto-instrumentations-web'),
    fetchEdgeAttributes((url, init) => fetch(url, init)),
  ]);
  const ignoreUrls = [...config.ignoreUrls];
  const viewFor = cachedViewAttributes(() => new Date());
  const gpu = probeGpu(document.createElement('canvas'), window.devicePixelRatio);
  const frames = startLongFrames(trace.getTracer('histeclipse'), window);
  const sdk = new HoneycombWebSDK({
    apiKey: config.apiKey,
    endpoint: config.endpoint,
    serviceName: config.serviceName,
    serviceVersion: config.serviceVersion,
    spanProcessors: [
      {
        onStart(span) {
          span.setAttributes({ ...viewFor(window.location.search), ...gpu, ...edge });
        },
        onEnd() {
          // Attributes are set at start; nothing to do once the span ends.
        },
        forceFlush: () => Promise.resolve(),
        shutdown: () => Promise.resolve(),
      },
    ],
    // Each INP span names the longest frame of its interaction and what was on screen (#636).
    webVitalsInstrumentationConfig: { inp: { applyCustomAttributes: frames.annotateInp } },
    instrumentations: [
      getWebAutoInstrumentations({
        '@opentelemetry/instrumentation-document-load': {},
        '@opentelemetry/instrumentation-fetch': { ignoreUrls },
        '@opentelemetry/instrumentation-xml-http-request': { ignoreUrls },
        // Clicks only: pointer and wheel events on the globe would be a span per frame.
        '@opentelemetry/instrumentation-user-interaction': { eventNames: ['click'] },
      }),
    ],
  });
  sdk.start();
}
