import type { TelemetryConfig } from './config';

/**
 * Starts the Honeycomb browser SDK: page load, data-file fetches, clicks, web vitals and
 * uncaught errors. The SDK is a separate chunk loaded only when a key is configured, so
 * builds without one (CI, local dev without `.env.local`) ship and run none of it.
 */
export async function startTelemetry(config: TelemetryConfig): Promise<void> {
  const [{ HoneycombWebSDK }, { getWebAutoInstrumentations }] = await Promise.all([
    import('@honeycombio/opentelemetry-web'),
    import('@opentelemetry/auto-instrumentations-web'),
  ]);
  const ignoreUrls = [...config.ignoreUrls];
  const sdk = new HoneycombWebSDK({
    apiKey: config.apiKey,
    endpoint: config.endpoint,
    serviceName: config.serviceName,
    serviceVersion: config.serviceVersion,
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
