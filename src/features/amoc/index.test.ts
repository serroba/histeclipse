// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import file from '../../../public/data/amoc/index.json';
import type { LayerFactory, LayerHost } from '../../globe/layerHost';
import { defaultViewState, withLayer, type ViewState } from '../../state/viewState';
import { astronomicalYear } from '../../time/year';
import { moveToYear } from '../../time/yearInput';
import type { Capability, FeatureContext } from '../feature';
import { amocFeature } from '.';

const off = defaultViewState(new Date('2026-01-01T00:00:00Z'));
const on: ViewState = { ...off, layers: withLayer(off.layers, 'amoc', true) };
const inYear = (year: number, state = on): ViewState => ({
  ...state,
  time: moveToYear(state.time, astronomicalYear(year)),
});
const JD = 2451545;

function fakeContext(options: { readonly failing?: boolean } = {}) {
  const container = document.createElement('div');
  const refresh = vi.fn();
  const notify = vi.fn();
  const context = {
    base: '/',
    fetchJson: () =>
      options.failing === true
        ? Promise.reject(new Error('offline'))
        : Promise.resolve(new Response(JSON.stringify(file))),
    globe: {
      addLayer: (factory: LayerFactory<unknown>) =>
        factory({
          container,
          historyPaint: () => ({ show: () => undefined }),
        } as unknown as LayerHost),
    },
    notify,
    refresh,
  } as unknown as FeatureContext<Capability>;
  return { context, container, refresh, notify };
}

describe('the AMOC as a feature (#925)', () => {
  it('Given it on, Then it loads, draws a row a source over the sources’ years or the bar’s, and the line', async () => {
    const { context, container, refresh } = fakeContext();
    const shown = amocFeature.mount(context, context);
    shown.show?.(inYear(2010), JD);
    expect(shown.said?.()).toBe('Loading the AMOC records…');
    expect(container.dataset['amocLine']).toBe('on');
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledOnce();
    });
    shown.show?.(inYear(2010), JD);
    expect(shown.said?.()).toMatch(/^2010: RAPID array, 26\.5°N/);
    const panel = container.querySelector<HTMLElement>('.amoc-panel');
    expect(panel?.textContent).toContain('400–2024: each source on its own scale');
    shown.show?.({ ...inYear(2010), yearsWindow: { first: 1850, last: 2026 } }, JD);
    expect(panel?.textContent).toContain('1850–2026');
    shown.show?.({ ...on, ma: 1 }, JD);
    expect(panel?.hidden).toBe(true);
    expect(container.dataset['amocLine']).toBe('off');
    expect(shown.said?.()).toBeNull();
  });

  it('Given the file does not load, Then it says so and tries again', async () => {
    const { context, notify } = fakeContext({ failing: true });
    const shown = amocFeature.mount(context, context);
    shown.show?.(inYear(2010), JD);
    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledWith('Could not load the AMOC records: offline');
    });
    shown.show?.(inYear(2010), JD);
    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledTimes(2);
    });
  });
});
