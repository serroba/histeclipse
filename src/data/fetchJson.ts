/** Fetch a static data file and validate it against a runtime schema. */

import * as v from 'valibot';

export type Fetch = (url: string) => Promise<Response>;

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
