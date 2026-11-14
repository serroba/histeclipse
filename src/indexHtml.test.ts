import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

import { describe, expect, it } from 'vitest';

/** The page's inline boot script (#222), as it ships. */
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const script = /<script id="boot-preloads">([\s\S]*?)<\/script>/.exec(html)?.[1] ?? '';

interface Link {
  rel: string;
  as: string;
  crossOrigin: string;
  href: string;
}

/** Run the boot script for a link, in a page of its own; return the files it preloads. */
function preloads(search: string, now = new Date('2026-11-14T12:00Z')): string[] {
  const links: Link[] = [];
  runInNewContext(script, {
    URLSearchParams,
    location: { search },
    Date: class extends Date {
      constructor() {
        super(now);
      }
    },
    document: {
      createElement: (): Link => ({ rel: '', as: '', crossOrigin: '', href: '' }),
      head: { appendChild: (link: Link) => links.push(link) },
    },
  });
  for (const link of links) {
    // Anonymous CORS fetches, as the app's fetch() makes, so the app reuses each response.
    expect([link.rel, link.as, link.crossOrigin]).toEqual(['preload', 'fetch', 'anonymous']);
  }
  return links.map((link) => link.href);
}

function catalogueYears(kind: 'lunar' | 'solar'): [number, number] {
  const url = new URL(`../public/data/${kind}/index.json`, import.meta.url);
  const index = JSON.parse(readFileSync(url, 'utf8')) as { startYear: number; endYear: number };
  return [index.startYear, index.endYear];
}

describe('the page starts the first view’s data alongside its code', () => {
  it('Given a year, Then the famous eclipses, the sea’s indexes and the year’s century', () => {
    expect(preloads('?t=2024-04-08T18:17')).toEqual([
      'data/famous-eclipses.json',
      'data/seaice/index.json',
      'data/sealevel/index.json',
      'data/lunar/2000.json',
      'data/solar/2000.json',
    ]);
  });

  it('Given no time, Then today’s century; given a year BCE, its own', () => {
    expect(preloads('')).toContain('data/lunar/2000.json');
    expect(preloads('?t=-0584-05-28T12:00Z')).toContain('data/solar/-600.json');
    expect(preloads('?t=1200-01-01T12:00&layers=lunar,solar,empires')).toContain(
      'data/lunar/1200.json',
    );
  });

  it('Given a year outside the eclipse catalogues, Then no century is asked for', () => {
    const files = preloads('?t=-8000-01-01T12:00');
    expect(files.some((file) => /lunar|solar/.test(file))).toBe(false);
  });

  it('Given deep time, Then its first maps instead of the sea’s', () => {
    expect(preloads('?ma=66')).toEqual([
      'data/famous-eclipses.json',
      'data/polarity.json',
      'data/paleodem/index.json',
      'data/lunar/2000.json',
      'data/solar/2000.json',
    ]);
  });

  it('Given the sky, Then the stars too', () => {
    expect(preloads('?mode=sky&t=2024-04-08T18:17')).toEqual(
      expect.arrayContaining(['data/sky.json', 'data/hip-stars.json']),
    );
  });

  it('knows the catalogues’ span, and every file it names exists', () => {
    expect(catalogueYears('lunar')).toEqual([-3999, 3000]);
    expect(catalogueYears('solar')).toEqual([-3999, 3000]);
    const searches = ['?t=2024-04-08', '?t=-3999-01-01', '?t=3000-12-31', '?ma=66', '?mode=sky'];
    for (const file of searches.flatMap((search) => preloads(search))) {
      expect(() => readFileSync(new URL(`../public/${file}`, import.meta.url)), file).not.toThrow();
    }
  });
});
