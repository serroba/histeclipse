import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { PERIOD_EVIDENCE } from './periodEvidence';
import { bibtexUrl, citation, doiOf, SOURCES, WHYS, type SourceId } from './registry';

/** A source's shape, as `Source` declares it: sources.json is content, checked here (#383). */
const SourceSchema = v.strictObject({
  name: v.pipe(v.string(), v.minLength(1)),
  kind: v.picklist(['paper', 'dataset', 'model', 'imagery', 'catalogue', 'reference']),
  cite: v.pipe(v.string(), v.minLength(1)),
  url: v.pipe(v.string(), v.url()),
  licence: v.optional(v.pipe(v.string(), v.minLength(1))),
  nonCommercial: v.optional(v.literal(true)),
});

/** A why's shape, as `Why` declares it: whys.json is content, checked here (#383). */
const WhySchema = v.strictObject({
  title: v.pipe(v.string(), v.minLength(1)),
  what: v.pipe(v.string(), v.minLength(1)),
  sources: v.array(v.string()),
  how: v.optional(v.string()),
  others: v.optional(v.string()),
  evidence: v.optional(
    v.array(v.strictObject({ name: v.string(), says: v.string(), source: v.string() })),
  ),
  certainty: v.optional(v.array(v.string())),
  reading: v.optional(v.array(v.string())),
});

describe('the registry’s content', () => {
  it.each(Object.entries(SOURCES))('source %s has the shape of a Source', (_id, source) => {
    expect(v.safeParse(SourceSchema, source).issues).toBeUndefined();
  });

  it.each(Object.entries(WHYS))('why %s has the shape of a Why', (_id, why) => {
    expect(v.safeParse(WhySchema, why).issues).toBeUndefined();
  });
});

describe('where everything comes from', () => {
  it('rests every why on sources the registry knows, with a sentence on what it shows', () => {
    for (const why of Object.values(WHYS)) {
      expect(why.sources.length).toBeGreaterThan(0);
      expect(why.what.length).toBeGreaterThan(10);
      for (const id of why.sources) expect(SOURCES).toHaveProperty(id);
    }
  });

  it('links every source over https, and flags non-commercial terms with a licence', () => {
    for (const source of Object.values(SOURCES)) {
      expect(source.url).toMatch(/^https:\/\//);
      if ('nonCommercial' in source) expect(source.licence).toMatch(/non-commercial|NC/i);
    }
  });

  it('points every piece of evidence and every reading at a registered source', () => {
    for (const why of Object.values(WHYS)) {
      for (const item of 'evidence' in why ? why.evidence : []) {
        expect(SOURCES).toHaveProperty(item.source);
        expect(item.says.length).toBeGreaterThan(40);
      }
      for (const id of 'reading' in why ? why.reading : []) expect(SOURCES).toHaveProperty(id);
    }
  });

  it('uses every source somewhere', () => {
    const used = new Set<SourceId>(
      Object.values(WHYS).flatMap((why) => [
        ...why.sources,
        ...('evidence' in why ? why.evidence.map((item) => item.source) : []),
        ...('reading' in why ? why.reading : []),
      ]),
    );
    for (const entry of Object.values(PERIOD_EVIDENCE)) {
      for (const id of entry.sources) used.add(id);
    }
    for (const id of Object.keys(SOURCES)) expect(used).toContain(id);
  });
});

describe('citing a source', () => {
  it('copies the full reference, where to find it, and its licence', () => {
    expect(citation(SOURCES.archaeoglobe)).toBe(
      'ArchaeoGLOBE Project (2019), Archaeological assessment reveals Earth’s early transformation through land use, Science 365, 897; Harvard Dataverse. https://doi.org/10.1126/science.aax1192 Licence: CC0 1.0.',
    );
    expect(citation(SOURCES.impactEarth)).not.toContain('Licence');
  });

  it('finds a DOI in a link, and Crossref’s BibTeX for it', () => {
    expect(doiOf(SOURCES.archaeoglobe)).toBe('10.1126/science.aax1192');
    expect(bibtexUrl(SOURCES.archaeoglobe)).toBe(
      'https://api.crossref.org/works/10.1126/science.aax1192/transform/application/x-bibtex',
    );
    expect(doiOf(SOURCES.macrostrat)).toBeNull();
    expect(bibtexUrl(SOURCES.macrostrat)).toBeNull();
  });
});

describe('sources.json', () => {
  // A new source goes in its place by id, not at the end, so two branches adding sources rarely
  // touch the same lines (#479). The whys keep their order: the search's passages and their
  // vectors are built in it.
  it('lists its sources in order of their ids', () => {
    const ids = Object.keys(SOURCES);
    expect(ids).toEqual([...ids].sort());
  });
});
