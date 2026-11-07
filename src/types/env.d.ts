/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Git SHA of the build; set by the deploy workflow. */
  readonly VITE_COMMIT_SHA?: string;
  /**
   * Honeycomb ingest key (key ID followed by key secret). Ingest-only and shipped in the
   * public bundle, so it must only ever be a key that can send, never read or configure.
   * Unset in CI test builds and local dev without `.env.local`, which turns telemetry off.
   */
  readonly VITE_HONEYCOMB_INGEST_KEY?: string;
}
