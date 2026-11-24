import { describe, expect, it } from 'vitest';

import { absentLayers, absentSteps, activeLayers, spanShown } from './activeLayers';
import { parseViewState } from './url';

const at = (query: string) => parseViewState(query, new Date('2026-11-15T00:00:00Z')).state;

describe('the layers on, and whether they have data now (#751)', () => {
  it('Given no layers, Then there are no chips', () => {
    expect(activeLayers(at('t=2006-10-01T12:00Z'))).toEqual([]);
  });

  it('Given layers on in the ice ages, Then each says whether it draws there, in the catalogue’s order', () => {
    const chips = activeLayers(at('ma=0.315&scale=ice&layers=humans,genomes,plates'));
    expect(chips.map((chip) => [chip.layer, chip.coverage])).toEqual([
      ['genomes', 'other-span'],
      ['plates', 'available'],
      ['humans', 'available'],
    ]);
    expect(chips[0]?.goTo).toEqual({ span: 'years', label: 'Years' });
    expect(chips[0]?.why).toBe('on Years');
    expect(chips[1]?.goTo).toBeNull();
    expect(chips[1]?.why).toBeNull();
  });

  it('Given temperature on in the ice ages, Then it draws there, as the globe does (#457)', () => {
    const [temperature] = activeLayers(at('ma=0.021&scale=ice&layers=temperature'));
    expect(temperature?.draws).toBe(true);
    expect(temperature?.goTo).toBeNull();
  });

  it('Given a layer with a moment of its own off its span, Then going there lands on it', () => {
    const [humans] = activeLayers(at('t=2006-10-01T12:00Z&layers=humans'));
    expect(humans?.draws).toBe(false);
    expect(humans?.goTo).toEqual({ span: 'ice', ma: 0.315, label: 'the earliest Homo sapiens' });
    expect(humans?.reach).toMatch(/hundred thousand years/);
  });

  it('Given the ozone hole in 1977, Then it is a known gap, with the next year to go to', () => {
    const [ozone] = activeLayers(at('t=1977-10-01T12:00Z&layers=ozone'));
    expect(ozone).toMatchObject({ coverage: 'gap', draws: false, why: 'none in 1977 CE' });
    expect(ozone?.goTo).toEqual({ span: 'years', year: 1979, label: '1979 CE' });
  });

  it('Given the ozone hole before 1970 or after 2025, Then it is outside, going to its nearest year', () => {
    const [before] = activeLayers(at('t=1900-10-01T12:00Z&layers=ozone'));
    expect(before).toMatchObject({ coverage: 'outside', why: 'none before 1970 CE' });
    // With its years, for the bar to show them (#1078).
    expect(before?.goTo).toEqual({
      span: 'years',
      year: 1970,
      years: { first: 1970, last: 2025 },
      label: '1970 CE',
    });
    const [after] = activeLayers(at('t=2026-10-01T12:00Z&layers=ozone'));
    expect(after).toMatchObject({ coverage: 'outside', why: 'none after 2025 CE' });
    const [inside] = activeLayers(at('t=2006-10-01T12:00Z&layers=ozone'));
    expect(inside).toMatchObject({ coverage: 'available', draws: true, why: null, goTo: null });
  });

  it('Given plates before 1,800 million years ago, Then they are outside, going to their oldest', () => {
    const [plates] = activeLayers(at('ma=2500&scale=eons&layers=plates'));
    expect(plates?.coverage).toBe('outside');
    expect(plates?.why).toBe('none before 1,800 million years ago');
    expect(plates?.goTo).toEqual({ span: 'eons', ma: 1800, label: '1,800 million years ago' });
    expect(activeLayers(at('ma=1000&scale=eons&layers=plates'))[0]?.coverage).toBe('available');
  });

  it('Given a layer loading or failed where its record has data, Then it says so, and a failed one offers to try again', () => {
    const retry = (): void => undefined;
    const state = at('t=2006-10-01T12:00Z&layers=ozone');
    const [loading] = activeLayers(state, new Map([['ozone', { state: 'loading' }]]));
    expect(loading).toMatchObject({ coverage: 'loading', draws: false, why: 'loading…' });
    expect(loading?.retry).toBeNull();
    const [failed] = activeLayers(state, new Map([['ozone', { state: 'failed', retry }]]));
    expect(failed).toMatchObject({ coverage: 'failed', draws: false, why: 'could not load' });
    expect(failed?.retry).toBe(retry);
  });

  it('Given a layer loading where its record has none, Then the record speaks first', () => {
    const loads = new Map([['ozone', { state: 'loading' }]] as const);
    const [gap] = activeLayers(at('t=1978-10-01T12:00Z&layers=ozone'), loads);
    expect(gap?.coverage).toBe('gap');
    const [deep] = activeLayers(at('ma=100&scale=all&layers=ozone'), loads);
    expect(deep?.coverage).toBe('other-span');
  });

  it('Given the span shown, Then the years or the deep scale', () => {
    expect(spanShown({ ma: null, deepScale: 'eons' })).toBe('years');
    expect(spanShown({ ma: 3, deepScale: 'eons' })).toBe('eons');
  });
});

describe('the Layers panel’s rows say what the chips say (#751)', () => {
  it('Given layers on with nothing here, drawing, or on another span, Then only those with nothing here, with their step', () => {
    const retry = (): void => undefined;
    const active = activeLayers(at('t=1977-06-01T12:00Z&layers=ozone,empires,humans,enso'), [
      ['enso', { state: 'failed', retry }],
    ]);
    const absent = absentLayers(active);
    expect([...absent.keys()]).toEqual(['ozone', 'enso']);
    expect(absent.get('ozone')).toEqual({
      why: 'none in 1977 CE',
      goTo: { span: 'years', year: 1979, label: '1979 CE' },
      retry: null,
    });
    expect(absent.get('enso')).toEqual({ why: 'could not load', goTo: null, retry });
  });

  it('Given them, Then each row’s step: Go to where its data is, or Try again, or none', () => {
    const retry = (): void => undefined;
    const gone: string[] = [];
    const steps = absentSteps(
      activeLayers(at('t=1977-06-01T12:00Z&layers=ozone,enso,amoc'), [
        ['enso', { state: 'failed', retry }],
        ['amoc', { state: 'loading' }],
      ]),
      (to) => gone.push(to.label),
    );
    expect(steps.get('ozone')?.step?.label).toBe('Go to 1979 CE');
    steps.get('ozone')?.step?.run();
    expect(gone).toEqual(['1979 CE']);
    expect(steps.get('enso')?.step).toEqual({ label: 'Try again', run: retry });
    expect(steps.get('amoc')).toEqual({ why: 'loading…', step: null });
  });
});

describe('what a layer says beside its name (#1159)', () => {
  const brief = { short: '82% agree', full: 'Cao et al. 2024 and PALEOMAP agree on 82%.' };

  it('is said where the layer draws', () => {
    const [plates] = activeLayers(at('ma=440&scale=all&layers=plates'), [], [['plates', brief]]);
    expect(plates?.brief).toEqual(brief);
  });

  it('gives way to why where the layer has nothing here', () => {
    const [plates] = activeLayers(
      at('ma=440&scale=all&layers=plates'),
      [['plates', { state: 'loading' }]],
      [['plates', brief]],
    );
    expect(plates?.why).toBe('loading…');
    expect(plates?.brief).toBeNull();
  });

  it('is nothing for a layer that says nothing', () => {
    const [plates] = activeLayers(at('ma=440&scale=all&layers=plates'), [], [['plates', null]]);
    expect(plates?.brief).toBeNull();
  });
});
