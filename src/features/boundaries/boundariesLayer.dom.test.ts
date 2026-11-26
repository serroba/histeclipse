// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import json from '../../../public/data/planetary-boundaries.json';
import type { LayerHost } from '../../globe/layerHost';
import { defaultViewState, withLayer, type ViewState } from '../../state/viewState';
import { astronomicalYear } from '../../time/year';
import { moveToYear } from '../../time/yearInput';
import type { Capability, FeatureContext } from '../feature';
import { boundariesFeature } from '.';

const off = defaultViewState(new Date('2026-06-01T00:00:00Z'));
const on: ViewState = { ...off, layers: withLayer(off.layers, 'boundaries', true) };
const inYear = (year: number, state = on): ViewState => ({
  ...state,
  time: moveToYear(state.time, astronomicalYear(year)),
});
const JD = 2451545;

function mounted(failing = false) {
  const container = document.createElement('div');
  document.body.replaceChildren(container);
  const refresh = vi.fn();
  const change = vi.fn();
  const context = {
    base: '/',
    fetchJson: () =>
      failing
        ? Promise.reject(new Error('offline'))
        : Promise.resolve(new Response(JSON.stringify(json))),
    globe: {
      addLayer: (factory: (host: LayerHost) => unknown) =>
        factory({ container } as unknown as LayerHost),
    },
    notify: vi.fn(),
    refresh,
    change,
  } as unknown as FeatureContext<Capability>;
  const shown = boundariesFeature.mount(context, context);
  const panel = () => container.querySelector<HTMLElement>('.boundaries-panel');
  return { shown, panel, refresh, change, container };
}

async function loaded(year = 2026) {
  const made = mounted();
  made.shown.show?.(inYear(year), JD);
  expect(made.shown.said?.()).toBe('Loading the planetary boundaries…');
  await vi.waitFor(() => {
    expect(made.refresh).toHaveBeenCalled();
  });
  made.shown.show?.(inYear(year), JD);
  return made;
}

describe('the planetary boundaries’ panel beside the globe', () => {
  it('Given the layer off, or a year before the first assessment, Then no panel', () => {
    const { shown, panel } = mounted();
    shown.show?.(inYear(2026, off), JD);
    expect(panel()?.hidden).toBe(true);
    shown.show?.(inYear(1990), JD);
    expect(panel()?.hidden).toBe(true);
    expect(shown.said?.()).toBeNull();
  });

  it('Given 2026, Then the wheel of nine and the 2026 count, the same view costing nothing', async () => {
    const { shown, panel } = await loaded();
    expect(panel()?.hidden).toBe(false);
    expect(shown.said?.()).toBe('Planetary Health Check 2026: 7 of 9 boundaries crossed.');
    expect(panel()?.querySelectorAll('.boundaries-name')).toHaveLength(9);
    expect(panel()?.querySelectorAll('.boundaries-sector')).toHaveLength(9);
    const wheel = panel()?.querySelector('.boundaries-wheel');
    shown.show?.(inYear(2026), JD);
    expect(panel()?.querySelector('.boundaries-wheel')).toBe(wheel);
    // In deep time it rests.
    shown.show?.({ ...inYear(2026), ma: 1 }, JD);
    expect(panel()?.hidden).toBe(true);
  });

  it('Given 2024, Then the 2023 assessment, with nothing to compare it with', async () => {
    const { shown, panel } = await loaded(2024);
    expect(shown.said?.()).toBe('Richardson et al. (2023): 6 of 9 boundaries crossed.');
    expect(panel()?.querySelector<HTMLElement>('.boundaries-compare')?.hidden).toBe(true);
  });

  it('Given a boundary picked, Then its values and its layers, and a layer offered turns on', async () => {
    const { panel, change } = await loaded();
    panel()?.querySelector<HTMLButtonElement>('.boundaries-name[data-boundary="climate"]')?.click();
    const detail = panel()?.querySelector('[data-testid="boundaries-detail"]');
    expect(detail?.textContent).toMatch(/^Climate change: crossed/);
    const offers = [...(detail?.querySelectorAll<HTMLButtonElement>('.boundaries-layer') ?? [])];
    expect(offers.map((button) => button.textContent)).toEqual([
      'Show Warming since 1850',
      'Show Air',
    ]);
    offers[0]?.click();
    const update = change.mock.calls[0]?.[0] as (state: ViewState) => ViewState;
    expect(update(on).layers.has('warming')).toBe(true);
    // Picked again from the wheel, it is let go.
    panel()
      ?.querySelector('.boundaries-sector[data-boundary="climate"]')
      ?.dispatchEvent(new Event('click'));
    expect(panel()?.querySelector('[data-testid="boundaries-detail"]')).toBeNull();
    panel()
      ?.querySelector('.boundaries-sector[data-boundary="novel"]')
      ?.dispatchEvent(new Event('click'));
    expect(panel()?.querySelector('.boundaries-none')).not.toBeNull();
  });

  it('Given compare ticked, Then 2023’s pale bars over the wheel', async () => {
    const { panel } = await loaded();
    expect(panel()?.querySelectorAll('.boundaries-bar')).toHaveLength(0);
    const box = panel()?.querySelector<HTMLInputElement>('.boundaries-compare-box');
    if (box === null || box === undefined) throw new Error('no box');
    box.checked = true;
    box.dispatchEvent(new Event('change'));
    expect(panel()?.querySelectorAll('.boundaries-bar').length).toBeGreaterThan(0);
  });

  it('Given the file does not load, Then it says so', async () => {
    const { shown, refresh } = mounted(true);
    shown.show?.(inYear(2026), JD);
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalled();
    });
    shown.show?.(inYear(2026), JD);
    expect(shown.said?.()).toBe('Could not load the planetary boundaries.');
    expect(shown.load?.()).toMatchObject({ state: 'failed' });
  });
});
