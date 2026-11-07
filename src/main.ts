import './style.css';

import { SpanStatusCode, trace } from '@opentelemetry/api';

import { startApp } from './app';
import { telemetryConfig } from './telemetry/config';
import { errorMessage } from './util/errors';

const root = document.querySelector<HTMLElement>('#app');
if (root === null) {
  throw new Error('Missing #app root element');
}

/** Loads the SDK alongside the app, never ahead of it; failures only cost the traces. */
function loadTelemetry(): Promise<void> {
  const config = telemetryConfig(import.meta.env);
  if (config === null) {
    return Promise.resolve();
  }
  return import('./telemetry/start')
    .then(({ startTelemetry }) => startTelemetry(config))
    .catch((error: unknown) => {
      console.warn('Telemetry disabled:', error);
    });
}

/** Records the app's start-up as one span once the SDK is ready (a no-op when it's off). */
function recordStart(started: Date, ended: Date, failed: boolean, failure: unknown): void {
  const span = trace.getTracer('histeclipse').startSpan('app.start', { startTime: started });
  if (failed) {
    span.setAttributes({ error: true, 'exception.slug': 'err-app-start-failed' });
    span.recordException(failure instanceof Error ? failure : String(failure));
    span.setStatus({ code: SpanStatusCode.ERROR, message: errorMessage(failure) });
  }
  span.end(ended);
}

async function boot(appRoot: HTMLElement): Promise<void> {
  const telemetry = loadTelemetry();
  const started = new Date();
  const outcome = await startApp(appRoot).then(
    () => ({ failed: false, failure: undefined as unknown }),
    (error: unknown) => ({ failed: true, failure: error }),
  );
  const ended = new Date();
  await telemetry;
  recordStart(started, ended, outcome.failed, outcome.failure);
  if (outcome.failed) {
    throw outcome.failure instanceof Error
      ? outcome.failure
      : new Error(errorMessage(outcome.failure));
  }
}

boot(root).catch((error: unknown) => {
  const message = document.createElement('p');
  message.className = 'fatal';
  message.textContent = `Something went wrong while loading: ${errorMessage(error)}`;
  root.replaceChildren(message);
  console.error(error);
});
