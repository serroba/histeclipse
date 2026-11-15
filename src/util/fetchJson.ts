/** Fetch a static data file and validate it against a runtime schema. */

import * as v from 'valibot';

export type Fetch = (url: string) => Promise<Response>;

/** The slice of `fetch` used here: a URL, and how to treat the browser's copy. */
export type RawFetch = (url: string, init?: { readonly cache: RequestCache }) => Promise<Response>;

/**
 * A data file fetched, asked once more past the browser's copy if the server failed (5xx). The
 * host can answer with a passing 503, and the browser can keep that answer for a while: asking
 * again with `cache: 'reload'` reaches the server, and puts the good answer in the copy's place.
 */
export function retryingFetch(raw: RawFetch): Fetch {
  return async (url) => {
    const response = await raw(url);
    return response.status >= 500 ? raw(url, { cache: 'reload' }) : response;
  };
}

export class CatalogError extends Error {
  override readonly name = 'CatalogError';
}

export async function getJson<const Schema extends v.GenericSchema>(
  fetchJson: Fetch,
  url: string,
  schema: Schema,
): Promise<v.InferOutput<Schema>> {
  const response = await fetchJson(url);
  if (!response.ok) {
    throw new CatalogError(`GET ${url} failed: HTTP ${String(response.status)}`);
  }
  const body: unknown = await response.json();
  const result = v.safeParse(schema, body);
  if (!result.success) {
    const issue = result.issues[0];
    const path = v.getDotPath(issue) ?? '(root)';
    throw new CatalogError(`${url} does not match the catalog schema at ${path}: ${issue.message}`);
  }
  return result.output;
}
