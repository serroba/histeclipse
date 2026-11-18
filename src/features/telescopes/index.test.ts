import { describe, expect, it, vi } from 'vitest';

import telescopes from '../../../public/data/telescopes.json';
import { defaultViewState, withLayer, type ViewState } from '../../state/viewState';
import { astronomicalYear } from '../../time/year';
import { moveToYear } from '../../time/yearInput';
import type { MarkerCardContent } from '../../ui/markerCard';
import type { FeatureContext } from '../feature';
import { groundModel, type HeldSite } from './groundModelLayer';
import type { TelescopeMark } from './telescopeMarks';
import { telescopesFeature } from '.';

const off = defaultViewState(new Date('2026-01-01T00:00:00Z'));
const on: ViewState = { ...off, layers: withLayer(off.layers, 'telescopes', true) };
const inYear = (year: number): ViewState => ({
  ...on,
  time: moveToYear(on.time, astronomicalYear(year)),
});
const JD = 2451545;

/** A context that records what the feature asks of the app (#380): no globe, no page. */
function fakeContext(failing = false) {
  const drawn: (readonly TelescopeMark[] | null)[] = [];
  const sites: (HeldSite | null)[] = [];
  const change = vi.fn();
  const cards: MarkerCardContent[] = [];
  const refresh = vi.fn();
  const notify = vi.fn();
  const context = {
    base: '/',
    fetchJson: () =>
      failing
        ? Promise.reject(new Error('offline'))
        : Promise.resolve(new Response(JSON.stringify(telescopes))),
    globe: {
      // The marks first, then the model at a site (#864).
      addLayer: (factory: unknown) =>
        factory === groundModel
          ? { update: (input: HeldSite | null) => sites.push(input) }
          : { update: (input: readonly TelescopeMark[] | null) => drawn.push(input) },
    },
    change,
    notify,
    showCard: (card: MarkerCardContent) => cards.push(card),
    cardOpen: () => cards.length > 0,
    timeline: { travelling: () => true },
    refresh,
  } as unknown as FeatureContext;
  return { context, drawn, sites, cards, refresh, notify, change };
}

async function loaded(year: number) {
  const fake = fakeContext();
  const shown = telescopesFeature.mount(fake.context);
  shown.show?.(inYear(year), JD);
  await vi.waitFor(() => {
    expect(fake.refresh).toHaveBeenCalled();
  });
  shown.show?.(inYear(year), JD);
  return { ...fake, shown };
}

describe('the Telescopes layer as a feature (#848)', () => {
  it('is shown again when the layers, the view or deep time change', () => {
    expect(telescopesFeature.watches(on)).toEqual([on.layers, on.mode, on.ma, on.craft]);
  });

  it('draws nothing and says nothing while its layer is off', () => {
    const { context, drawn } = fakeContext();
    const shown = telescopesFeature.mount(context);
    shown.show?.(off, JD);
    expect(drawn).toEqual([null]);
    expect(shown.said?.()).toBeNull();
  });

  it('says it is loading, then marks the year’s telescopes, even as the years play', async () => {
    const { drawn, shown } = await loaded(1950);
    expect(drawn.at(-1)?.map((mark) => mark.key)).toContain('hale');
    expect(shown.said?.()).toMatch(/great telescopes on the ground working in 1950/);
    // The same year again changes nothing.
    const before = drawn.length;
    shown.show?.(inYear(1950), JD);
    expect(drawn).toHaveLength(before);
  });

  it('opens a telescope’s card on a tap, the others on its site a step away', async () => {
    const { cards, shown } = await loaded(2026);
    shown.pick?.('keck+subaru');
    expect(cards.at(-1)?.title).toBe('Keck Observatory');
    const [subaru] = cards.at(-1)?.related ?? [];
    expect(subaru?.label).toBe('Subaru Telescope');
    subaru?.run();
    expect(cards.at(-1)?.title).toBe('Subaru Telescope');
    shown.pick?.('no-such-telescope');
    expect(cards).toHaveLength(2);
  });

  it('tells the reader when the telescopes cannot load, and tries again', async () => {
    const { context, notify, drawn } = fakeContext(true);
    const shown = telescopesFeature.mount(context);
    shown.show?.(inYear(2000), JD);
    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledWith('Could not load the telescopes: offline');
    });
    expect(shown.said?.()).toBe('Loading the telescopes…');
    shown.show?.(inYear(2000), JD);
    expect(drawn).toHaveLength(0);
  });

  it('Given the view at Keck, Then Keck stands there with Subaru beside it; its card goes there (#864)', async () => {
    const { shown, sites, cards, change, drawn } = await loaded(2026);
    shown.show?.({ ...inYear(2026), craft: 'keck' }, JD);
    const at = sites.at(-1);
    expect(at?.held.id).toBe('keck');
    expect(at?.near.map(({ id }) => id).sort()).toEqual(['keck', 'subaru']);
    shown.show?.({ ...inYear(2026), craft: 'd01093' }, JD);
    expect(sites.at(-1)).toBeNull();
    const keck = drawn
      .at(-1)
      ?.find(({ telescopes: there }) => there.some(({ id }) => id === 'keck'));
    shown.pick?.(keck?.key ?? '');
    const card = cards.at(-1);
    expect(card?.action?.label).toBe('Go to it');
    card?.action?.run();
    const update = change.mock.calls.at(-1)?.[0] as ((state: ViewState) => ViewState) | undefined;
    expect(update?.(inYear(2026)).craft).toBe('keck');
  });
});
