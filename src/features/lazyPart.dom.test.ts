// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import { defaultViewState, type ViewState } from '../state/viewState';
import { lazyPart } from './lazyPart';
import type { MountedPart } from './part';

const closed = defaultViewState(new Date('2026-01-01T00:00:00Z'));
const open: ViewState = { ...closed, wave: 'gw150914' };

function bodyPart() {
  const element = document.createElement('section');
  const render = vi.fn();
  const part: MountedPart = { watches: () => [], elements: [element], render };
  return { element, render, mount: vi.fn(() => part) };
}

function made(body: () => Promise<() => MountedPart>) {
  const notify = vi.fn();
  const watches = (state: ViewState) => [state.wave];
  const part = lazyPart(
    { watches, wanted: (state) => state.wave !== null, what: 'the wave', body },
    { notify },
  );
  return { part, notify, watches };
}

describe('a part whose code loads when first wanted (#220)', () => {
  it('holds its place with a slot that makes no box, and watches what the front says', () => {
    const { part, watches } = made(() => new Promise(() => undefined));
    expect(part.watches).toBe(watches);
    expect(part.elements).toHaveLength(1);
    expect(part.elements[0]?.style.display).toBe('contents');
  });

  it('loads nothing until wanted, then mounts the body in its slot and shows it the latest view', async () => {
    const real = bodyPart();
    const body = vi.fn(() => Promise.resolve(real.mount));
    const { part } = made(body);
    part.render(closed);
    expect(body).not.toHaveBeenCalled();
    part.render(open);
    // Asked once, however many times it is shown while loading.
    part.render(open);
    await vi.waitFor(() => {
      expect(real.render).toHaveBeenCalledWith(open);
    });
    expect(body).toHaveBeenCalledTimes(1);
    expect(part.elements[0]?.firstElementChild).toBe(real.element);
    part.render(closed);
    expect(real.render).toHaveBeenLastCalledWith(closed);
  });

  it('says when it cannot load, and tries again when asked', async () => {
    const real = bodyPart();
    const body = vi
      .fn<() => Promise<() => MountedPart>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(real.mount);
    const { part, notify } = made(body);
    part.render(open);
    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledWith('Could not load the wave: offline', expect.any(Function));
    });
    const retry = notify.mock.calls[0]?.[1] as () => void;
    retry();
    // A second Try again while it loads asks nothing more.
    retry();
    await vi.waitFor(() => {
      expect(real.render).toHaveBeenCalledWith(open);
    });
    expect(body).toHaveBeenCalledTimes(2);
    // Loaded, Try again does nothing.
    retry();
    expect(body).toHaveBeenCalledTimes(2);
  });
});
