import { describe, expect, it, vi } from 'vitest';

import { setUpRenderer } from './rendererSetup';

function renderer() {
  return { setClearColor: vi.fn(), setPixelRatio: vi.fn(), debug: { checkShaderErrors: true } };
}

describe('the globe’s renderer (#1196)', () => {
  it('is see-through, at two device pixels at most', () => {
    const made = renderer();
    setUpRenderer(made, 3, false);
    expect(made.setClearColor).toHaveBeenCalledWith(0x000000, 0);
    expect(made.setPixelRatio).toHaveBeenCalledWith(2);
    setUpRenderer(made, 1, false);
    expect(made.setPixelRatio).toHaveBeenLastCalledWith(1);
  });

  it('checks its shaders only when asked: in development and under test, not for readers', () => {
    const made = renderer();
    setUpRenderer(made, 1, false);
    expect(made.debug.checkShaderErrors).toBe(false);
    setUpRenderer(made, 1, true);
    expect(made.debug.checkShaderErrors).toBe(true);
  });
});
