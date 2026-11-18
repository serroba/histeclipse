import { BoxGeometry, Group, Mesh, PerspectiveCamera, Vector3, type Scene } from 'three';
import { describe, expect, it, vi } from 'vitest';

import type { CraftFrame } from '../../globe/focus';
import type { LayerHost } from '../../globe/layerHost';
import { METRES_PER_SCENE } from '../../globe/metreView';
import { ground, materials } from '../../models/kit';
import {
  groundModel,
  nearSites,
  offsetMetres,
  siteTurn,
  standing,
  type GroundSite,
} from './groundModelLayer';

const KECK: GroundSite = { id: 'keck', latitude: 19.8263, longitude: -155.4742 };
const SUBARU: GroundSite = { id: 'subaru', latitude: 19.8255, longitude: -155.4761 };
const LOVELL: GroundSite = { id: 'lovell', latitude: 53.2369, longitude: -2.3075 };

describe('a telescope on the ground, where it stands (#864)', () => {
  it('Given a degree north, Then some 111 km; a degree east, less as the latitude grows', () => {
    const [east, north] = offsetMetres(
      { latitude: 0, longitude: 0 },
      { latitude: 1, longitude: 0 },
    );
    expect(east).toBeCloseTo(0, 6);
    expect(north / 1000).toBeCloseTo(111.3, 0);
    const [atSixty] = offsetMetres({ latitude: 60, longitude: 0 }, { latitude: 60, longitude: 1 });
    expect(atSixty / 1000).toBeCloseTo(111.3 / 2, 0);
  });

  it('Given a site, Then its model stands up from the ground, its +X east and −Z north', () => {
    const turn = siteTurn({ latitude: 0, longitude: 0 });
    expect(
      new Vector3(0, 1, 0)
        .applyQuaternion(turn)
        .toArray()
        .map((v) => +v.toFixed(9)),
    ).toEqual([1, 0, 0]);
    // East, at longitude 0, is −z in Earth's own axes (`geoToVector`).
    expect(new Vector3(1, 0, 0).applyQuaternion(turn).z).toBeCloseTo(-1, 9);
    expect(new Vector3(0, 0, -1).applyQuaternion(turn).y).toBeCloseTo(1, 9);
  });

  it('Given Keck, Then Subaru stands beside it and Lovell does not', () => {
    expect(nearSites(KECK, [KECK, SUBARU, LOVELL]).map(({ id }) => id)).toEqual(['keck', 'subaru']);
  });

  it('Given a model with its ground, Then its size leaves the ground out, and hides it', () => {
    const kit = materials();
    const disc = ground(500, kit);
    const model = new Group().add(new Mesh(new BoxGeometry(20, 30, 10), kit.steel), disc);
    expect(standing(model)).toBeCloseTo(15, 6);
    expect(disc.visible).toBe(false);
  });
});

function fakeHost() {
  const held: (CraftFrame | null)[] = [];
  const over: { scene: Scene; camera: PerspectiveCamera }[] = [];
  const earth = new Group();
  let afterRender: () => void = () => undefined;
  const container = { dataset: {} as Record<string, string> };
  const camera = new PerspectiveCamera(40, 1.5, 1e-6, 10);
  const host = {
    camera,
    container,
    onEarth: { add: (...objects: Group[]) => earth.add(...objects) },
    sunPosition: () => new Vector3(0, 0, -23_455),
    holdCraft: (craft: CraftFrame | null) => held.push(craft),
    afterRender: (place: () => void) => {
      afterRender = place;
    },
    drawOver: (scene: Scene, seen: PerspectiveCamera) => over.push({ scene, camera: seen }),
    requestRender: vi.fn(),
  } as unknown as LayerHost;
  return {
    host,
    held,
    over,
    container,
    earth,
    camera,
    frame: () => {
      afterRender();
    },
  };
}

describe('the ground model layer (#864)', () => {
  it('Given Keck named, Then its site is held on Earth’s surface, and its model and Subaru’s drawn over', async () => {
    const fake = fakeHost();
    const layer = groundModel(fake.host);
    layer.update({ held: KECK, near: [KECK, SUBARU] });
    const first = fake.held.at(-1);
    expect(first?.id).toBe('keck');
    expect(first?.position.length()).toBeCloseTo(1, 9);
    // Once its model has come, the camera holds it by its own size.
    await vi.waitFor(() => {
      expect((fake.held.at(-1)?.radius ?? 0) * METRES_PER_SCENE).not.toBeCloseTo(50, 0);
    });
    fake.camera.position.copy(first?.position ?? new Vector3()).multiplyScalar(1.0001);
    fake.camera.updateMatrixWorld();
    fake.frame();
    expect(fake.container.dataset['groundModel']).toBe('keck');
    const drawn = fake.over.at(-1)?.scene.getObjectByName('ground-model');
    await vi.waitFor(() => {
      expect(drawn?.children.length).toBe(2);
    });
    // As Earth turns, the site, and the camera holding it, turn with it.
    const before = fake.held.length;
    fake.earth.rotation.y = 0.01;
    fake.frame();
    expect(fake.held.length).toBe(before + 1);
    layer.update(null);
    expect(fake.held.at(-1)).toBeNull();
    fake.frame();
    expect(fake.container.dataset['groundModel']).toBeUndefined();
  });

  it('Given one without a model, Then the site is held and nothing drawn', () => {
    const fake = fakeHost();
    const layer = groundModel(fake.host);
    const nowhere: GroundSite = { id: 'not-modelled', latitude: 10, longitude: 10 };
    layer.update({ held: nowhere, near: [nowhere] });
    expect(fake.held.at(-1)?.id).toBe('not-modelled');
    fake.frame();
    expect(fake.over).toHaveLength(0);
  });

  it('Given another site, Then that one is held, from its first distance, and the first’s models let go', async () => {
    const fake = fakeHost();
    const layer = groundModel(fake.host);
    layer.update({ held: KECK, near: [KECK] });
    await vi.waitFor(() => {
      expect((fake.held.at(-1)?.radius ?? 0) * METRES_PER_SCENE).not.toBeCloseTo(50, 0);
    });
    layer.update({ held: LOVELL, near: [LOVELL] });
    expect(fake.held.at(-1)?.id).toBe('lovell');
    expect((fake.held.at(-1)?.radius ?? 0) * METRES_PER_SCENE).toBeCloseTo(50, 6);
  });
});
