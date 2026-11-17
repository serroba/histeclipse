// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import { railIcons } from './zoomRailIcons';

describe('the layers’ icons on the zoom rail', () => {
  it('Given the rail, Then each icon is named, unpressed and hidden, and calls its own handler', () => {
    const handlers = {
      onOrbits: vi.fn(),
      onSpacecraft: vi.fn(),
      onAsteroids: vi.fn(),
      onWhyHere: vi.fn(),
    };
    const icons = railIcons(handlers);
    expect(Object.values(icons).map((icon) => icon.getAttribute('aria-label'))).toEqual([
      'Orbits',
      'Spacecraft',
      'Asteroid belt',
      'Why here?',
    ]);
    for (const icon of Object.values(icons)) {
      expect(icon.hidden).toBe(true);
      expect(icon.getAttribute('aria-pressed')).toBe('false');
      expect(icon.querySelector('svg')).not.toBeNull();
    }
    expect(icons.whyHere.className).toBe('zoom-step zoom-why-here');
    icons.orbits.click();
    icons.spacecraft.click();
    icons.asteroids.click();
    icons.whyHere.click();
    for (const handler of Object.values(handlers)) expect(handler).toHaveBeenCalledOnce();
  });
});
