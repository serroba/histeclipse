import { describe, expect, it, vi } from 'vitest';

import sites from '../../../public/data/extinctions.json';
import { defaultViewState, withLayer, type ViewState } from '../../state/viewState';
import type { MarkerCardContent } from '../../ui/markerCard';
import type { Capability, FeatureContext } from '../feature';
import { extinctionsFeature } from '.';

const off = defaultViewState(new Date('2026-01-01T00:00:00Z'));
const on: ViewState = { ...off, layers: withLayer(off.layers, 'extinctions', true), ma: 66 };
const JD = 2451545;

function fakeContext(failing = false) {
  const drawn: unknown[] = [];
  const cards: MarkerCardContent[] = [];
  const refresh = vi.fn();
  const context = {
    base: '/',
    fetchJson: () =>
      failing
        ? Promise.reject(new Error('offline'))
        : Promise.resolve(new Response(JSON.stringify(sites))),
    globe: { addLayer: () => ({ update: (input: unknown) => drawn.push(input) }) },
    notify: vi.fn(),
    cards: { show: (card: MarkerCardContent) => cards.push(card), open: () => true },
    refresh,
  } as unknown as FeatureContext<Capability>;
  return { context, drawn, cards, refresh };
}

describe('the extinctions as a feature', () => {
  it('is shown again when the layers, the view, deep time or its span change', () => {
    expect(extinctionsFeature.watches(on)).toEqual([on.layers, on.mode, on.ma, on.deepScale]);
  });

  it('draws nothing, says nothing and eases nothing while its layer is off', () => {
    const { context, drawn } = fakeContext();
    const shown = extinctionsFeature.mount(context, context);
    shown.show?.(off, JD);
    expect(drawn).toEqual([null]);
    expect(shown.said?.()).toBeNull();
    expect(shown.finds?.(off)).toEqual([]);
    expect(shown.finds?.(on)).toContain(251.9);
  });

  it('says it is loading, then marks Chicxulub, the Deccan Traps and El Kef, and opens a card', async () => {
    const { context, drawn, cards, refresh } = fakeContext();
    const shown = extinctionsFeature.mount(context, context);
    shown.show?.(on, JD);
    expect(shown.said?.()).toBe('Loading the extinctions’ places…');
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalled();
    });
    shown.show?.(on, JD);
    expect(shown.said?.()).toBe('End-Cretaceous extinction');
    const marks = drawn.at(-1) as readonly { site: { id: string } }[];
    expect(marks.map((mark) => mark.site.id)).toEqual(['chicxulub', 'deccan-traps', 'el-kef']);
    shown.pick?.('deccan-traps');
    shown.pick?.('nowhere');
    expect(cards.map((card) => card.title)).toEqual(['End-Cretaceous extinction']);
    // Loaded: nothing to report.
    expect(shown.load?.()).toBeNull();
  });

  it('says so when the places cannot be loaded', async () => {
    const { context } = fakeContext(true);
    const shown = extinctionsFeature.mount(context, context);
    shown.show?.(on, JD);
    await vi.waitFor(() => {
      shown.show?.(on, JD);
      expect(shown.said?.()).toBe('Could not load the extinctions’ places.');
    });
  });
});
