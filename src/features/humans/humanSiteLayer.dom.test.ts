// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

import type { HumanSite } from '../../data/humanClaims';
import type { LayerHost, SurfacePin } from '../../globe/layerHost';
import { humanSiteLayer } from './humanSiteLayer';

const site = (id: string, disputed = false): HumanSite => ({
  id,
  label: id,
  species: 'sapiens',
  point: { latitude: 0, longitude: 0 },
  disputed,
});

function layer() {
  const shown: (readonly SurfacePin[] | null)[] = [];
  const container = document.createElement('div');
  const made = humanSiteLayer({
    container,
    pickable: () => undefined,
    surfaceLabels: () => ({ show: (pins: readonly SurfacePin[] | null) => shown.push(pins) }),
  } as unknown as LayerHost);
  const classes = () =>
    Object.fromEntries(
      (shown.at(-1) ?? []).map((pin) => [pin.element.textContent, pin.element.className]),
    );
  return { made, shown, container, classes };
}

describe('the finds on the globe', () => {
  it('Given a first look, Then the finds are marked without a pulse, a disputed one so marked', () => {
    const { made, classes, container } = layer();
    made.update([site('a'), site('b', true)]);
    expect(classes()).toEqual({
      a: 'empire-label human-site is-sapiens',
      b: 'empire-label human-site is-sapiens is-disputed',
    });
    expect(container.dataset['humans']).toBe('2');
  });

  it('Given the same finds again, as time plays on, Then they are not laid out again', () => {
    const { made, shown } = layer();
    made.update([site('a')]);
    made.update([site('a')]);
    expect(shown).toHaveLength(1);
  });

  it('Given time playing on, Then a find that comes into view pulses, and those already there do not', () => {
    const { made, classes } = layer();
    made.update([site('a')]);
    made.update([site('a'), site('b')]);
    expect(classes()['b']).toMatch(/ is-new$/);
    expect(classes()['a']).not.toMatch(/is-new/);
  });

  it('Given a jump that brings many finds at once, Then none pulses; and after the layer is off, nor on its return', () => {
    const { made, classes, shown } = layer();
    made.update([site('a')]);
    made.update(['a', 'b', 'c', 'd', 'e', 'f'].map((id) => site(id)));
    expect(Object.values(classes()).some((name) => name.includes('is-new'))).toBe(false);
    made.update(null);
    expect(shown.at(-1)).toBeNull();
    made.update([site('a'), site('z')]);
    expect(Object.values(classes()).some((name) => name.includes('is-new'))).toBe(false);
  });

  it('Given a find whose DNA has been read, or a DNA place, Then the find has a badge and the place its mark; and either changing lays them out again', () => {
    const { made, shown } = layer();
    made.update([site('a'), { ...site('p'), dna: true }]);
    made.update([
      { ...site('a'), hasDna: true },
      { ...site('p'), dna: true },
    ]);
    expect(shown).toHaveLength(2);
    const [find, place] = shown.at(-1) ?? [];
    expect(find?.element.querySelector('.human-site-dna')?.textContent).toBe('DNA');
    expect(find?.element.textContent).toBe('a DNA');
    expect(place?.element.className).toBe('empire-label human-site is-sapiens is-dna');
  });
});
