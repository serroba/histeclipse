import { describe, expect, it } from 'vitest';

import { LAYERS, type Layer, type Span } from '../state/viewState';
import { layerWhy, onScreen, SOURCES, WHYS, type Scene } from './registry';

const scene = (over: Partial<Scene>): Scene => ({
  mode: 'globe',
  span: 'years',
  focus: 'earth',
  layers: new Set<Layer>(),
  borders: 'cliopatria',
  eclipse: false,
  drawsOn: () => true,
  ...over,
});

describe('where everything comes from', () => {
  it('gives every layer a why, whatever the borders’ source', () => {
    for (const layer of LAYERS) {
      for (const borders of ['cliopatria', 'ohm', 'both'] as const) {
        expect(WHYS).toHaveProperty(layerWhy(layer, borders));
      }
    }
  });

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
    const used = new Set(
      Object.values(WHYS).flatMap((why) => [
        ...why.sources,
        ...('evidence' in why ? why.evidence.map((item) => item.source) : []),
        ...('reading' in why ? why.reading : []),
      ]),
    );
    for (const id of Object.keys(SOURCES)) expect(used).toContain(id);
  });
});

describe('what is on screen now', () => {
  it('starts from the ground and the sky’s bodies in the years', () => {
    expect(onScreen(scene({}))).toEqual(['earth', 'bodies']);
  });

  it('adds the layers that draw on the span, and leaves those resting out', () => {
    const layers = new Set<Layer>(['empires', 'ways', 'temperature']);
    const drawsOn = (layer: Layer, span: Span): boolean =>
      layer === 'temperature' ? span !== 'years' : span === 'years';
    expect(onScreen(scene({ layers, drawsOn }))).toEqual([
      'earth',
      'bodies',
      'empires-cliopatria',
      'ways',
    ]);
    expect(onScreen(scene({ layers, drawsOn, span: 'all' }))).toEqual([
      'deep-surface',
      'deep-evidence',
      'temperature',
    ]);
  });

  it('names both sources of borders when comparing them', () => {
    const layers = new Set<Layer>(['empires']);
    expect(onScreen(scene({ layers, borders: 'both' }))).toContain('empires-ohm');
    expect(onScreen(scene({ layers, borders: 'both' }))).toContain('empires-cliopatria');
  });

  it('adds the eclipses with one picked and its shadows on', () => {
    const layers = new Set<Layer>(['solar', 'lunar']);
    expect(onScreen(scene({ layers, eclipse: true }))).toContain('eclipses');
    expect(onScreen(scene({ layers, eclipse: false }))).not.toContain('eclipses');
  });

  it('follows the view: the ice ages’ Earth, the Sun close up, the sky', () => {
    expect(onScreen(scene({ span: 'ice' }))[0]).toBe('ice-surface');
    expect(onScreen(scene({ focus: 'sun' }))[0]).toBe('sun');
    expect(onScreen(scene({ mode: 'sky' }))).toEqual(['sky', 'bodies']);
  });
});
