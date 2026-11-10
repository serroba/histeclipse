import { describe, expect, it } from 'vitest';

import { EDGE_TRACE_PATH, edgeAttributes, fetchEdgeAttributes } from './edge';

const TRACE = [
  'fl=1336f33',
  'h=histeclipse.limits.world',
  'ip=203.0.113.7',
  'ts=1794308179.000',
  'visit_scheme=https',
  'uag=Mozilla/5.0',
  'colo=SYD',
  'http=http/2',
  'loc=AU',
  'tls=TLSv1.3',
  '',
].join('\n');

describe('edgeAttributes', () => {
  it('keeps the country and the data centre, nothing else', () => {
    expect(edgeAttributes(TRACE)).toEqual({
      'geo.country.iso_code': 'AU',
      'cloudflare.colo': 'SYD',
    });
  });

  it('never keeps the IP address', () => {
    expect(JSON.stringify(edgeAttributes(TRACE))).not.toContain('203.0.113.7');
  });

  it('leaves out a country Cloudflare does not know', () => {
    expect(edgeAttributes('loc=XX\ncolo=LAX')).toEqual({ 'cloudflare.colo': 'LAX' });
  });

  it('finds nothing in a page that is not a trace', () => {
    expect(edgeAttributes('<!doctype html><title>histeclipse</title>')).toEqual({});
    expect(edgeAttributes('loc=<script>\n=AU\nloc')).toEqual({});
  });
});

describe('fetchEdgeAttributes', () => {
  it('asks the edge once, uncached', async () => {
    const asked: [string, RequestInit][] = [];
    const attributes = await fetchEdgeAttributes((url, init) => {
      asked.push([url, init]);
      return Promise.resolve(new Response(TRACE));
    });
    expect(attributes['geo.country.iso_code']).toBe('AU');
    expect(asked).toHaveLength(1);
    expect(asked[0]?.[0]).toBe(EDGE_TRACE_PATH);
    expect(asked[0]?.[1].cache).toBe('no-store');
  });

  it('gives nothing when the edge is not there', async () => {
    const notFound = await fetchEdgeAttributes(() =>
      Promise.resolve(new Response('loc=AU', { status: 404 })),
    );
    expect(notFound).toEqual({});
    const offline = await fetchEdgeAttributes(() => Promise.reject(new TypeError('offline')));
    expect(offline).toEqual({});
  });
});
