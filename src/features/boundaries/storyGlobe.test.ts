import { describe, expect, it, vi } from 'vitest';

import warmingJson from '../../../public/data/warming/index.json';
import type { MeasuredWarming } from '../../data/measuredWarming';
import { maOfYear } from '../../data/iceSheets';
import { createStore } from '../../state/store';
import { defaultViewState, type ViewState } from '../../state/viewState';
import { FACING } from './holoceneGlobe';
import { createStoryGlobe, type StoryGlobeContext } from './storyGlobe';

function mount(
  warming: () => Promise<MeasuredWarming> = () => Promise.resolve(warmingJson as MeasuredWarming),
) {
  const store = createStore<ViewState>(defaultViewState(new Date('2026-01-01T12:00:00Z')));
  const globe = { flyTo: vi.fn(), zoomTo: vi.fn(), setTemperature: vi.fn() };
  const notify = vi.fn();
  const besideGlobe = vi.fn();
  const holdAt = vi.fn((year: number) => year);
  const context: StoryGlobeContext = {
    store,
    globe,
    loadWarming: warming,
    fileUrl: (file) => `/data/warming/${file}`,
    notify,
    besideGlobe,
    holdAt,
  };
  const story = createStoryGlobe(context);
  // As the page does: every view drawn is shown to it.
  store.subscribe((state) => {
    story.viewed(state);
  });
  return { store, globe, notify, besideGlobe, holdAt, story };
}

const settled = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('the Holocene chapter borrowing the globe (#475)', () => {
  it('Given the chart reaches a year, Then the globe goes there on the ice-age scale, facing the ice sheets', () => {
    const { store, globe, story, besideGlobe } = mount();
    story.follow(-20_000);
    expect(story.borrowing()).toBe(true);
    expect(story.year()).toBe(-20_000);
    expect(store.get().deepScale).toBe('ice');
    expect(store.get().ma).toBeCloseTo(maOfYear(-20_000), 3);
    expect(globe.flyTo).toHaveBeenCalledWith(FACING);
    expect(besideGlobe).toHaveBeenCalled();
  });

  it('Given the story leaves, Then the reader’s view and camera come back', () => {
    const { store, globe, story } = mount();
    const before = store.get();
    story.follow(-20_000);
    story.follow(null);
    expect(story.borrowing()).toBe(false);
    expect(store.get().ma).toBe(before.ma);
    expect(globe.flyTo).toHaveBeenLastCalledWith(before.camera.target);
    story.follow(null);
    expect(story.year()).toBeNull();
  });

  it('Given the chart reaches 1850 or later, Then the measured warming shows, and is cleared on leaving', async () => {
    const { globe, story } = mount();
    story.follow(2000);
    await settled();
    story.follow(2010);
    expect(globe.setTemperature).toHaveBeenLastCalledWith(
      expect.objectContaining({ change: true }),
    );
    story.follow(1500);
    story.follow(2015);
    story.follow(null);
    expect(globe.setTemperature).toHaveBeenLastCalledWith(null);
  });

  it('Given the measured warming cannot load, Then the reader is told, and it is asked for again', async () => {
    const load = vi.fn(() => Promise.reject(new Error('offline')));
    const { notify, story } = mount(load);
    story.follow(2000);
    await settled();
    expect(notify).toHaveBeenCalledWith('Could not load the measured warming: offline');
    story.follow(null);
    story.follow(2000);
    expect(load).toHaveBeenCalledTimes(2);
  });
});

describe('one owner of the moment while the story has the globe (#845)', () => {
  it('Given the reader moves deep time’s bar, Then the chart is held there and the bar keeps the moment', () => {
    const { store, story, holdAt } = mount();
    story.follow(-20_000);
    store.set((state) => ({ ...state, ma: 2.1 }));
    expect(holdAt).toHaveBeenCalledTimes(1);
    expect(story.year()).toBeNull();
    // The chart's echo of that hold does not take the moment back.
    story.follow(holdAt.mock.results[0]?.value as number);
    expect(store.get().ma).toBe(2.1);
  });

  it('Given the chart then moves of itself, Then the globe follows it again', () => {
    const { store, story } = mount();
    story.follow(-20_000);
    store.set((state) => ({ ...state, ma: 2.1 }));
    story.follow(-19_000);
    expect(store.get().ma).toBeCloseTo(maOfYear(-19_000), 3);
  });

  it('Given the story’s own moves, or no story, Then nothing is held', () => {
    const { store, story, holdAt } = mount();
    store.set((state) => ({ ...state, ma: 3 }));
    story.follow(-20_000);
    story.follow(-19_000);
    expect(holdAt).not.toHaveBeenCalled();
  });
});
