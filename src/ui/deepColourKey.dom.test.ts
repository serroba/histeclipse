// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

import { MAP_KEY, MILESTONE_KEY } from '../deepTime/colourKey';
import { deepColourKey } from './deepColourKey';

describe('what deep time’s colours mean', () => {
  it('Given the key, Then a swatch for each of the map’s colours and a tick for each milestone kind, folded with the others', () => {
    const key = deepColourKey('deep-fold');
    expect(key.getAttribute('name')).toBe('deep-fold');
    expect(key.querySelector('summary')?.textContent).toBe('What the colours mean');
    expect(key.querySelectorAll('.colour-swatch')).toHaveLength(MAP_KEY.length);
    expect(key.querySelectorAll('.colour-tick')).toHaveLength(MILESTONE_KEY.length);
    const first = key.querySelector<HTMLElement>('.colour-swatch');
    expect(first?.style.background).not.toBe('');
  });
});
