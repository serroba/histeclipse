import type { Attributes, AttributeValue } from './attributes';

/**
 * Where a reader is, as coarsely as Cloudflare's edge knows it (#367): the country it places
 * them in and the data centre that served them. Cloudflare answers `/cdn-cgi/trace` on every
 * site it proxies, as `key=value` lines. Only these two keys are kept; the reader's IP address,
 * also in the answer, never leaves the browser.
 */
export const EDGE_TRACE_PATH = '/cdn-cgi/trace';

/** The trace's keys kept, and the span attribute each becomes. */
const KEPT: Readonly<Record<string, string>> = {
  loc: 'geo.country.iso_code',
  colo: 'cloudflare.colo',
};

/** Two capital letters (a country), or three (a data centre); anything else is not a trace. */
const VALUE = /^[A-Z]{2,3}$/;

export function edgeAttributes(trace: string): Attributes {
  const attributes: Record<string, AttributeValue> = {};
  for (const line of trace.split('\n')) {
    const equals = line.indexOf('=');
    const name = KEPT[line.slice(0, equals)];
    const value = line.slice(equals + 1).trim();
    // `XX` is Cloudflare's "no country known"; better absent than a country that is not one.
    if (equals > 0 && name !== undefined && VALUE.test(value) && value !== 'XX') {
      attributes[name] = value;
    }
  }
  return attributes;
}

/**
 * Asks the edge, giving up quietly after `timeoutMs`: with no answer (a local preview, a
 * blocked request) spans simply carry no country.
 */
export async function fetchEdgeAttributes(
  fetcher: (url: string, init: RequestInit) => Promise<Response>,
  timeoutMs = 2000,
): Promise<Attributes> {
  try {
    const response = await fetcher(EDGE_TRACE_PATH, {
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });
    return response.ok ? edgeAttributes(await response.text()) : {};
  } catch {
    return {};
  }
}
