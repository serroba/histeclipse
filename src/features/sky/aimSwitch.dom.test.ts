// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import { createAimSwitch } from './aimSwitch';

describe('the sky’s Look at switch', () => {
  it('Given the sky, When Sun or Moon is clicked, Then it turns that way', () => {
    const onAim = vi.fn();
    const aim = createAimSwitch(onAim);
    const [sun, moon] = aim.root.querySelectorAll('button');
    sun?.click();
    moon?.click();
    expect(onAim.mock.calls).toEqual([['sun'], ['moon']]);
  });

  it('Shows only in the sky, the Moon waiting for its ephemeris', () => {
    const aim = createAimSwitch(vi.fn());
    aim.render(false, false);
    expect(aim.root.hidden).toBe(true);
    aim.render(true, false);
    const [sun, moon] = aim.root.querySelectorAll('button');
    expect(aim.root.hidden).toBe(false);
    expect([sun?.disabled, moon?.disabled]).toEqual([false, true]);
    aim.render(true, true);
    expect(moon?.disabled).toBe(false);
  });
});
