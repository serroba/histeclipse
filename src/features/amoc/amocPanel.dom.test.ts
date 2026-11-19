// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

import file from '../../../public/data/amoc/index.json';
import type { Amoc } from '../../data/amoc';
import type { LayerHost } from '../../globe/layerHost';
import { amocPanel } from './amocPanel';
import { amocChart } from './chartModel';

const amoc = file as unknown as Amoc;

describe('the AMOC’s panel (#925)', () => {
  it('Given a year, Then a row a source with its value and chart, the dispute and the credit; null hides it', () => {
    const container = document.createElement('div');
    const panel = amocPanel({ container } as unknown as LayerHost);
    const root = container.querySelector<HTMLElement>('.amoc-panel');
    expect(root?.hidden).toBe(true);
    const view = {
      chart: amocChart(amoc, { first: 1850, last: 2026 }, 2010),
      disputed: 'Disputed.',
    };
    panel.update(view);
    expect(root?.hidden).toBe(false);
    expect(root?.querySelectorAll('.amoc-row')).toHaveLength(6);
    expect(root?.querySelectorAll('.amoc-cursor')).toHaveLength(6);
    expect(root?.querySelector('.amoc-row.is-rapid .amoc-row-name')?.textContent).toBe(
      'RAPID array, 26.5°N, Sv',
    );
    expect(root?.querySelector('.amoc-row.is-thornalley-2018 .amoc-row-name')?.textContent).toBe(
      'Thornalley et al. 2018, an index',
    );
    expect(root?.textContent).toContain('Disputed.');
    expect(root?.textContent).toContain('1850–2026: each source on its own scale');
    const first = root?.querySelector('.amoc-row');
    panel.update(view);
    expect(root?.querySelector('.amoc-row')).toBe(first);
    panel.update({ chart: amocChart(amoc, { first: 400, last: 800 }, 1990), disputed: 'D' });
    expect(root?.querySelector('.amoc-row.is-rapid')?.textContent).toContain(
      'No readings in these years.',
    );
    expect(root?.querySelector('.amoc-row.is-rapid .amoc-row-value')?.textContent).toBe('–');
    panel.update(null);
    expect(root?.hidden).toBe(true);
  });
});
