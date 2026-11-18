import {
  BoxGeometry,
  DirectionalLight,
  Mesh,
  MeshPhongMaterial,
  PerspectiveCamera,
  Quaternion,
  type Scene,
  Vector3,
} from 'three';
import { describe, expect, it, vi } from 'vitest';

import type { CraftFrame } from '../../globe/focus';
import type { LayerHost, Triple } from '../../globe/layerHost';
import { sceneModelOf, type SceneModel } from './craftModels';
import {
  cameraOnCraft,
  craftModel,
  focusedCraft,
  hiddenBy,
  METRES_PER_SCENE,
  pointsBeside,
} from './craftModelLayer';
import { WEBB } from '../../models/webbModel';

/** A host with a camera, the Sun far down −z, and space in km straight to Earth radii. */
function fakeHost(sun = new Vector3(0, 0, -23_455)) {
  const held: (CraftFrame | null)[] = [];
  const over: { scene: Scene; camera: PerspectiveCamera }[] = [];
  const requestRender = vi.fn();
  const camera = new PerspectiveCamera(40, 1.5, 1e-4, 1e6);
  let afterRender = (): void => undefined;
  let toScene: ((km: Triple) => Triple) | null = (km) => [
    km[0] / 6378.137,
    km[1] / 6378.137,
    km[2] / 6378.137,
  ];
  const container = { dataset: {} as Record<string, string> };
  const host = {
    camera,
    container,
    sunPosition: () => sun,
    spaceToScene: () => toScene,
    holdCraft: (craft: CraftFrame | null) => held.push(craft),
    afterRender: (place: () => void) => {
      afterRender = place;
    },
    drawOver: (scene: Scene, seen: PerspectiveCamera) => over.push({ scene, camera: seen }),
    requestRender,
  } as unknown as LayerHost;
  return {
    host,
    container,
    camera,
    held,
    over,
    requestRender,
    /** A frame drawn: what the layer draws over it, if anything. */
    frame: () => {
      afterRender();
      return over.at(-1);
    },
    noMoment: () => {
      toScene = null;
    },
  };
}

/** A model of a box 20 m long, its parts given back when let go. */
function boxModel(made: Mesh[] = []): SceneModel {
  return {
    radius: 10,
    about: 'earth',
    pointing: 'Any way',
    load: () =>
      Promise.resolve(() => {
        const mesh = new Mesh(new BoxGeometry(14, 2, 20), new MeshPhongMaterial());
        made.push(mesh);
        return mesh;
      }),
  };
}

const L2_KM: Triple = [0, 0, 1_500_000];

describe('the craft the camera is on, as a model (#796)', () => {
  it('Given Webb’s scene model, Then its radius is half its sunshield’s length', () => {
    expect(sceneModelOf('d01093')?.radius).toBeCloseTo(WEBB.sunshieldLength / 2, 6);
    expect(sceneModelOf('D01093')?.about).toBe('earth');
    expect(sceneModelOf('D00273')).toBeUndefined();
  });

  it('Given a craft named among those shown, Then it is the one focused, if it has a model', () => {
    const shown = [
      { id: 'D00273', km: [1, 2, 3] as Triple },
      { id: 'D01093', km: L2_KM },
    ];
    expect(focusedCraft('d01093', shown)?.km).toBe(L2_KM);
    expect(focusedCraft(null, shown)).toBeNull();
    expect(focusedCraft('d00273', shown)).toBeNull();
    expect(focusedCraft('d01093', shown.slice(0, 1))).toBeNull();
  });

  it('Given craft at L2 with the one the camera is on, Then close up those on its point are hidden; others are not', () => {
    const webb = { id: 'D01093', km: L2_KM, model: boxModel() };
    expect(hiddenBy(webb, { id: 'D01093', km: L2_KM }, 4)).toBe(true);
    expect(hiddenBy(webb, { id: 'D01186', km: [10, 0, 1_500_000] }, 4)).toBe(true);
    expect(hiddenBy(webb, { id: 'D00273', km: [0, 0, 1_400_000] }, 4)).toBe(false);
    expect(hiddenBy(null, { id: 'D01093', km: L2_KM }, 4)).toBe(false);
    // From too far to see the model, its point marks it again, with the others.
    expect(hiddenBy(webb, { id: 'D01093', km: L2_KM }, 3000)).toBe(false);
    const shown = [
      { id: 'D01186', km: L2_KM },
      { id: 'D00273', km: [0, 0, 1_400_000] as Triple },
      { id: 'D01093', km: L2_KM },
    ];
    // Close up, only those away from it; far, all, the one the camera is on first.
    expect(pointsBeside(webb, shown, 4).map(({ id }) => id)).toEqual(['D00273']);
    expect(pointsBeside(webb, shown, 3000).map(({ id }) => id)).toEqual([
      'D01093',
      'D01186',
      'D00273',
    ]);
    expect(pointsBeside(null, shown, 4)).toBe(shown);
  });

  it('Given Webb at L2, Then it is held for the camera there at its size, and drawn over the view once loaded', async () => {
    const { host, held, frame, camera, container } = fakeHost();
    const layer = craftModel(host);
    layer.update({ id: 'D01093', km: L2_KM, model: boxModel() });
    const held1 = held.at(-1);
    expect(held1?.id).toBe('d01093');
    expect(held1?.about).toBe('earth');
    expect((held1?.radius ?? 0) * METRES_PER_SCENE).toBeCloseTo(10, 6);
    expect(held1?.position.z).toBeCloseTo(1_500_000 / 6378.137, 6);
    // Its sunshield (+Y) away from the Sun, which is down −z: along +z.
    const away = new Vector3(0, 1, 0).applyQuaternion(held1?.rotation ?? new Quaternion());
    expect(away.z).toBeCloseTo(1, 9);
    // Not drawn until its parts have come.
    camera.position
      .copy(held1?.position ?? new Vector3())
      .add(new Vector3(0, 0, 40 / METRES_PER_SCENE));
    expect(frame()).toBeUndefined();
    await vi.waitFor(() => {
      expect(frame()).toBeDefined();
    });
    const drawn = frame();
    expect(container.dataset['craftModel']).toBe('d01093');
    const model = drawn?.scene.getObjectByName('craft-model');
    expect(model?.children).toHaveLength(1);
    expect(model?.quaternion.equals(held1?.rotation ?? new Quaternion())).toBe(true);
    // Seen from 40 m, in metres; lit from the Sun's side.
    expect(drawn?.camera.position.z).toBeCloseTo(40, 6);
    const light = drawn?.scene.children.find((part) => part instanceof DirectionalLight);
    expect(light?.position.z).toBeLessThan(0);
  });

  it('Given the craft let go, Then nothing is held or drawn; shown again, the same model is kept', async () => {
    const made: Mesh[] = [];
    const { host, held, frame, over, container } = fakeHost();
    const layer = craftModel(host);
    const webb = { id: 'D01093', km: L2_KM, model: boxModel(made) };
    layer.update(webb);
    await vi.waitFor(() => {
      expect(made).toHaveLength(1);
    });
    layer.update(null);
    expect(held.at(-1)).toBeNull();
    const drawnBefore = over.length;
    frame();
    expect(over).toHaveLength(drawnBefore);
    expect(container.dataset['craftModel']).toBeUndefined();
    const holds = held.length;
    layer.update(null);
    // Nothing held, nothing to let go again.
    expect(held).toHaveLength(holds);
    layer.update(webb);
    expect(frame()?.scene.getObjectByName('craft-model')?.children).toEqual([made[0]]);
    expect(made).toHaveLength(1);
  });

  it('Given another craft, Then its model replaces the first, which is given back', async () => {
    const made: Mesh[] = [];
    const { host, frame } = fakeHost();
    const layer = craftModel(host);
    layer.update({ id: 'D01093', km: L2_KM, model: boxModel(made) });
    await vi.waitFor(() => {
      expect(made).toHaveLength(1);
    });
    const given = vi.spyOn(made[0]?.geometry ?? new BoxGeometry(), 'dispose');
    layer.update({ id: 'S20580', km: [7000, 0, 0], model: boxModel(made) });
    // The first is not drawn for the second while the second's parts come.
    expect(frame()).toBeUndefined();
    await vi.waitFor(() => {
      expect(made).toHaveLength(2);
    });
    expect(given).toHaveBeenCalled();
    expect(frame()?.scene.getObjectByName('craft-model')?.children).toEqual([made[1]]);
  });

  it('Given a model that comes in after its craft was let go, Then it is not drawn', async () => {
    let arrive: () => void = () => undefined;
    const late: SceneModel = {
      ...boxModel(),
      load: () =>
        new Promise((resolve) => {
          arrive = () => {
            resolve(() => new Mesh());
          };
        }),
    };
    const { host, frame } = fakeHost();
    const layer = craftModel(host);
    layer.update({ id: 'D01093', km: L2_KM, model: late });
    layer.update(null);
    arrive();
    await Promise.resolve();
    await Promise.resolve();
    layer.update({ id: 'D01093', km: L2_KM, model: boxModel() });
    expect(frame()).toBeUndefined();
  });

  it('Given a model that cannot be loaded, Then the craft is still held, with nothing drawn', async () => {
    const { host, held, requestRender, frame } = fakeHost();
    const layer = craftModel(host);
    layer.update({
      id: 'D01093',
      km: L2_KM,
      model: { ...boxModel(), load: () => Promise.reject(new Error('offline')) },
    });
    await vi.waitFor(() => {
      expect(requestRender).toHaveBeenCalledTimes(2);
    });
    expect(held.at(-1)?.id).toBe('d01093');
    expect(frame()).toBeUndefined();
  });

  it('Given no moment yet, Then nothing is held; disposed, its model is given back', async () => {
    const made: Mesh[] = [];
    const { host, held, noMoment } = fakeHost();
    const layer = craftModel(host);
    layer.update({ id: 'D01093', km: L2_KM, model: boxModel(made) });
    await vi.waitFor(() => {
      expect(made).toHaveLength(1);
    });
    const given = vi.spyOn(made[0]?.geometry ?? new BoxGeometry(), 'dispose');
    noMoment();
    layer.update({ id: 'D01093', km: L2_KM, model: boxModel() });
    expect(held.at(-1)).toBeNull();
    layer.dispose?.();
    expect(given).toHaveBeenCalled();
  });

  it('Given the view’s camera metres from Webb at L2, Then the model’s camera is there in metres, to the micrometre, with its lens', () => {
    const view = new PerspectiveCamera(40, 1.5, 1e-4, 1e6);
    view.setViewOffset(1500, 1000, 100, 0, 1400, 1000);
    // Off every axis, so no coordinate is conveniently round.
    const at = new Vector3(912_345.678, -403_210.987, 1_123_456.789).divideScalar(6378.137);
    const offset = new Vector3(3.25, -4.5, 12.125);
    view.position.copy(at).add(offset.clone().divideScalar(METRES_PER_SCENE));
    view.lookAt(at);
    view.updateMatrixWorld(true);
    const seen = new PerspectiveCamera();
    cameraOnCraft(view, at, seen);
    expect(seen.position.distanceTo(offset)).toBeLessThan(1e-6);
    expect(seen.quaternion.equals(view.quaternion)).toBe(true);
    expect(seen.view?.offsetX).toBe(100);
    expect(seen.near).toBeLessThan(offset.length());
    expect(seen.far).toBeGreaterThan(offset.length());
    // Its picture of the craft's centre is where the view's would be.
    const centre = new Vector3().project(seen);
    const viewed = at.clone().project(view);
    expect(centre.x).toBeCloseTo(viewed.x, 6);
    expect(centre.y).toBeCloseTo(viewed.y, 6);
  });
});
