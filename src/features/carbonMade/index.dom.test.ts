// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import dipoleFile from '../../../public/data/dipole.json';
import { CARBON_LIMIT } from '../../state/layerCatalog';
import { defaultViewState, withLayer, type ViewState } from '../../state/viewState';
import { astronomicalYear } from '../../time/year';
import { moveToYear } from '../../time/yearInput';
import type { Capability, FeatureContext } from '../feature';
import { carbonMadeFeature } from '.';

const start = defaultViewState(new Date('2026-01-01T00:00:00Z'));
const off: ViewState = { ...start, time: moveToYear(start.time, astronomicalYear(1500)) };
const on: ViewState = { ...off, layers: withLayer(off.layers, 'carbonMade', true) };
const JD = 2451545;

/** A context that records what the feature asks of the app (#380): no globe, no page. */
function fakeContext(options: { readonly failing?: boolean } = {}) {
  const refresh = vi.fn();
  const notify = vi.fn();
  const setC14Glow = vi.fn();
  const watch = vi.fn();
  const added: HTMLElement[] = [];
  const fetchJson = vi.fn(() =>
    options.failing === true
      ? Promise.reject(new Error('offline'))
      : Promise.resolve(new Response(JSON.stringify(dipoleFile))),
  );
  const context = {
    base: '/',
    fetchJson,
    notify,
    refresh,
    carbonGlow: { setC14Glow },
    shower: { watch },
    overPage: {
      add: (element: HTMLElement) => {
        added.push(element);
        document.body.append(element);
      },
    },
  } as unknown as FeatureContext<Capability>;
  return { context, refresh, notify, fetchJson, setC14Glow, watch, added };
}

/** The feature mounted and shown `state`, the field's strength in. */
async function loaded(state: ViewState) {
  const fake = fakeContext();
  const shown = carbonMadeFeature.mount(fake.context, fake.context);
  shown.show?.(state, JD);
  await vi.waitFor(() => {
    expect(fake.refresh).toHaveBeenCalledTimes(1);
  });
  shown.show?.(state, JD);
  return { ...fake, shown };
}

describe('where carbon-14 is made, as a feature', () => {
  it('asks for the glow, the shower and a place over the page, and adds its card there', () => {
    expect(carbonMadeFeature.needs).toEqual(['carbonGlow', 'shower', 'overPage']);
    expect(carbonMadeFeature.watches(on)).toEqual([on.layers, on.mode, on.ma, on.deepScale]);
    const { context, added } = fakeContext();
    carbonMadeFeature.mount(context, context);
    expect(added).toHaveLength(1);
    expect(added[0]?.tagName).toBe('DIALOG');
  });

  it('glows, says and offers nothing while its layer is off, in the sky, or on a longer span', () => {
    const { context, fetchJson, setC14Glow } = fakeContext();
    const shown = carbonMadeFeature.mount(context, context);
    for (const state of [off, { ...on, mode: 'sky' }, { ...on, ma: 100, deepScale: 'all' }]) {
      shown.show?.(state as ViewState, JD);
      expect(shown.said?.()).toBeNull();
      expect(shown.action?.()).toBeNull();
      expect(setC14Glow).toHaveBeenLastCalledWith(null);
    }
    expect(fetchJson).not.toHaveBeenCalled();
  });

  it('says what radiocarbon cannot date beyond its reach on the ice ages’ span, and still offers the card', () => {
    const { context, setC14Glow } = fakeContext();
    const shown = carbonMadeFeature.mount(context, context);
    shown.show?.({ ...on, ma: 1, deepScale: 'ice' }, JD);
    expect(shown.said?.()).toBe(CARBON_LIMIT);
    expect(shown.action?.()?.label).toBe('How is it made?');
    expect(setC14Glow).toHaveBeenLastCalledWith(null);
  });

  it('draws today’s field until the moment’s loads, then the moment’s, brightest at the poles', async () => {
    const { context, refresh, fetchJson, setC14Glow } = fakeContext();
    const shown = carbonMadeFeature.mount(context, context);
    shown.show?.(on, JD);
    shown.show?.(on, JD);
    expect(fetchJson).toHaveBeenCalledTimes(1);
    expect(fetchJson).toHaveBeenCalledWith('/data/dipole.json');
    expect(shown.said?.()).toMatch(/^The field at the moment shown is not known yet/);
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
    shown.show?.(on, JD);
    expect(shown.said?.()).toMatch(
      /^The field at the moment shown, \d+\.\d × 10²² A m² \(GGF100k\)/,
    );
    const glow = setC14Glow.mock.lastCall?.[0] as readonly number[];
    expect(glow).toHaveLength(19);
    expect(glow.at(-1)).toBe(1);
  });

  it('draws the glow again only when the year changes', async () => {
    const { shown, setC14Glow } = await loaded(on);
    const drawn = setC14Glow.mock.calls.length;
    shown.show?.(on, JD);
    expect(setC14Glow).toHaveBeenCalledTimes(drawn);
    shown.show?.({ ...on, time: moveToYear(on.time, astronomicalYear(1000)) }, JD);
    expect(setC14Glow).toHaveBeenCalledTimes(drawn + 1);
  });

  it('opens its card from the Layers panel, and draws again for the field picked there', async () => {
    const { shown, refresh, added, setC14Glow } = await loaded(on);
    const [dialog] = added as [HTMLDialogElement];
    shown.action?.()?.run();
    expect(dialog.open).toBe(true);
    const asked = refresh.mock.calls.length;
    const fields = dialog.querySelectorAll<HTMLInputElement>('input[type="radio"]');
    const other = [...fields].find((input) => !input.checked);
    expect(other).toBeDefined();
    if (other === undefined) return;
    other.checked = true;
    other.dispatchEvent(new Event('change', { bubbles: true }));
    expect(refresh.mock.calls.length).toBeGreaterThan(asked);
    const drawn = setC14Glow.mock.calls.length;
    shown.show?.(on, JD);
    expect(setC14Glow).toHaveBeenCalledTimes(drawn + 1);
  });

  it('plays the shower under the field drawn, from the card', async () => {
    const { shown, added, watch } = await loaded(on);
    const [dialog] = added as [HTMLDialogElement];
    shown.action?.()?.run();
    const buttons = [...dialog.querySelectorAll<HTMLButtonElement>('.carbon-made-watch')];
    buttons[0]?.click();
    buttons[1]?.click();
    expect(watch).toHaveBeenCalledTimes(2);
    expect(watch).toHaveBeenNthCalledWith(1, expect.any(Number), false);
    expect(watch).toHaveBeenNthCalledWith(2, expect.any(Number), true);
    expect(watch.mock.calls[0]?.[0]).toBeGreaterThan(0);
  });

  it('tells the reader when the field’s strength does not load, waits on its chip, and tries again from there (#762)', async () => {
    const { context, notify, fetchJson } = fakeContext({ failing: true });
    const shown = carbonMadeFeature.mount(context, context);
    shown.show?.(on, JD);
    expect(shown.load?.()).toEqual({ state: 'loading' });
    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledWith("Could not load the field's strength: offline");
    });
    shown.show?.(on, JD);
    expect(fetchJson).toHaveBeenCalledTimes(1);
    const failed = shown.load?.();
    if (failed?.state !== 'failed') throw new Error('expected a failed load');
    failed.retry();
    expect(fetchJson).toHaveBeenCalledTimes(2);
  });
});
