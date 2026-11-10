import { describe, expect, it, vi } from 'vitest';

import details from '../../../public/data/volcano-details.json';
import volcanoes from '../../../public/data/volcanoes.json';
import { defaultViewState, withLayer, type ViewState } from '../../state/viewState';
import { astronomicalYear } from '../../time/year';
import { moveToYear } from '../../time/yearInput';
import type { MarkerCardContent } from '../../ui/markerCard';
import { RESTING, type FeatureContext } from '../feature';
import { volcanoesFeature } from '.';

const off = defaultViewState(new Date('2026-01-01T00:00:00Z'));
const on: ViewState = { ...off, layers: withLayer(off.layers, 'volcanoes', true) };
/** The year Tambora erupted. */
const in1815: ViewState = { ...on, time: moveToYear(on.time, astronomicalYear(1815)) };
const JD = 2451545;

/** A context that records what the feature asks of the app (#380): no globe, no page. */
function fakeContext(options: { readonly failing?: boolean; readonly travelling?: boolean } = {}) {
  const drawn: unknown[] = [];
  const cards: MarkerCardContent[] = [];
  const refresh = vi.fn();
  const notify = vi.fn();
  let cardOpen = false;
  const context = {
    base: '/',
    fetchJson: (url: string) =>
      options.failing === true
        ? Promise.reject(new Error('offline'))
        : Promise.resolve(
            new Response(JSON.stringify(url.endsWith('details.json') ? details : volcanoes)),
          ),
    globe: { addLayer: () => ({ update: (input: unknown) => drawn.push(input) }) },
    notify,
    showCard: (card: MarkerCardContent) => {
      cardOpen = true;
      cards.push(card);
    },
    cardOpen: () => cardOpen,
    travelling: () => options.travelling === true,
    refresh,
  } as unknown as FeatureContext;
  return { context, drawn, cards, refresh, notify };
}

/** Shown once the eruptions have loaded. */
async function loaded(context: FeatureContext, refresh: ReturnType<typeof vi.fn>) {
  const shown = volcanoesFeature.mount(context);
  shown.show(in1815, JD);
  await vi.waitFor(() => {
    expect(refresh).toHaveBeenCalled();
  });
  shown.show(in1815, JD);
  return shown;
}

describe('the volcanoes as a feature', () => {
  it('is shown again when the layers, the view or deep time change', () => {
    expect(volcanoesFeature.watches(on)).toEqual([on.layers, on.mode, on.ma]);
  });

  it('draws nothing and says nothing while its layer is off', () => {
    const { context, drawn } = fakeContext();
    const shown = volcanoesFeature.mount(context);
    shown.show(off, JD);
    expect(drawn).toEqual([null]);
    expect(shown.said?.()).toBeNull();
  });

  it('rests while the reader travels through the years', () => {
    const { context, drawn } = fakeContext({ travelling: true });
    const shown = volcanoesFeature.mount(context);
    shown.show(in1815, JD);
    expect(drawn).toEqual([null]);
    expect(shown.said?.()).toBe(RESTING);
  });

  it('says it is loading, then marks the year’s eruptions, Tambora among them', async () => {
    const { context, drawn, refresh } = fakeContext();
    const shown = volcanoesFeature.mount(context);
    shown.show(in1815, JD);
    expect(shown.said?.()).toBe('Loading the eruptions…');
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
    shown.show(in1815, JD);
    const marks = drawn[0] as readonly { volcano: { name: string } }[];
    expect(marks.some(({ volcano }) => volcano.name === 'Tambora')).toBe(true);
    expect(shown.said?.()).toMatch(/1815/);
    // Another moment of the same year draws nothing new.
    shown.show(in1815, JD + 0.5);
    expect(drawn).toHaveLength(1);
  });

  it('opens a volcano’s card, then again with its summary once that loads', async () => {
    const { context, drawn, cards, refresh } = fakeContext();
    const shown = await loaded(context, refresh);
    const marks = drawn[0] as readonly { volcano: { number: number; name: string } }[];
    const tambora = marks.find(({ volcano }) => volcano.name === 'Tambora');
    if (tambora === undefined) throw new Error('no Tambora');
    shown.pick?.(String(tambora.volcano.number));
    expect(cards).toHaveLength(1);
    await vi.waitFor(() => {
      expect(cards).toHaveLength(2);
    });
    shown.pick?.('no-such-volcano');
    expect(cards).toHaveLength(2);
  });

  it('leaves another marker’s card alone when its summary arrives late', async () => {
    const { context, drawn, cards, refresh } = fakeContext();
    const shown = await loaded(context, refresh);
    const marks = drawn[0] as readonly { volcano: { number: number } }[];
    const first = marks[0];
    if (first === undefined) throw new Error('no eruption');
    shown.pick?.(String(first.volcano.number));
    shown.unpick?.();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(cards).toHaveLength(1);
  });

  it('says so when the eruptions cannot be loaded, and tries again next time', async () => {
    const { context, notify } = fakeContext({ failing: true });
    const shown = volcanoesFeature.mount(context);
    shown.show(in1815, JD);
    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledWith('Could not load the eruptions: offline');
    });
    shown.show(in1815, JD);
    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledTimes(2);
    });
  });
});
