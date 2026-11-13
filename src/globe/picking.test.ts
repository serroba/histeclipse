import { Mesh, MeshBasicMaterial, PerspectiveCamera, SphereGeometry } from 'three';
import { describe, expect, it, vi } from 'vitest';

import type { Body, Viewpoint } from '../state/viewState';
import { Picking } from './picking';

/** A canvas 100 pixels square, looking at Earth at its centre and the Moon off to the right. */
function picking(state: { focus?: Body; viewpoint?: Viewpoint; deepTime?: boolean } = {}) {
  const canvas = Object.assign(new EventTarget(), {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
  });
  const camera = new PerspectiveCamera(35, 1, 0.01, 100);
  camera.position.set(0, 0, 5);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const sphere = (radius: number, x: number) => {
    const mesh = new Mesh(new SphereGeometry(radius, 16, 8), new MeshBasicMaterial());
    mesh.position.set(x, 0, 0);
    mesh.updateMatrixWorld();
    return mesh;
  };
  const meshes = { earth: sphere(1, 0), moon: sphere(0.3, 1.4) } as unknown as Record<Body, Mesh>;
  let released: Body | null = null;
  const pick = new Picking({
    canvas,
    camera,
    meshes,
    deepTime: () => state.deepTime ?? false,
    focus: () => state.focus ?? 'earth',
    viewpoint: () => state.viewpoint ?? 'free',
    release: () => released,
  });
  const heard = { bodies: [] as Body[], places: 0, empty: 0, keys: [] as string[] };
  pick.onBodyClick((body) => heard.bodies.push(body));
  pick.onPlacePick(() => (heard.places += 1));
  pick.onEmptyTap(() => (heard.empty += 1));
  pick.onMarkerPick((key) => heard.keys.push(key));
  const pointer = (type: string, x: number, y: number) =>
    canvas.dispatchEvent(Object.assign(new Event(type), { clientX: x, clientY: y }));
  const tap = (x: number, y: number, to = { x, y }) => {
    pointer('pointerdown', x, y);
    pointer('pointermove', to.x, to.y);
    pointer('pointerup', to.x, to.y);
  };
  return {
    pick,
    canvas,
    heard,
    tap,
    pointer,
    releaseTo: (body: Body | null) => (released = body),
  };
}

// The Moon at x = 1.4, five units off with a 35° view, is about 44 pixels right of centre.
const MOON = { x: 94, y: 50 };

describe('picking with the pointer', () => {
  it('picks a place on Earth in view, and asks to fly to another body', () => {
    const { heard, tap } = picking();
    tap(50, 50);
    expect(heard.places).toBe(1);
    tap(MOON.x, MOON.y);
    expect(heard.bodies).toEqual(['moon']);
  });

  it('says a tap on empty space is one, and a drag is no tap', () => {
    const { heard, tap } = picking();
    tap(2, 2);
    expect(heard.empty).toBe(1);
    tap(50, 50, { x: 70, y: 50 });
    expect(heard).toMatchObject({ places: 0, empty: 1, bodies: [] });
  });

  it("flies to Earth from elsewhere, and doesn't ask for the body already orbited", () => {
    const { pick, heard, tap } = picking({ focus: 'moon' });
    tap(50, 50);
    expect(heard.bodies).toEqual(['earth']);
    pick.requestBody('moon');
    expect(heard.bodies).toEqual(['earth']);
  });

  it('picks only Earth in deep time', () => {
    const { heard, tap } = picking({ deepTime: true });
    tap(MOON.x, MOON.y);
    expect(heard.bodies).toEqual([]);
    expect(heard.empty).toBe(1);
  });

  it('releases an attached viewpoint on a drag or the wheel, flying to its body', () => {
    const { heard, pointer, canvas, releaseTo } = picking({ viewpoint: 'moon-from-earth' });
    pointer('pointermove', 10, 10);
    expect(heard.bodies).toEqual([]);
    releaseTo('moon');
    pointer('pointerdown', 10, 10);
    pointer('pointermove', 12, 12);
    expect(heard.bodies).toEqual([]);
    pointer('pointermove', 30, 10);
    expect(heard.bodies).toEqual(['moon']);
    canvas.dispatchEvent(new Event('wheel'));
    expect(heard.bodies).toEqual(['moon', 'moon']);
    releaseTo(null);
    canvas.dispatchEvent(new Event('wheel'));
    expect(heard.bodies).toHaveLength(2);
  });

  it('ignores a release without a press, and unsubscribes', () => {
    const { pick, heard, pointer, tap } = picking();
    pointer('pointerup', 2, 2);
    expect(heard.empty).toBe(0);
    let more = 0;
    const stop = pick.onEmptyTap(() => (more += 1));
    stop();
    tap(2, 2);
    expect(more).toBe(0);
  });

  it("hears taps on a layer's markers by their key, and only on markers", () => {
    /** A stand-in for an element: `closest` finds itself if it has a key. */
    class Marker extends EventTarget {
      readonly key: string | null;
      constructor(key: string | null) {
        super();
        this.key = key;
      }
      closest(): Marker | null {
        return this.key === null ? null : this;
      }
      getAttribute(): string | null {
        return this.key;
      }
    }
    vi.stubGlobal('Element', Marker);
    const { pick, heard } = picking();
    const marker = new Marker('impact:47');
    const plain = new Marker(null);
    pick.pickable(marker as unknown as HTMLElement);
    pick.pickable(plain as unknown as HTMLElement);
    marker.dispatchEvent(new Event('click'));
    plain.dispatchEvent(new Event('click'));
    expect(heard.keys).toEqual(['impact:47']);
    vi.unstubAllGlobals();
  });
});
