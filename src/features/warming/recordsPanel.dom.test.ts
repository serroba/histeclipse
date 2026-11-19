// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

import ensoFile from '../../../public/data/enso/index.json';
import records from '../../../public/data/temperature-records/index.json';
import type { Enso } from '../../data/enso';
import type { TemperatureRecords } from '../../data/temperatureRecords';
import type { LayerHost } from '../../globe/layerHost';
import { recordsChart } from './chartModel';
import { recordsPanel } from './recordsPanel';

const data = records as unknown as TemperatureRecords;
const enso = ensoFile as unknown as Enso;
const names = data.series.map(({ id, name }) => ({ id, name }));

describe('the records panel', () => {
  it('Given a year, Then a line per record, the band, the year marked, a key and the credits; null hides it', () => {
    const container = document.createElement('div');
    const panel = recordsPanel({ container } as unknown as LayerHost);
    const root = container.querySelector<HTMLElement>('.records-panel');
    expect(root?.hidden).toBe(true);
    panel.update({ chart: recordsChart(data, 2020), names, text: 'In 2020.', enso: null });
    expect(root?.querySelector<HTMLElement>('.records-enso')?.hidden).toBe(true);
    expect(root?.querySelectorAll('.enso-row')).toHaveLength(0);
    expect(root?.hidden).toBe(false);
    expect(root?.querySelectorAll('.records-line')).toHaveLength(6);
    expect(root?.querySelectorAll('.records-line.is-reanalysis')).toHaveLength(2);
    expect(root?.querySelector('.records-band')).not.toBeNull();
    expect(root?.querySelectorAll('.records-cursor')).toHaveLength(1);
    expect(root?.querySelectorAll('.records-key li')).toHaveLength(6);
    expect(root?.textContent).toContain('In 2020.');
    const svg = root?.querySelector('svg');
    panel.update({ chart: recordsChart(data, 2020), names, text: 'Again.', enso: null });
    expect(root?.querySelector('svg')).toBe(svg);
    panel.update({
      chart: recordsChart(data, 2016, enso),
      names,
      text: 'In 2016.',
      enso: 'In 2016, El Niño.',
    });
    expect(root?.querySelector<HTMLElement>('.records-enso')?.hidden).toBe(false);
    expect(root?.textContent).toContain('In 2016, El Niño.');
    expect(root?.querySelectorAll('.enso-row')).toHaveLength(2);
    expect(root?.querySelectorAll('.enso-mark')).toHaveLength(2);
    panel.update({ chart: recordsChart(data, 1700), names, text: 'Outside.', enso: null });
    expect(root?.querySelectorAll('.enso-mark')).toHaveLength(0);
    expect(root?.querySelectorAll('.records-cursor')).toHaveLength(0);
    panel.update(null);
    expect(root?.hidden).toBe(true);
  });
});
