import { describe, expect, it, vi } from 'vitest';

import type { LayerHost } from '../../globe/layerHost';
import { needsOf } from '../../globe/layerCapabilities';
import { growthLayer } from './growthLayer';

describe('Earth growing on the globe (#1219)', () => {
  it('asks for Earth’s size, draws it at the share given, and at its own size given null', () => {
    expect(needsOf(growthLayer)).toEqual(['earthSize']);
    const earthSize = vi.fn();
    const made = growthLayer({ earthSize } as unknown as LayerHost<'earthSize'>);
    made.update(0.3);
    made.update(null);
    expect(earthSize.mock.calls).toEqual([[0.3], [1]]);
  });
});
