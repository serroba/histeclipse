/**
 * A model in metres drawn over the scene (#796, #864): the scene is in Earth radii, where a depth
 * buffer cannot hold apart parts centimetres apart seen from metres away, so a craft or a
 * telescope close up has a scene of its own in metres about it, seen by a camera matched to the
 * view's each frame and drawn over it (`LayerHost.drawOver`): `metrePass`, which both use (#875).
 */

import {
  AmbientLight,
  DirectionalLight,
  Group,
  PerspectiveCamera,
  Scene,
  Vector3,
  type Quaternion,
} from 'three';

import type { CraftFrame } from './focus';
import type { LayerHost } from './layerHost';
import { EARTH_RADIUS_KM } from './spaceFrame';

/** Metres in the scene's unit, an Earth radius. */
export const METRES_PER_SCENE = EARTH_RADIUS_KM * 1000;

/**
 * `seen`, as the view's camera `view` sees it, for a model in metres about a craft at `at`
 * (scene units): the same lens and the same turn, placed relative to the craft in metres.
 */
export function cameraOnCraft(view: PerspectiveCamera, at: Vector3, seen: PerspectiveCamera): void {
  seen.copy(view);
  seen.position.copy(view.position).sub(at).multiplyScalar(METRES_PER_SCENE);
  const distance = seen.position.length();
  seen.near = Math.max(0.01, distance / 100);
  seen.far = distance * 100 + 1000;
  seen.updateProjectionMatrix();
  seen.updateMatrixWorld(true);
}

/** What the camera is held on, besides where it is and how it is turned. */
type Held = Pick<CraftFrame, 'id' | 'about'> & {
  /** Half its longest side, in metres. */
  readonly radius: number;
};

/** A scene of models in metres drawn over the view, lit by the Sun, held for the camera. */
export interface MetrePass {
  /** Where its models go, turned as it is placed. */
  readonly group: Group;
  /** Where it is in the view's scene (scene units), as last placed. */
  readonly at: Vector3;
  /** Places it at `at`, turned by `turn`, lit from the Sun's side as seen from there. */
  place(at: Vector3, turn: Quaternion): void;
  /** Holds the camera on it where it is placed. */
  hold(on: Held): void;
  /** Lets the camera go, if it held it. */
  release(): void;
}

export interface MetrePassOptions {
  /** Its group's name. */
  readonly name: string;
  /** The globe's data attribute naming what it draws, for the end-to-end tests. */
  readonly dataset: string;
  /** How much the side away from the Sun is lit, so it is not black. */
  readonly fill: number;
  /** Each frame, the id of what it draws, or null if nothing is to be drawn. */
  drawn(): string | null;
  /** Each frame it is drawn, before: its place again, if it moves on its own. */
  follow?(): void;
}

/**
 * The drawing shared by the craft's model (#796) and the ground's (#864): its own scene in
 * metres, sunlight and a fill, a camera matched to the view's, drawn over the view after each
 * frame while `drawn` names what it draws. Where it is and how it is turned is the layer's: a
 * craft's place in space, turned from the Sun; a site on Earth, standing up from it.
 */
export function metrePass(host: LayerHost<'holdCraft'>, options: MetrePassOptions): MetrePass {
  const scene = new Scene();
  const group = new Group();
  group.name = options.name;
  const sunlight = new DirectionalLight(0xfff4e0, 2.6);
  sunlight.target = group;
  scene.add(group, sunlight, new AmbientLight(0x8890a0, options.fill));
  const seen = new PerspectiveCamera();
  const at = new Vector3();
  let held = false;

  host.afterRender(() => {
    const { dataset } = host.container;
    const drawn = options.drawn();
    if (drawn === null) {
      Reflect.deleteProperty(dataset, options.dataset);
      return;
    }
    options.follow?.();
    cameraOnCraft(host.camera, at, seen);
    host.drawOver(scene, seen);
    dataset[options.dataset] = drawn;
  });

  return {
    group,
    at,
    place(where, turn) {
      at.copy(where);
      group.quaternion.copy(turn);
      // A directional light shines from its place toward its target: from the Sun's side.
      sunlight.position.copy(host.sunPosition()).sub(at).setLength(1000);
    },
    hold({ id, about, radius }) {
      host.holdCraft({
        id,
        about,
        position: at.clone(),
        rotation: group.quaternion.clone(),
        radius: radius / METRES_PER_SCENE,
      });
      held = true;
    },
    release() {
      if (held) host.holdCraft(null);
      held = false;
    },
  };
}
