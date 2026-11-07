/** Everything the browser SDK needs, or nothing: telemetry is off unless a key is set. */
export interface TelemetryConfig {
  readonly apiKey: string;
  readonly endpoint: string;
  readonly serviceName: string;
  readonly serviceVersion: string;
  /** Requests to these URLs get no fetch span. */
  readonly ignoreUrls: readonly RegExp[];
}

export interface TelemetryEnv {
  readonly VITE_HONEYCOMB_INGEST_KEY?: string | undefined;
  readonly VITE_COMMIT_SHA?: string | undefined;
}

export const SERVICE_NAME = 'histeclipse-web';
/** The SDK appends `/v1/traces` (and the metrics/logs paths) itself. */
export const HONEYCOMB_US = 'https://api.honeycomb.io';

/** The dev server substitutes nothing for an unset key, the HTML template leaves `%…%`. */
function present(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' || trimmed.startsWith('%') ? null : trimmed;
}

export function telemetryConfig(env: TelemetryEnv): TelemetryConfig | null {
  const apiKey = present(env.VITE_HONEYCOMB_INGEST_KEY);
  if (apiKey === null) {
    return null;
  }
  return {
    apiKey,
    endpoint: HONEYCOMB_US,
    serviceName: SERVICE_NAME,
    serviceVersion: present(env.VITE_COMMIT_SHA) ?? 'dev',
    // Never trace the exporter's own requests to Honeycomb.
    ignoreUrls: [/^https:\/\/api\.honeycomb\.io\//],
  };
}
