import { describe, expect, it } from 'vitest';

import { cachedViewAttributes, gpuAttributes, type GlProbe, viewAttributes } from './attributes';

const NOW = new Date('2026-11-07T03:05:00Z');

describe('viewAttributes', () => {
  it('reads the live site default view', () => {
    const attributes = viewAttributes(
      '?v=1&mode=globe&t=2026-11-07T03:05Z&cal=gregorian&cam=20.0000,0.0000,4.50&layers=lunar,solar',
      NOW,
    );
    expect(attributes).toMatchObject({
      'app.mode': 'globe',
      'app.span': 'years',
      'app.year': 2026,
      'app.calendar': 'gregorian',
      'app.layers': 'lunar,solar',
      'app.layer_count': 2,
      'app.selection': 'none',
    });
    expect(attributes).not.toHaveProperty('app.ma');
    expect(attributes).not.toHaveProperty('app.selection.year');
  });

  it('names a selected eclipse and its year', () => {
    const attributes = viewAttributes('?v=1&t=-584-05-28&sel=solar:-584-05-28', NOW);
    expect(attributes['app.selection']).toBe('solar');
    expect(attributes['app.selection.year']).toBe(-584);
    expect(attributes['app.year']).toBe(-584);
  });

  it('reports deep time by its scale and millions of years, not a year', () => {
    const attributes = viewAttributes('?v=1&ma=66', NOW);
    expect(attributes['app.ma']).toBe(66);
    expect(attributes['app.span']).not.toBe('years');
    expect(attributes).not.toHaveProperty('app.year');
  });

  it('falls back to the default view for a malformed URL', () => {
    expect(viewAttributes('?mode=nonsense&t=garbage', NOW)['app.mode']).toBe('globe');
  });
});

describe('cachedViewAttributes', () => {
  it('parses each distinct URL once', () => {
    let calls = 0;
    const attributesFor = cachedViewAttributes(() => {
      calls += 1;
      return NOW;
    });
    const first = attributesFor('?v=1&mode=sky');
    expect(attributesFor('?v=1&mode=sky')).toBe(first);
    expect(calls).toBe(1);
    expect(attributesFor('?v=1&mode=globe')['app.mode']).toBe('globe');
    expect(calls).toBe(2);
  });
});

describe('gpuAttributes', () => {
  function probe(debug: boolean, values: Record<number, unknown>): GlProbe {
    return {
      getParameter: (name) => values[name],
      getExtension: (name) => (debug && name === 'WEBGL_debug_renderer_info' ? {} : null),
    };
  }

  it('flags a missing WebGL 2 context', () => {
    expect(gpuAttributes(null, 3)).toEqual({ 'gpu.webgl2': false, 'display.pixel_ratio': 3 });
  });

  it('reads the unmasked GPU when the browser offers it', () => {
    const gl = probe(true, { 0x0d33: 16384, 0x9245: 'Apple', 0x9246: 'Apple M3' });
    expect(gpuAttributes(gl, 2)).toEqual({
      'gpu.webgl2': true,
      'display.pixel_ratio': 2,
      'gpu.max_texture_size': 16384,
      'gpu.vendor': 'Apple',
      'gpu.renderer': 'Apple M3',
    });
  });

  it('falls back to the generic names, and skips values that are not given', () => {
    const gl = probe(false, { 0x1f00: 'Mozilla', 0x1f01: 'Mozilla' });
    expect(gpuAttributes(gl, 1)).toEqual({
      'gpu.webgl2': true,
      'display.pixel_ratio': 1,
      'gpu.vendor': 'Mozilla',
      'gpu.renderer': 'Mozilla',
    });
  });
});
