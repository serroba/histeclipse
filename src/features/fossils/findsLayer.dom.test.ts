// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import type { LayerHost } from '../../globe/layerHost';
import { findsLayer } from './findsLayer';

function fakeHost() {
  const container = document.createElement('div');
  const shown: ({ element: HTMLElement; point: unknown }[] | null)[] = [];
  const pickable = vi.fn();
  const host = {
    container,
    pickable,
    surfaceLabels: () => ({
      show: (pins: { element: HTMLElement; point: unknown }[] | null) => shown.push(pins),
    }),
  } as unknown as LayerHost;
  return { host, container, shown, pickable };
}

const site = (latitude: number, finds: number) => ({ ma: 65, latitude, longitude: -100, finds });

describe('one genus’s finds on the globe (#309)', () => {
  it('rings each site in its group’s colour, says how many finds, and lets taps through', () => {
    const { host, container, shown, pickable } = fakeHost();
    const layer = findsLayer(host);
    layer.update({ group: 'dinosaurs', sites: [site(52, 80), site(40, 1)] });
    const [pins] = shown;
    expect(pins?.map((pin) => pin.point)).toEqual([site(52, 80), site(40, 1)]);
    expect(pins?.map((pin) => pin.element.title)).toEqual(['80 finds', '1 find']);
    expect(pins?.[0]?.element.className).toBe('empire-label fossil-find is-dinosaurs');
    expect(pickable).not.toHaveBeenCalled();
    expect(container.dataset['fossilFinds']).toBe('2');
  });

  it('draws again only when the sites change, and clears for none', () => {
    const { host, container, shown } = fakeHost();
    const layer = findsLayer(host);
    layer.update({ group: 'mammals', sites: [site(10, 2)] });
    layer.update({ group: 'mammals', sites: [site(10, 2)] });
    expect(shown).toHaveLength(1);
    layer.update(null);
    expect(shown).toEqual([expect.any(Array), null]);
    expect(container.dataset['fossilFinds']).toBe('off');
  });
});
