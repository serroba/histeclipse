import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Lineages } from '../../data/lineages';
import type { TreeOfLife } from '../../data/treeOfLife';
import { createStore } from '../../state/store';
import { defaultViewState, type ViewState } from '../../state/viewState';
import type { PartContext } from '../part';
import { mountTreeOfLife } from '.';

// The sheets build DOM and the loaders parse whole files: stand-ins record what the part asks.
type Request = (view: unknown) => void;
type OnGlobe = (ma: number, where: unknown) => void;
const sheets = vi.hoisted(() => ({
  tree: { show: vi.fn(), request: null as Request | null },
  lineages: { show: vi.fn(), onGlobe: null as OnGlobe | null },
}));
const loads = vi.hoisted(() => ({ tree: vi.fn(), lineages: vi.fn() }));
vi.mock('./treeSheet', () => ({
  createTreeSheet: (request: (view: unknown) => void) => {
    sheets.tree.request = request;
    return { dialog: 'tree-dialog', show: sheets.tree.show };
  },
}));
vi.mock('./lineagesSheet', () => ({
  createLineagesSheet: (
    _request: unknown,
    _load: unknown,
    floor: (ma: number) => string,
    onGlobe: (ma: number, where: unknown) => void,
  ) => {
    sheets.lineages.onGlobe = onGlobe;
    expect(floor(250)).toBe('/data/paleodem/250.png');
    return { dialog: 'lineages-dialog', show: sheets.lineages.show };
  },
}));
vi.mock('../../data/treeOfLife', () => ({ loadTreeOfLife: loads.tree }));
vi.mock('../../data/lineages', () => ({ loadLineages: loads.lineages }));

const tree = { ott: [101, 202, 303] } as unknown as TreeOfLife;
const dinosaurs = {
  nodes: [
    { name: 'Tyrannosaurus', pbdb: 7 },
    { name: 'Velociraptor', pbdb: 9 },
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
  };
  return { part: mountTreeOfLife(context), store, notify, goToDeepTime };
}

/** Let the loads' promises settle. */
const settled = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('the tree of life part', () => {
  beforeEach(() => {
    loads.tree.mockReset();
    loads.lineages.mockReset();
    sheets.tree.show.mockReset();
    sheets.lineages.show.mockReset();
  });

  it('puts both sheets on the page and shows what the view says of them', () => {
    const { part, store } = mount();
    expect(part.elements).toEqual(['tree-dialog', 'lineages-dialog']);
    const state = { ...store.get(), tree: 'all' as const };
    expect(part.watches(state)).toEqual(['all', null]);
    part.render(state);
    expect(sheets.tree.show).toHaveBeenCalledWith('all');
    expect(sheets.lineages.show).toHaveBeenCalledWith(null);
  });

  it('opens the tree at the node picked, or the whole tree when none is', async () => {
    loads.tree.mockResolvedValue(tree);
    const { part, store } = mount();
    part.openTreeAt(() => 1);
    await settled();
    expect(store.get().tree).toEqual({ ott: 202 });
    part.action('Whole tree', () => undefined).run();
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

  it('lets the sheet ask for a view of the tree', () => {
    const { store } = mount();
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

  it('closes the lines and goes to deep time with the fossils on', () => {
    const { store, goToDeepTime } = mount();
    store.set((state) => ({ ...state, lineages: { group: 'dinosaurs', pick: 7 } }));
    const where = { lat: 10, lon: 20 };
    sheets.lineages.onGlobe?.(150, where);
    expect(store.get().lineages).toBeNull();
    expect(goToDeepTime).toHaveBeenCalledWith(150, 'fossils', where);
  });
});
