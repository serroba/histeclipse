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
  const why = vi.fn((id: string, label: string) => element('button', { title: id }, label));
  const ui = createDeepChips(
    [
      { layer: 'humans', label: 'Humans', why: 'humans' },
      { layer: 'fossils', label: 'Fossils', why: 'fossils', whyLabel: 'Finds' },
    ],
    why,
  );
  const host = element('div', {}, ...ui.notes);
  return { ui, host, why };
}

describe('isolated layer controls', () => {
  it('shows a layer’s note, with its book, while the layer is on', () => {
    const { ui, host, why } = chips();
    ui.render(new Map());
    expect(host.querySelector<HTMLElement>('[data-testid="humans-note"]')?.hidden).toBe(true);
    const states = new Map<Layer, DeepChipView>([
      ['humans', view()],
      ['fossils', { offered: false, on: false, note: null }],
    ]);
    ui.render(states);
    expect(host.querySelector<HTMLElement>('[data-testid="humans-note"]')?.hidden).toBe(false);
    expect(why).toHaveBeenCalledWith('fossils', 'Finds');
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

  it('renders an action as a button that runs it (#948)', () => {
    const { ui, host } = chips();
    const run = vi.fn();
    ui.render(new Map([['humans', view(['None here. ', { text: 'Go to the nearest', run }])]]));
    const go = host.querySelector<HTMLButtonElement>('button.deep-note-go');
    expect(go?.textContent).toBe('Go to the nearest');
    go?.click();
    expect(run).toHaveBeenCalledOnce();
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
    expect(ui.group.getAttribute('role')).toBe('group');
    expect(ui.group.getAttribute('aria-label')).toBe('Time range presets');
    const buttons = [...ui.group.querySelectorAll('button')];
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

  it('Given the phone’s chip (#1116), Then it names the span, opens the presets, and a pick, Escape or a tap elsewhere closes them', () => {
    const ui = createSpanSwitch(vi.fn());
    document.body.append(ui.root);
    const chip = ui.root.querySelector<HTMLButtonElement>('.time-scale-chip');
    ui.render('all', false);
    expect(chip?.textContent).toBe('540 Myr');
    expect(chip?.getAttribute('aria-label')).toBe('Time range: 540 Myr, part of it');
    expect(chip?.getAttribute('aria-controls')).toBe(ui.group.id);
    chip?.click();
    expect(ui.root.hasAttribute('data-open')).toBe(true);
    expect(chip?.getAttribute('aria-expanded')).toBe('true');
    ui.group.querySelector('button')?.click();
    expect(ui.root.hasAttribute('data-open')).toBe(false);
    chip?.click();
    ui.group
      .querySelector('button')
      ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(ui.root.hasAttribute('data-open')).toBe(false);
    expect(document.activeElement).toBe(chip);
    chip?.click();
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(ui.root.hasAttribute('data-open')).toBe(false);
    ui.render('years');
    expect(chip?.getAttribute('aria-label')).toBe('Time range: Years');
    ui.root.remove();
  });

  it('Given two bars’ switches, When one is open, Then a tap inside it leaves the bar raised', () => {
    const bottom = document.createElement('div');
    bottom.className = 'bottom';
    const [open, closed] = [createSpanSwitch(vi.fn()), createSpanSwitch(vi.fn())];
    bottom.append(open.root, closed.root);
    document.body.append(bottom);
    open.root.querySelector<HTMLButtonElement>('.time-scale-chip')?.click();
    expect(bottom.hasAttribute('data-scale-open')).toBe(true);
    open.group.querySelector('button')?.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(bottom.hasAttribute('data-scale-open')).toBe(true);
    expect(open.root.hasAttribute('data-open')).toBe(true);
    bottom.remove();
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
