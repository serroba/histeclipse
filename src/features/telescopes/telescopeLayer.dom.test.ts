// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import type { LayerHost } from '../../globe/layerHost';
import { telescopeLayer } from './telescopeLayer';
import type { TelescopeMark } from './telescopeMarks';

function fakeHost() {
  const container = document.createElement('div');
  const shown: ({ element: HTMLElement; point: unknown }[] | null)[] = [];
  const host = {
    container,
    pickable: vi.fn(),
    surfaceLabels: () => ({
      show: (pins: { element: HTMLElement; point: unknown }[] | null) => shown.push(pins),
    }),
  } as unknown as LayerHost;
  return { host, container, shown };
}

const mark = (key: string, name: string, building = false): TelescopeMark => ({
  key,
  name,
  building,
  point: { latitude: 19.8, longitude: -155.5 },
  telescopes: [],
});

describe('the ground telescopes on the globe (#848)', () => {
  it('puts a named marker to tap at each site, those being built drawn hollow', () => {
    const { host, container, shown } = fakeHost();
    const layer = telescopeLayer(host);
    layer.update([
      mark('keck+subaru', 'Keck Observatory · Subaru Telescope'),
      mark('elt', 'ELT', true),
    ]);
    const [pins] = shown;
    expect(pins?.map((pin) => pin.element.dataset['pick'])).toEqual([
      'telescope:keck+subaru',
      'telescope:elt',
    ]);
    expect(pins?.[0]?.element.textContent).toBe('Keck Observatory · Subaru Telescope');
    expect(pins?.[1]?.element.classList.contains('is-building')).toBe(true);
    expect(pins?.[1]?.element.getAttribute('aria-label')).toBe('ELT (being built): details');
    expect(container.dataset['telescopes']).toBe('2');
  });

  it('changes nothing for the same telescopes, and clears them when off', () => {
    const { host, container, shown } = fakeHost();
    const layer = telescopeLayer(host);
    layer.update([mark('hale', 'Hale Telescope')]);
    layer.update([mark('hale', 'Hale Telescope')]);
    expect(shown).toHaveLength(1);
    layer.update(null);
    expect(shown.at(-1)).toBeNull();
    expect(container.dataset['telescopes']).toBe('off');
  });
});
