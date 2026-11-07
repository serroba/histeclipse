import { describe, expect, it } from 'vitest';

import { HONEYCOMB_US, SERVICE_NAME, telemetryConfig } from './config';

describe('telemetryConfig', () => {
  it('is off without a key', () => {
    expect(telemetryConfig({})).toBeNull();
    expect(telemetryConfig({ VITE_HONEYCOMB_INGEST_KEY: '' })).toBeNull();
    expect(telemetryConfig({ VITE_HONEYCOMB_INGEST_KEY: '   ' })).toBeNull();
  });

  it('is off when the key is an unreplaced placeholder', () => {
    expect(
      telemetryConfig({ VITE_HONEYCOMB_INGEST_KEY: '%VITE_HONEYCOMB_INGEST_KEY%' }),
    ).toBeNull();
  });

  it('sends to Honeycomb US as histeclipse-web, versioned by commit', () => {
    const config = telemetryConfig({
      VITE_HONEYCOMB_INGEST_KEY: ' hcaik_abc ',
      VITE_COMMIT_SHA: 'bf3d1b4',
    });
    expect(config).toMatchObject({
      apiKey: 'hcaik_abc',
      endpoint: HONEYCOMB_US,
      serviceName: SERVICE_NAME,
      serviceVersion: 'bf3d1b4',
    });
  });

  it('falls back to a dev version and never traces its own export', () => {
    const config = telemetryConfig({
      VITE_HONEYCOMB_INGEST_KEY: 'k',
      VITE_COMMIT_SHA: '%VITE_COMMIT_SHA%',
    });
    expect(config?.serviceVersion).toBe('dev');
    expect(config?.ignoreUrls.some((re) => re.test(`${HONEYCOMB_US}/v1/traces`))).toBe(true);
    expect(
      config?.ignoreUrls.some((re) =>
        re.test('https://serroba.github.io/histeclipse/data/sky.json'),
      ),
    ).toBe(false);
  });
});
