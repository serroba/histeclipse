// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import { createDeepChips, type DeepChipView, type DeepNoteBlock } from './deepChips';
import { createSpanSwitch } from './spanSwitch';
import { createGasChart } from './gasChart';
import type { Gas } from '../data/atmosphere';
import type { Layer } from '../state/viewState';
import { element } from './dom';

const view = (note: readonly DeepNoteBlock[] | null = ['Shown']): DeepChipView => ({
  offered: true,
  on: true,
  note,
});

function chips() {
  const change = vi.fn();
  const why = vi.fn((id: string, label: string) => element('button', { title: id }, label));
  const ui = createDeepChips(
    [
      { layer: 'humans', label: 'Humans', icon: 'humans', why: 'humans' },
      { layer: 'fossils', label: 'Fossils', icon: 'fossils', why: 'fossils', whyLabel: 'Finds' },
    ],
    why,
    change,
  );
  const host = element('div', {}, ...ui.buttons, ...ui.notes);
  return { ui, host, change, why };
}

describe('isolated layer controls', () => {
  it('renders availability, pressed state, accessible labels and source actions', () => {
    const { ui, host, why, change } = chips();
    ui.render(new Map());
    expect(
      [...host.querySelectorAll('button.deep-layer')].every((button) =>
        button.hasAttribute('hidden'),
      ),
    ).toBe(true);
    host.querySelector<HTMLButtonElement>('button.deep-layer')?.click();
    expect(change).toHaveBeenLastCalledWith('humans', true);
    const states = new Map<Layer, DeepChipView>([
      ['humans', view()],
      ['fossils', { offered: false, on: false, note: null }],
    ]);
    ui.render(states);
    const button = host.querySelector<HTMLButtonElement>('button.deep-layer');
    expect(button?.hidden).toBe(false);
    expect(button?.textContent).toBe('Humans');
    expect(button?.getAttribute('aria-pressed')).toBe('true');
    expect(button?.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(host.querySelector<HTMLElement>('[data-testid="humans-note"]')?.hidden).toBe(false);
    expect(why).toHaveBeenCalledWith('fossils', 'Finds');
    button?.click();
    expect(change).toHaveBeenLastCalledWith('humans', false);
    ui.render(new Map([['humans', view(null)]]));
    expect(host.querySelector<HTMLElement>('[data-testid="humans-note"]')?.hidden).toBe(true);
  });

  it('renders note text safely, links, swatches, named text, paragraphs and lists', () => {
    const { ui, host } = chips();
    ui.render(
      new Map([
        [
          'humans',
          view([
            '<script>unsafe</script>',
            { key: 'swatch' },
            { text: 'Source', href: 'https://example.org' },
            { text: 'A find', testId: 'find' },
            { paragraph: ['Plain'] },
            { paragraph: ['Styled'], class: 'detail' },
            { list: [{ class: 'item', parts: ['First'] }] },
          ]),
        ],
      ]),
    );
    expect(host.querySelector('script')).toBeNull();
    expect(host.textContent).toContain('<script>unsafe</script>');
    expect(host.querySelector('a')?.href).toBe('https://example.org/');
    expect(host.querySelector('.swatch')?.getAttribute('aria-hidden')).toBe('true');
    expect(host.querySelector('[data-testid="find"]')?.textContent).toBe('A find');
    expect(host.querySelector('p.detail')?.textContent).toBe('Styled');
    expect(host.querySelector('ul li.item')?.textContent).toBe('First');
  });

  it('keeps a picker mounted while using its latest callback and selected value', () => {
    const { ui, host } = chips();
    const first = vi.fn();
    const latest = vi.fn();
    const choice = {
      label: 'Model',
      name: 'Model to show',
      value: 'a',
      options: [
        { value: 'a', label: 'Model A' },
        { value: 'b', label: 'Model B' },
      ],
      pick: first,
    };
    ui.render(new Map([['humans', view([{ choose: choice }])]]));
    const select = host.querySelector<HTMLSelectElement>('select');
    if (select === null) throw new Error('No picker');
    expect(select.getAttribute('aria-label')).toBe('Model to show');
    ui.render(new Map([['humans', view([{ choose: { ...choice, value: 'b', pick: latest } }])]]));
    expect(host.querySelector('select')).toBe(select);
    expect(select.value).toBe('b');
    select.value = 'a';
    select.dispatchEvent(new Event('change'));
    expect(latest).toHaveBeenCalledWith('a');
    expect(first).not.toHaveBeenCalled();
  });
});

describe('isolated span switch', () => {
  it('names all spans, reports each selection and presses only the active span', () => {
    const pick = vi.fn();
    const ui = createSpanSwitch(pick);
    expect(ui.root.getAttribute('role')).toBe('group');
    expect(ui.root.getAttribute('aria-label')).toBe('Time span');
    const buttons = [...ui.root.querySelectorAll('button')];
    expect(buttons.map((button) => button.textContent)).toEqual([
      'Years',
      'Ice ages',
      '540 Myr',
      '4.6 Gyr',
    ]);
    for (const [i, span] of ['years', 'ice', 'all', 'eons'].entries()) {
      const button = buttons[i];
      if (button === undefined) throw new Error('No span button');
      button.click();
      expect(pick).toHaveBeenLastCalledWith(span);
      ui.render(span as 'years' | 'ice' | 'all' | 'eons');
      expect(button.getAttribute('aria-pressed')).toBe('true');
      expect(buttons.filter((each) => each.getAttribute('aria-pressed') === 'true')).toHaveLength(
        1,
      );
    }
  });
});

const gas: Gas = {
  id: 'co2',
  name: 'Carbon dioxide',
  unit: 'ppm',
  credit: 'Test',
  doi: '10.1234/test',
  preindustrial: 280,
  points: [
    [-1, 999, 1],
    [0, 280, 1],
    [10, 180, 1],
    [20, 200, 1],
    [30, 999, 1],
  ],
};

describe('isolated gas chart', () => {
  it('filters the series, plots its reference and clamps the cursor without rebuilding the line', () => {
    const ui = createGasChart();
    ui.render(gas, 20, 10);
    const line = ui.root.querySelector('.gas-line');
    expect(line?.getAttribute('d')).toBe('M1000.0,2.0L500.0,38.0L0.0,30.8');
    expect(ui.root.querySelector('.gas-preindustrial')?.getAttribute('y1')).toBe('2.0');
    expect(ui.root.querySelector('.gas-cursor')?.getAttribute('x1')).toBe('500.0');
    const write = vi.spyOn(line ?? document.createElement('div'), 'setAttribute');
    ui.render(gas, 20, 100);
    expect(write).not.toHaveBeenCalled();
    expect(ui.root.querySelector('.gas-cursor')?.getAttribute('x1')).toBe('0.0');
    ui.render(gas, 20, -10);
    expect(ui.root.querySelector('.gas-cursor')?.getAttribute('x1')).toBe('1000.0');
    ui.render(gas, 10, 5);
    expect(write).toHaveBeenCalled();
    expect(ui.root.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('centres a flat record instead of dividing by zero', () => {
    const ui = createGasChart();
    ui.render(
      {
        ...gas,
        points: [
          [0, 280, 1],
          [20, 280, 1],
        ],
      },
      20,
      0,
    );
    expect(ui.root.querySelector('.gas-line')?.getAttribute('d')).toBe('M1000.0,20.0L0.0,20.0');
  });
});
