import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadImage } from './loadImage';

/** An image that loads, or fails, as soon as it is given a source. */
function fakeImage(outcome: 'load' | 'error') {
  return class extends EventTarget {
    set src(_url: string) {
      queueMicrotask(() => this.dispatchEvent(new Event(outcome)));
    }
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loading an image', () => {
  it('Given it loads, Then it resolves with the image', async () => {
    vi.stubGlobal('Image', fakeImage('load'));
    await expect(loadImage('/a.png')).resolves.toBeInstanceOf(EventTarget);
  });

  it('Given it fails, Then it rejects naming it', async () => {
    vi.stubGlobal('Image', fakeImage('error'));
    await expect(loadImage('/a.png')).rejects.toThrow('could not load /a.png');
  });
});
