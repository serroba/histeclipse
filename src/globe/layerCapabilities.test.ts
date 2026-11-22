import { describe, expect, it, vi } from 'vitest';

import { lend, needing, needsOf, type LayerCapabilities } from './layerCapabilities';

function host(): { requestRender: () => void } & LayerCapabilities {
  return {
    requestRender: () => undefined,
    holdCraft: () => undefined,
    showSunImage: () => undefined,
  };
}

describe('what a layer is lent of the globe (#938)', () => {
  it('Given a layer that asks for nothing, Then it gets the core and no capability', () => {
    const lent = lend(host(), []);
    expect(Object.keys(lent)).toEqual(['requestRender']);
  });

  it('Given a layer that asks for one capability, Then it gets that one and not the other', () => {
    const hold = vi.fn();
    const lent = lend({ ...host(), holdCraft: hold }, ['holdCraft']);
    expect(Object.keys(lent).sort()).toEqual(['holdCraft', 'requestRender']);
    lent.holdCraft(null);
    expect(hold).toHaveBeenCalledWith(null);
    expect('showSunImage' in lent).toBe(false);
  });
});

describe('a layer that asks for capabilities by name (#938)', () => {
  it('Given needing, Then the layer says what it asked for', () => {
    const factory = needing(['showSunImage'], () => ({ update: () => undefined }));
    expect(needsOf(factory)).toEqual(['showSunImage']);
  });

  it('Given a plain layer, Then it asked for nothing', () => {
    expect(needsOf(() => ({ update: () => undefined }))).toEqual([]);
  });
});
