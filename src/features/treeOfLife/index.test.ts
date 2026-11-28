// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as Lineage from '../../data/lineages';
import type { Lineages } from '../../data/lineages';
import type { TreeOfLife } from '../../data/treeOfLife';
import { createStore } from '../../state/store';
import { defaultViewState, type ViewState } from '../../state/viewState';
import type { PartContext } from '../part';
import { mountTreeOfLife } from '.';

// The sheets build DOM and the loaders parse whole files: stand-ins record what the part asks.
type Request = (view: unknown) => void;
type OnGlobe = (ma: number, where: unknown, finds: unknown) => void;
type OnFossil = (to: 'globe' | 'time', group: 'dinosaurs', genus: string) => void;
const sheets = vi.hoisted(() => ({
  tree: {
    dialog: document.createElement('dialog'),
    show: vi.fn(),
    request: null as Request | null,
    onFossil: null as OnFossil | null,
  },
  lineages: {
    dialog: document.createElement('dialog'),
    show: vi.fn(),
    onGlobe: null as OnGlobe | null,
  },
}));
const loads = vi.hoisted(() => ({ tree: vi.fn(), lineages: vi.fn() }));
vi.mock('./treeSheet', () => ({
  createTreeSheet: (
    request: (view: unknown) => void,
    _load: unknown,
    _why: unknown,
    onFossil: OnFossil,
  ) => {
    sheets.tree.request = request;
    sheets.tree.onFossil = onFossil;
    return { dialog: sheets.tree.dialog, show: sheets.tree.show };
  },
}));
vi.mock('./lineagesSheet', () => ({
  createLineagesSheet: (
    _request: unknown,
    _load: unknown,
    floor: (ma: number) => string,
    onGlobe: OnGlobe,
  ) => {
    sheets.lineages.onGlobe = onGlobe;
    expect(floor(250)).toBe('/data/paleodem/250.png');
    return { dialog: sheets.lineages.dialog, show: sheets.lineages.show };
  },
}));
vi.mock('../../data/treeOfLife', () => ({ loadTreeOfLife: loads.tree }));
vi.mock('../../data/lineages', async (actual) => ({
  ...(await actual<typeof Lineage>()),
  loadLineages: loads.lineages,
}));

const tree = { ott: [101, 202, 303] } as unknown as TreeOfLife;
const genus = (index: number, name: string, pbdb: number, first: number) => ({
  index,
  name,
  pbdb,
  first,
  parent: -1,
  children: [],
  track: [{ ma: first, latitude: 40, longitude: -100, finds: 3 }],
});
const dinosaurs = {
  nodes: [
    genus(0, 'Tyrannosaurus', 7, 70),
    genus(1, 'Velociraptor', 9, 75),
    { ...genus(2, 'Footprintia', 11, 80), track: [] },
  ],
} as unknown as Lineages;

function mount() {
  const store = createStore<ViewState>(defaultViewState(new Date('2026-01-01T00:00:00Z')));
  const notify = vi.fn();
  const goToDeepTime = vi.fn();
  const context: PartContext = {
    base: '/',
    fetchJson: () => Promise.reject(new Error('no fetching in tests')),
    store,
    notify,
    why: (id) => ({ id }) as unknown as HTMLElement,
    goToDeepTime,
    timeline: {
      travelling: () => false,
      playing: () => false,
      paused: () => false,
      oldest: () => 540,
      earthFace: (jd) => jd,
    },
    deltaT: () => {
      throw new Error('no ΔT here');
    },
    ephemerides: {
      moon: () => null,
      moonAt: () => null,
      planets: () => null,
      loadPlanets: () => Promise.reject(new Error('none')),
      planetPositions: () => null,
      planetsSeen: () => [],
    },
  };
  return { part: mountTreeOfLife(context), store, notify, goToDeepTime };
}

/** The sheets made, as the view opening them makes them, so their callbacks are known. */
async function openSheets(
  part: ReturnType<typeof mount>['part'],
  store: ReturnType<typeof mount>['store'],
) {
  part.render({ ...store.get(), tree: 'all', lineages: { group: 'dinosaurs', pick: null } });
  await vi.waitFor(() => {
    expect(sheets.tree.onFossil).not.toBeNull();
    expect(sheets.lineages.onGlobe).not.toBeNull();
  });
}

/** Let the loads' promises settle. */
const settled = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('the tree of life part', () => {
  beforeEach(() => {
    loads.tree.mockReset();
    loads.lineages.mockReset();
    sheets.tree.show.mockReset();
    sheets.lineages.show.mockReset();
    sheets.tree.onFossil = null;
    sheets.lineages.onGlobe = null;
  });

  it('holds both sheets’ places on the page, and loads each the first time the view shows it (#220)', async () => {
    const { part, store } = mount();
    const page = document.createElement('div');
    page.append(...part.elements);
    expect(part.elements.every((element) => element.hidden === true)).toBe(true);
    const state = { ...store.get(), tree: 'all' as const };
    expect(part.watches(state)).toEqual(['all', null]);
    part.render(state);
    await vi.waitFor(() => {
      expect(sheets.tree.show).toHaveBeenCalledWith('all');
    });
    expect(page.firstElementChild).toBe(sheets.tree.dialog);
    // The lines, not asked for, are neither loaded nor shown.
    expect(sheets.lineages.show).not.toHaveBeenCalled();
  });

  it('opens the tree at the node picked, or the whole tree when none is', async () => {
    loads.tree.mockResolvedValue(tree);
    const { part, store } = mount();
    part.openTreeAt(() => 1);
    await settled();
    expect(store.get().tree).toEqual({ ott: 202 });
    part.openTreeAt(() => undefined);
    await settled();
    expect(store.get().tree).toBe('all');
    // Loaded once, however often it is asked for.
    expect(loads.tree).toHaveBeenCalledTimes(1);
  });

  it('says when the tree fails to load, and tries again next time', async () => {
    loads.tree.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(tree);
    const { part, store, notify } = mount();
    part.openTreeAt(() => 0);
    await settled();
    expect(notify).toHaveBeenCalledWith('Could not load the tree of life: offline');
    part.openTreeAt(() => 0);
    await settled();
    expect(store.get().tree).toEqual({ ott: 101 });
  });

  it('lets the sheet ask for a view of the tree', async () => {
    const { part, store } = mount();
    await openSheets(part, store);
    sheets.tree.request?.({ ott: 5 });
    expect(store.get().tree).toEqual({ ott: 5 });
  });

  it("opens a group's lines at a genus by name, or the group when there is none such", async () => {
    loads.lineages.mockResolvedValue(dinosaurs);
    const { part, store } = mount();
    part.openLineagesAt('dinosaurs', 'Velociraptor');
    await settled();
    expect(store.get().lineages).toEqual({ group: 'dinosaurs', pick: 9 });
    part.openLineagesAt('dinosaurs', 'Unicornis');
    await settled();
    expect(store.get().lineages).toEqual({ group: 'dinosaurs', pick: null });
    expect(loads.lineages).toHaveBeenCalledTimes(1);
  });

  it('says when the lines fail to load, and tries again next time', async () => {
    loads.lineages.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(dinosaurs);
    const { part, store, notify } = mount();
    part.openLineagesAt('dinosaurs', 'Tyrannosaurus');
    await settled();
    expect(notify).toHaveBeenCalledWith('Could not load the lines through time: offline');
    part.openLineagesAt('dinosaurs', 'Tyrannosaurus');
    await settled();
    expect(store.get().lineages).toEqual({ group: 'dinosaurs', pick: 7 });
  });

  it('closes the lines and goes to deep time with the fossils on', async () => {
    const { part, store, goToDeepTime } = mount();
    await openSheets(part, store);
    store.set((state) => ({ ...state, lineages: { group: 'dinosaurs', pick: 7 } }));
    const where = { lat: 10, lon: 20 };
    sheets.lineages.onGlobe?.(150, where, { group: 'dinosaurs', pbdb: 7 });
    expect(store.get().lineages).toBeNull();
    expect(goToDeepTime).toHaveBeenCalledWith(150, 'fossils', where);
    // Its finds ringed there (#309).
    expect(store.get().finds).toEqual({ group: 'dinosaurs', pbdb: 7 });
  });

  it('goes from a fossil genus on the tree to where it was found, or to its line (#309)', async () => {
    loads.lineages.mockResolvedValue(dinosaurs);
    const { part, store, goToDeepTime, notify } = mount();
    await openSheets(part, store);
    store.set((state) => ({ ...state, tree: { ott: 5 } }));
    sheets.tree.onFossil?.('globe', 'dinosaurs', 'Velociraptor');
    await settled();
    expect(store.get().tree).toBeNull();
    expect(goToDeepTime).toHaveBeenCalledWith(75, 'fossils', {
      ma: 75,
      latitude: 40,
      longitude: -100,
      finds: 3,
    });
    expect(store.get().finds).toEqual({ group: 'dinosaurs', pbdb: 9 });
    // A name with no placed finds: said, and nothing moves.
    sheets.tree.onFossil?.('globe', 'dinosaurs', 'Footprintia');
    await settled();
    expect(notify).toHaveBeenCalledWith(
      'Footprintia has no placed finds in the lines through time.',
    );
    expect(goToDeepTime).toHaveBeenCalledTimes(1);
    store.set((state) => ({ ...state, tree: { ott: 5 } }));
    sheets.tree.onFossil?.('time', 'dinosaurs', 'Tyrannosaurus');
    await settled();
    expect(store.get().tree).toBeNull();
    expect(store.get().lineages).toEqual({ group: 'dinosaurs', pick: 7 });
  });

  it('says when the finds fail to load', async () => {
    loads.lineages.mockRejectedValue(new Error('offline'));
    const { part, store, notify } = mount();
    await openSheets(part, store);
    sheets.tree.onFossil?.('globe', 'dinosaurs', 'Velociraptor');
    await settled();
    expect(notify).toHaveBeenCalledWith('Could not load the genera’s finds: offline');
  });
});
