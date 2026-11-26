// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import { element } from '../../ui/dom';
import { boundaryLink, layerAbout, layerFilter } from './layerRows';

function group(name: string, ...rows: string[]): HTMLElement {
  return element(
    'fieldset',
    {},
    element('legend', {}, name),
    ...rows.map((row) => element('div', { class: 'layer-item' }, row)),
  );
}

describe('the Layers panel’s rows (#950)', () => {
  it('Given a layer, Then its row says its plain line, its full account folded under More', () => {
    const [line, more] = layerAbout({
      summary: 'Craters.',
      about: 'From the Impact Earth Database.',
    });
    expect(line?.textContent).toBe('Craters.');
    expect(more instanceof HTMLDetailsElement && more.open).toBe(false);
    expect(more?.textContent).toBe('MoreFrom the Impact Earth Database.');
  });

  it('Given words typed, Then only rows holding them all show, and groups with none hide', () => {
    const space = group('Space', 'Eclipses: the Moon’s shadow', 'Spacecraft');
    const earth = group('Earth', 'Impact craters');
    const box = layerFilter([space, earth]);
    const type = (text: string): void => {
      (box as HTMLInputElement).value = text;
      box.dispatchEvent(new Event('input'));
    };
    type('moon SHADOW');
    const shown = (fieldset: HTMLElement): string[] =>
      [...fieldset.querySelectorAll<HTMLElement>('.layer-item')]
        .filter((item) => item.hidden !== true)
        .map((item) => item.textContent);
    expect(shown(space)).toEqual(['Eclipses: the Moon’s shadow']);
    expect(earth.hidden).toBe(true);
    type('');
    expect(shown(space)).toHaveLength(2);
    expect(earth.hidden).toBe(false);
  });

  it('Given a layer that draws a planetary boundary, Then its row names it and turns the wheel on (#434)', () => {
    const turnOn = vi.fn();
    expect(boundaryLink(undefined, turnOn)).toEqual([]);
    const [line] = boundaryLink('ozone', turnOn);
    expect(line?.textContent).toBe('Planetary boundary: Stratospheric ozone. Show the boundaries');
    line?.querySelector('button')?.click();
    expect(turnOn).toHaveBeenCalledOnce();
  });
});
