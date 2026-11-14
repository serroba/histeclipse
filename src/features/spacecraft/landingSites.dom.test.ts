// @vitest-environment happy-dom
import { PerspectiveCamera, Quaternion, Vector3 } from 'three';
import { describe, expect, it, vi } from 'vitest';

import data from '../../../public/data/spacecraft.json';
import { gcatJd, loadSpacecraft } from '../../data/spacecraft';
import type { LayerHost } from '../../globe/layerHost';
import { MOON_RADIUS_EARTH_RADII } from '../../globe/spaceFrame';
import { bodyOfWorld, landedOn, landingSites } from './landingSites';

const { craft } = await loadSpacecraft('spacecraft.json', () =>
  Promise.resolve(new Response(JSON.stringify(data))),
);

describe('where craft came down (#716)', () => {
  it('Given GCAT’s worlds, Then each is the site’s body, or none', () => {
    expect(bodyOfWorld('Luna')).toBe('moon');
    expect(bodyOfWorld('Mars')).toBe('mars');
    expect(bodyOfWorld('9P/Tempel 1')).toBeNull();
  });

  it('Given the Moon after Apollo 11 landed, Then Eagle is marked at Tranquility, named for its mission', () => {
    const before = landedOn(craft, 'moon', gcatJd('1969-07-20T20:16'));
    expect(before.some(({ id }) => id === 'D00274')).toBe(false);
    const after = landedOn(craft, 'moon', gcatJd('1969-07-20T20:18'));
    const eagle = after.find(({ id }) => id === 'D00274');
    expect(eagle).toEqual({
      id: 'D00274',
      name: 'Apollo 11: Eagle',
      latitude: 0.6875,
      longitude: 23.4333,
    });
    // Others came down before it, the Luna and Surveyor landers, named after it where they crowd.
    expect(after.length).toBeGreaterThan(5);
    expect(after[0]?.id).toBe('D00274');
  });

  it('Given a longitude written from 0 to 360°, Then it is from −180 to 180°', () => {
    const viking = landedOn(craft, 'mars', gcatJd('1977-01-01')).find(
      ({ name }) => name === 'Viking Lander 1',
    );
    expect(viking?.longitude).toBeCloseTo(312.05 - 360, 5);
  });

  it('Given a body nothing had come down on yet, Then none', () => {
    // Before Galileo's probe went into Jupiter in 1995, nothing had.
    expect(landedOn(craft, 'jupiter', gcatJd('1990-01-01'))).toEqual([]);
    expect(landedOn(craft, 'moon', gcatJd('1959-01-01'))).toEqual([]);
  });
});

/** A globe with the Moon at the scene's origin, a camera `distance` out along +X. */
function moonHost(distance: number, focus = 'moon', drawn = true) {
  const container = document.createElement('div');
  Object.defineProperty(container, 'clientWidth', { value: 800 });
  Object.defineProperty(container, 'clientHeight', { value: 600 });
  const camera = new PerspectiveCamera(40, 800 / 600, 1e-4, 1e6);
  camera.position.set(distance, 0, 0);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  let afterRender = (): void => undefined;
  const pickable = vi.fn();
  const host = {
    container,
    camera,
    focus: () => focus,
    bodyFrame: () => ({
      position: new Vector3(),
      rotation: new Quaternion(),
      radius: MOON_RADIUS_EARTH_RADII,
      shown: drawn,
    }),
    pickable,
    requestRender: vi.fn(),
    afterRender: (place: () => void) => {
      afterRender = place;
    },
  } as unknown as LayerHost;
  return {
    host,
    container,
    pickable,
    render: () => {
      afterRender();
    },
  };
}

describe('the landing sites on the body in view', () => {
  const near = { id: 'D1', name: 'Near side', latitude: 0, longitude: 0 };
  const far = { id: 'D2', name: 'Far side', latitude: 0, longitude: 180 };

  it('Given the Moon close up, Then a site facing the camera is named, one beyond the limb is not', () => {
    const { host, container, pickable, render } = moonHost(MOON_RADIUS_EARTH_RADII * 3);
    const layer = landingSites(host);
    layer.update({ body: 'moon', sites: [near, far] });
    render();
    const marks = [...container.querySelectorAll<HTMLButtonElement>('.landing-site')];
    expect(marks.map((mark) => [mark.textContent, mark.hidden])).toEqual([
      ['Near side', false],
      ['Far side', true],
    ]);
    expect(marks[0]?.dataset['pick']).toBe('craft:D1');
    expect(pickable).toHaveBeenCalled();
  });

  it('Given the Moon a dot far away, Then no site is named', () => {
    const { host, container, render } = moonHost(MOON_RADIUS_EARTH_RADII * 5000);
    landingSites(host).update({ body: 'moon', sites: [near] });
    render();
    expect(container.querySelector<HTMLElement>('.landing-site')?.hidden).toBe(true);
  });

  it('Given no sites, a body without names, or nothing, Then none are marked', () => {
    const { host, container } = moonHost(MOON_RADIUS_EARTH_RADII * 3);
    const layer = landingSites(host);
    layer.update({ body: 'moon', sites: [near] });
    expect(container.querySelectorAll('.landing-site')).toHaveLength(1);
    layer.update({ body: 'jupiter', sites: [near] });
    expect(container.querySelectorAll('.landing-site')).toHaveLength(0);
    layer.update(null);
    expect(
      container.querySelector<HTMLElement>('[data-testid="landing-sites"]')?.dataset['marked'],
    ).toBe('0');
  });

  it('Given two sites where their names would cross, Then the first keeps its name', () => {
    const { host, container, render } = moonHost(MOON_RADIUS_EARTH_RADII * 3);
    landingSites(host).update({
      body: 'moon',
      sites: [near, { id: 'D3', name: 'Beside it', latitude: 0.1, longitude: 0.1 }],
    });
    render();
    const shown = [...container.querySelectorAll<HTMLElement>('.landing-site')].map(
      (mark) => mark.hidden,
    );
    // happy-dom lays nothing out, so every name is as wide as nothing: they still meet.
    expect(shown).toEqual([false, true]);
  });

  it('Given a site off the edge of the view, another body in view, or the Moon not drawn, Then it is not named', () => {
    const edge = { id: 'D4', name: 'Limb', latitude: 0, longitude: 80 };
    const close = moonHost(MOON_RADIUS_EARTH_RADII * 1.2);
    landingSites(close.host).update({ body: 'moon', sites: [edge] });
    close.render();
    expect(close.container.querySelector<HTMLElement>('.landing-site')?.hidden).toBe(true);
    for (const other of [
      moonHost(MOON_RADIUS_EARTH_RADII * 3, 'mars'),
      moonHost(MOON_RADIUS_EARTH_RADII * 3, 'moon', false),
    ]) {
      landingSites(other.host).update({ body: 'moon', sites: [near] });
      other.render();
      expect(other.container.querySelector<HTMLElement>('.landing-site')?.hidden).toBe(true);
    }
  });

  it('Given the same sites again, Then they are kept; nothing twice, nothing again', () => {
    const { host, container, render } = moonHost(MOON_RADIUS_EARTH_RADII * 3);
    const layer = landingSites(host);
    render();
    layer.update({ body: 'moon', sites: [near] });
    const first = container.querySelector('.landing-site');
    layer.update({ body: 'moon', sites: [near] });
    expect(container.querySelector('.landing-site')).toBe(first);
    layer.update(null);
    layer.update(null);
    render();
    expect(container.querySelectorAll('.landing-site')).toHaveLength(0);
  });
});

describe('landers with gaps in their record', () => {
  it('Given a lander with no date of landing, Then it counts from its launch', () => {
    const [probe] = craft;
    if (probe === undefined) throw new Error('no craft');
    const undated = {
      ...probe,
      id: 'D99',
      part: false,
      launch: '1970-01-01',
      landing: { world: 'Luna', lat: 1, lon: 2, date: null, site: '-' },
    };
    expect(landedOn([undated], 'moon', gcatJd('1969-12-31'))).toEqual([]);
    expect(landedOn([undated], 'moon', gcatJd('1970-01-02'))).toHaveLength(1);
  });
});
