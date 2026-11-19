// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import file from '../../../public/data/enso/index.json';
import { monthOf, type Enso } from '../../data/enso';
import type { LayerHost } from '../../globe/layerHost';
import { ensoChart } from './chartModel';
import { ensoPanel } from './ensoPanel';

const data = file as unknown as Enso;
const names = data.indices.map(({ id, label }) => ({ id, name: label }));
const sea = {
  options: [{ value: 'sea', label: 'The sea this month' }],
  chosen: 'sea',
  indices: [],
  by: 'roni',
  scale: 'sea',
  ends: '−4 · 0 · +4 °C',
} as const;

describe('the ENSO panel', () => {
  it('Given a month, Then a line per index, the thresholds, a strip of episodes each, the month marked, a key and the credit; null hides it', () => {
    const container = document.createElement('div');
    const panel = ensoPanel(() => undefined)({ container } as unknown as LayerHost);
    const root = container.querySelector<HTMLElement>('.enso-panel');
    expect(root?.hidden).toBe(true);
    const at = monthOf(1997, 12);
    panel.update({
      chart: ensoChart(data, at),
      names,
      text: 'December 1997.',
      sea: 'On the globe, the sea.',
      map: sea,
      section: null,
    });
    expect(root?.hidden).toBe(false);
    expect(root?.querySelectorAll('.enso-line')).toHaveLength(2);
    expect(root?.querySelectorAll('.enso-threshold')).toHaveLength(2);
    expect(root?.querySelectorAll('.enso-row')).toHaveLength(2);
    expect(root?.querySelectorAll('.enso-episode.is-elNino').length).toBeGreaterThan(10);
    expect(root?.querySelectorAll('.enso-episode.is-laNina').length).toBeGreaterThan(10);
    // One cursor on the chart and one on each strip.
    expect(root?.querySelectorAll('.enso-cursor, .enso-mark')).toHaveLength(3);
    expect(root?.querySelectorAll('.enso-key li')).toHaveLength(2);
    expect(root?.querySelector('figcaption')?.textContent).toBe(
      'The tropical Pacific, 1950–2026: °C from normal',
    );
    expect(root?.textContent).toContain('December 1997.');
    expect(root?.querySelector('.enso-sea')?.textContent).toBe('On the globe, the sea.');
    expect(root?.querySelector<HTMLElement>('.enso-scale')?.dataset['scale']).toBe('sea');
    expect(root?.querySelector('.enso-ends')?.textContent).toBe('−4 · 0 · +4 °C');
    expect(root?.querySelector<HTMLSelectElement>('.enso-by')?.hidden).toBe(true);
    const svg = root?.querySelector('svg');
    panel.update({
      chart: ensoChart(data, at),
      names,
      text: 'Again.',
      sea: 's',
      map: sea,
      section: null,
    });
    expect(root?.querySelector('svg')).toBe(svg);
    panel.update({
      chart: ensoChart(data, monthOf(1900, 1)),
      names,
      text: 'Outside.',
      sea: 's',
      map: sea,
      section: null,
    });
    expect(root?.querySelectorAll('.enso-cursor, .enso-mark')).toHaveLength(0);
    panel.update(null);
    expect(root?.hidden).toBe(true);
  });

  it('Given maps to pick, Then each listed, the index to pick by, the scale its own; a change is heard', () => {
    const container = document.createElement('div');
    const pick = vi.fn();
    const panel = ensoPanel(pick)({ container } as unknown as LayerHost);
    const view = {
      chart: ensoChart(data, monthOf(1997, 12)),
      names,
      text: 't',
      sea: 'Rain.',
      map: {
        options: [
          ...sea.options,
          { value: 'rain-elNino-djf', label: 'Rain, El Niño, December–February' },
        ],
        chosen: 'rain-elNino-djf',
        indices: [
          { id: 'roni', name: 'RONI' },
          { id: 'oni', name: 'ONI' },
        ],
        by: 'oni',
        scale: 'rain',
        ends: '−2 · 0 · +2 mm a day',
      },
      section: null,
    } as const;
    panel.update(view);
    panel.update(view);
    const chooser = container.querySelector<HTMLSelectElement>('.enso-pick');
    const by = container.querySelector<HTMLSelectElement>('.enso-by');
    expect(chooser?.options).toHaveLength(2);
    expect(chooser?.value).toBe('rain-elNino-djf');
    expect(by?.hidden).toBe(false);
    expect(by?.value).toBe('oni');
    expect(by?.options[0]?.textContent).toBe('by RONI');
    expect(container.querySelector<HTMLElement>('.enso-scale')?.dataset['scale']).toBe('rain');
    if (by === null || chooser === null) return;
    by.value = 'roni';
    by.dispatchEvent(new Event('change'));
    expect(pick).toHaveBeenLastCalledWith('rain-elNino-djf', 'roni');
    chooser.value = 'sea';
    chooser.dispatchEvent(new Event('change'));
    expect(pick).toHaveBeenLastCalledWith('sea', 'roni');
  });
});
