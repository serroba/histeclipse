import { describe, expect, it } from 'vitest';

import { WHYS } from '../sources/registry';
import { LAYERS, type Layer, type Span } from './viewState';
import { layerWhy, onScreen, type Scene } from './whysOnScreen';

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

describe('the whys of the layers', () => {
  it('gives every layer a why, whatever the borders’ source', () => {
    for (const layer of LAYERS) {
      for (const borders of ['cliopatria', 'ohm', 'both'] as const) {
        expect(WHYS).toHaveProperty(layerWhy(layer, borders));
      }
    }
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
    expect(onScreen(scene({ focus: 'mars' })).slice(0, 2)).toEqual(['close-up', 'bodies']);
    expect(onScreen(scene({ focus: 'moon', span: 'ice' }))[0]).toBe('ice-surface');
    expect(onScreen(scene({ mode: 'sky' }))).toEqual(['sky', 'bodies']);
  });
});
