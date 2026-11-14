import { describe, expect, it } from 'vitest';

import { followHistory } from './history';
import { serializeViewState } from '../../state/url';
import { createStore } from '../../state/store';
import { defaultViewState } from '../../state/viewState';
import type { GlobeCamera, ViewState } from '../../state/viewState';

function setUp(opened: ViewState) {
  const store = createStore(opened);
  const listeners: (() => void)[] = [];
  const location = { search: '' };
  const adopted: ViewState[] = [];
  const glided: GlobeCamera[] = [];
  followHistory({
    window: {
      location,
      addEventListener: (type: string, listener: () => void) => {
        if (type === 'popstate') listeners.push(listener);
      },
    } as never,
    store,
    sync: { adopt: (state) => adopted.push(state) },
    globe: { setCamera: (camera) => glided.push(camera) },
  });
  const back = (state: ViewState) => {
    location.search = `?${serializeViewState(state)}`;
    for (const listener of listeners) listener();
  };
  return { store, adopted, glided, back };
}

describe('Back and Forward', () => {
  const opened = defaultViewState(new Date('2024-04-08T18:17Z'));
  const earlier: ViewState = {
    ...opened,
    camera: { target: { latitude: 30, longitude: -100 }, distance: 2 },
  };

  it('Given an earlier view of the same body, Then it is shown, taken as written, and the camera glides there', () => {
    const { store, adopted, glided, back } = setUp(opened);
    back(earlier);
    expect(store.get().camera.distance).toBeCloseTo(2);
    expect(adopted).toHaveLength(1);
    expect(glided).toHaveLength(1);
    expect(glided[0]?.distance).toBeCloseTo(2);
    expect(glided[0]?.target.latitude).toBeCloseTo(30);
  });

  it('Given an earlier view of another body, Then the focus flies on its own, not the camera', () => {
    const { store, glided, back } = setUp(opened);
    back({ ...earlier, focus: 'moon' });
    expect(store.get().focus).toBe('moon');
    expect(glided).toEqual([]);
  });
});
