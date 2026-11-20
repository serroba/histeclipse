import { describe, expect, it, vi } from 'vitest';

import { frameDeepEarth } from './frame';

describe('framing Earth on entering deep time (#948)', () => {
  it('Given a camera close in, Then it turns to the maps’ land and draws back', () => {
    const globe = { flyTo: vi.fn(), zoomTo: vi.fn() };
    frameDeepEarth(globe, 3);
    expect(globe.flyTo).toHaveBeenCalledWith({ latitude: -20, longitude: 0 });
    expect(globe.zoomTo).toHaveBeenCalledWith(4.5);
  });

  it('Given a camera already far out, Then it only turns', () => {
    const globe = { flyTo: vi.fn(), zoomTo: vi.fn() };
    frameDeepEarth(globe, 8);
    expect(globe.flyTo).toHaveBeenCalledOnce();
    expect(globe.zoomTo).not.toHaveBeenCalled();
  });
});
