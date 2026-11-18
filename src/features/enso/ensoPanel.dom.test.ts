// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

import file from '../../../public/data/enso/index.json';
import { monthOf, type Enso } from '../../data/enso';
import type { LayerHost } from '../../globe/layerHost';
import { ensoChart } from './chartModel';
import { ensoPanel } from './ensoPanel';

const data = file as unknown as Enso;
const names = data.indices.map(({ id, label }) => ({ id, name: label }));

describe('the ENSO panel', () => {
  it('Given a month, Then a line per index, the thresholds, a strip of episodes each, the month marked, a key and the credit; null hides it', () => {
    const container = document.createElement('div');
    const panel = ensoPanel({ container } as unknown as LayerHost);
    const root = container.querySelector<HTMLElement>('.enso-panel');
    expect(root?.hidden).toBe(true);
    const at = monthOf(1997, 12);
    panel.update({
      chart: ensoChart(data, at),
      names,
      text: 'December 1997.',
      sea: 'On the globe, the sea.',
    });
    expect(root?.hidden).toBe(false);
    expect(root?.querySelectorAll('.enso-line')).toHaveLength(2);
    expect(root?.querySelectorAll('.enso-threshold')).toHaveLength(2);
    expect(root?.querySelectorAll('.enso-row')).toHaveLength(2);
    expect(root?.querySelectorAll('.enso-episode.is-elNino').length).toBeGreaterThan(10);
    expect(root?.querySelectorAll('.enso-episode.is-laNina').length).toBeGreaterThan(10);
    // One cursor on the chart and one on each strip.
    expect(root?.querySelectorAll('.enso-cursor')).toHaveLength(3);
    expect(root?.querySelectorAll('.enso-key li')).toHaveLength(2);
    expect(root?.querySelector('figcaption')?.textContent).toBe(
      'The tropical Pacific, 1950–2026: °C from normal',
    );
    expect(root?.textContent).toContain('December 1997.');
    expect(root?.querySelector('.enso-sea')?.textContent).toBe('On the globe, the sea.');
    expect(root?.querySelector('.enso-scale')).not.toBeNull();
    const svg = root?.querySelector('svg');
    panel.update({ chart: ensoChart(data, at), names, text: 'Again.', sea: 's' });
    expect(root?.querySelector('svg')).toBe(svg);
    panel.update({ chart: ensoChart(data, monthOf(1900, 1)), names, text: 'Outside.', sea: 's' });
    expect(root?.querySelectorAll('.enso-cursor')).toHaveLength(0);
    panel.update(null);
    expect(root?.hidden).toBe(true);
  });
});
