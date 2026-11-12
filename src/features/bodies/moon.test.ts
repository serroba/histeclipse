import { describe, expect, it, vi } from 'vitest';
import type { MoonEphemeris } from '../../astro/moon';
import { createMoon } from './moon';

describe("the Moon's theory", () => {
  it('is null until it arrives, then says so', async () => {
    const theory = { position: () => [0, 0, 0] } as unknown as MoonEphemeris;
    const arrived = vi.fn();
    const notify = vi.fn();
    const moon = createMoon({ moonArrived: arrived, notify }, () => Promise.resolve(theory));
    expect(moon.ephemeris()).toBeNull();
    moon.load();
    await vi.waitFor(() => {
      expect(arrived).toHaveBeenCalledOnce();
    });
    expect(moon.ephemeris()).toBe(theory);
    expect(notify).not.toHaveBeenCalled();
  });

  it('tells the reader when it cannot load', async () => {
    const arrived = vi.fn();
    const notify = vi.fn();
    const moon = createMoon({ moonArrived: arrived, notify }, () =>
      Promise.reject(new Error('offline')),
    );
    moon.load();
    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledWith("Could not load the Moon's orbit: offline");
    });
    expect(moon.ephemeris()).toBeNull();
    expect(arrived).not.toHaveBeenCalled();
  });
});
