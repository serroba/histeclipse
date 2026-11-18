/**
 * A telescope on the ground as its model, standing at its site on the globe (#864): when the
 * camera goes to it, the site is held for the camera to orbit, upright on Earth's surface with
 * east, up and south as the model's axes, turning with Earth; its model, and those of any
 * telescope within a few kilometres (Keck's and Subaru's on Mauna Kea), drawn over the globe in
 * metres (`globe/metreView.ts`), their own ground left out for the globe's.
 */

import {
  AmbientLight,
  Box3,
  DirectionalLight,
  Group,
  Matrix4,
  PerspectiveCamera,
  Quaternion,
  Scene,
  Vector3,
  type Object3D,
} from 'three';

import type { GeoPoint } from '../../core/geo';
import { geoToVector } from '../../globe/geo';
import type { LayerFactory } from '../../globe/layerHost';
import { cameraOnCraft, METRES_PER_SCENE } from '../../globe/metreView';
import { GROUND } from '../../models/kit';
import { releaseModel } from '../../models/releaseModel';
import { telescopeModel } from '../../models/telescopeModels';

export interface GroundSite extends GeoPoint {
  /** Its id in the telescopes record. */
  readonly id: string;
}

/** The telescope the camera is at, and those near enough to stand beside it (itself among them). */
export interface HeldSite {
  readonly held: GroundSite;
  readonly near: readonly GroundSite[];
}

/** Telescopes within this of the one the camera is at stand beside it (metres). */
export const NEAR_METRES = 3000;
const EARTH_METRES = METRES_PER_SCENE;

/** Metres east and north from `from` to `to`, on the ground: near enough flat at a few km. */
export function offsetMetres(from: GeoPoint, to: GeoPoint): [number, number] {
  const radians = Math.PI / 180;
  const east =
    (to.longitude - from.longitude) * radians * Math.cos(from.latitude * radians) * EARTH_METRES;
  const north = (to.latitude - from.latitude) * radians * EARTH_METRES;
  return [east, north];
}

/** The site's own axes in Earth's: east (+x), up (+y), south (+z), as a model stands (`kit.ts`). */
export function siteTurn(site: GeoPoint): Quaternion {
  const up = new Vector3(...geoToVector(site)).normalize();
  const east = new Vector3(0, 1, 0).cross(up).normalize();
  // Up × east is north; the model's +z is south.
  const south = up.clone().cross(east).negate();
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(east, up, south));
}

/** The telescopes standing near `held`, from those at `sites`. */
export function nearSites(held: GroundSite, sites: readonly GroundSite[]): GroundSite[] {
  return sites.filter((site) => Math.hypot(...offsetMetres(held, site)) <= NEAR_METRES);
}

/** Half the longest side of `model` (metres), its ground left out; its ground hidden too. */
export function standing(model: Object3D): number {
  model.updateMatrixWorld(true);
  const bounds = new Box3();
  model.traverse((part) => {
    if (part.name === GROUND) part.visible = false;
    else if (part.type === 'Mesh' || part.type === 'InstancedMesh') bounds.expandByObject(part);
  });
  const size = bounds.getSize(new Vector3());
  return Math.max(size.x, size.y, size.z) / 2;
}

/** Until its model has come, the camera holds this far out (metres): a large dish's half. */
const FIRST_RADIUS = 50;

/** The models standing at a site, in `group`: each built once, let go when no longer near. */
function siteModels(group: Group, done: (id: string, half: number) => void) {
  const built = new Map<string, Object3D>();
  return {
    has: (id: string) => built.has(id),
    build(one: GroundSite, here: GroundSite, wanted: () => boolean): void {
      const model = telescopeModel(one.id);
      if (model === undefined || built.has(one.id)) return;
      model.load().then(
        ({ build: make }) => {
          if (!wanted() || built.has(one.id)) return;
          const object = make();
          const half = standing(object);
          const [east, north] = offsetMetres(here, one);
          object.position.set(east, 0, -north);
          built.set(one.id, object);
          group.add(object);
          done(one.id, half);
        },
        () => {
          done(one.id, FIRST_RADIUS);
        },
      );
    },
    keep(ids: ReadonlySet<string>): void {
      for (const [id, object] of built) {
        if (ids.has(id)) continue;
        group.remove(object);
        releaseModel(object);
        built.delete(id);
      }
    },
  };
}

export const groundModel: LayerFactory<HeldSite | null> = (host) => {
  const scene = new Scene();
  const group = new Group();
  group.name = 'ground-model';
  const sunlight = new DirectionalLight(0xfff4e0, 2.6);
  sunlight.target = group;
  scene.add(group, sunlight, new AmbientLight(0x8890a0, 0.8));
  // Where the site is on Earth, turning with it: its place and turn read from it each frame.
  const anchor = new Group();
  host.onEarth.add(anchor);
  const seen = new PerspectiveCamera();
  const at = new Vector3();
  const turn = new Quaternion();
  let site: HeldSite | null = null;
  let radius = FIRST_RADIUS;
  let held = false;

  function place(): void {
    anchor.updateWorldMatrix(true, false);
    anchor.getWorldPosition(at);
    anchor.getWorldQuaternion(turn);
    group.quaternion.copy(turn);
    sunlight.position.copy(host.sunPosition()).sub(at).setLength(1000);
  }

  function hold(): void {
    if (site === null) return;
    host.holdCraft({
      id: site.held.id,
      about: 'earth',
      position: at.clone(),
      rotation: turn.clone(),
      radius: radius / METRES_PER_SCENE,
    });
    held = true;
  }

  const models = siteModels(group, (id, half) => {
    if (id === site?.held.id) {
      radius = half;
      hold();
    }
    host.requestRender();
  });

  host.afterRender(() => {
    const { dataset } = host.container;
    if (site === null || !models.has(site.held.id)) {
      delete dataset['groundModel'];
      return;
    }
    const before = at.clone();
    place();
    // Earth turns as the time plays: the site, and the camera on it, turn with it.
    if (before.distanceToSquared(at) > 1e-18) hold();
    cameraOnCraft(host.camera, at, seen);
    host.drawOver(scene, seen);
    dataset['groundModel'] = site.held.id;
  });

  return {
    update(next) {
      models.keep(new Set(next?.near.map(({ id }) => id) ?? []));
      if (next === null) {
        site = null;
        if (held) host.holdCraft(null);
        held = false;
        host.requestRender();
        return;
      }
      if (site?.held.id !== next.held.id) radius = FIRST_RADIUS;
      site = next;
      anchor.position.set(...geoToVector(next.held));
      anchor.quaternion.copy(siteTurn(next.held));
      place();
      hold();
      for (const one of next.near) {
        models.build(one, next.held, () => site?.near.some(({ id }) => id === one.id) === true);
      }
      host.requestRender();
    },
  };
};
