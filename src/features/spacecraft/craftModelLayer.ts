/**
 * The craft the camera is on, as a model (#796): where the craft is at the moment shown, turned
 * by its convention (craftAttitude.ts), at true size, lit by the Sun from its true direction with
 * a little fill so its shaded side is not black. Held for the camera to orbit.
 *
 * The scene is in Earth radii, where a depth buffer cannot hold apart parts a few centimetres
 * apart seen from metres away. So the model is drawn in metres over the view (`metrePass`,
 * `globe/metreView.ts`): nothing can come between the camera and a craft it is this close to.
 * Where the craft is, the
 * camera's place relative to it, is worked out in double precision, so the model stays steady
 * to well under a millimetre at L2, 1.5 million km out.
 */

import { Vector3, type Object3D } from 'three';
import type { LayerFactory, Triple } from '../../globe/layerHost';
import { metrePass } from '../../globe/metreView';
import { awayFromSun } from './craftAttitude';
import type { SceneCraft } from './craftLayer';
import { sceneModelOf, type SceneModel } from './craftModels';
import { releaseModel } from '../../models/releaseModel';

/** The craft the camera is on, as the spacecraft feature has it at the moment shown. */
export interface FocusedCraft {
  /** Its GCAT id. */
  readonly id: string;
  /** Where it is, from Earth's centre (J2000 km). */
  readonly km: Triple;
  readonly model: SceneModel;
}

/** The craft named, if it is among those shown and has a model to draw (#796). */
export function focusedCraft(
  named: string | null,
  shown: readonly Pick<SceneCraft, 'id' | 'km'>[],
): FocusedCraft | null {
  if (named === null) return null;
  const craft = shown.find(({ id }) => id.toLowerCase() === named);
  const model = craft === undefined ? undefined : sceneModelOf(craft.id);
  return craft === undefined || model === undefined ? null : { id: craft.id, km: craft.km, model };
}

/** Within this of the craft the camera is on (km), other craft are not drawn. */
const CROWDING_KM = 10_000;
/**
 * Nearer than this, in the craft's radii, its model is a few pixels across or more (some 4 at
 * 300 radii, with the view's 40°), and it is drawn as its model alone.
 */
const SEEN_AS_MODEL = 300;

/**
 * Whether `craft` is not drawn as a point beside the one the camera is on, with the camera
 * `distance` from it in its radii: close enough to see it, that one is drawn as its model, and
 * those right by it would sit on it, as every craft at L2 is placed at the point itself (their
 * halo orbits, hundreds of thousands of km across, are not drawn). Further out, its point marks
 * it again, and the others are there.
 */
/** Whether the camera is on a craft close enough to see its model, in its radii `distance`. */
export function seesModel(craft: string | null, distance: number): boolean {
  return craft !== null && distance < SEEN_AS_MODEL;
}

export function hiddenBy(
  focused: FocusedCraft | null,
  craft: Pick<SceneCraft, 'id' | 'km'>,
  distance: number,
): boolean {
  if (focused === null || !seesModel(focused.id, distance)) return false;
  const [x, y, z] = focused.km;
  return (
    craft.id === focused.id ||
    Math.hypot(craft.km[0] - x, craft.km[1] - y, craft.km[2] - z) < CROWDING_KM
  );
}

/**
 * The craft drawn as points with one the camera is on: those `hiddenBy` it left out, and it
 * first, so where others share its place, the name shown there is its own.
 */
export function pointsBeside<Craft extends Pick<SceneCraft, 'id' | 'km'>>(
  focused: FocusedCraft | null,
  shown: readonly Craft[],
  distance: number,
): readonly Craft[] {
  if (focused === null) return shown;
  const kept = shown.filter((craft) => !hiddenBy(focused, craft, distance));
  return [
    ...kept.filter(({ id }) => id === focused.id),
    ...kept.filter(({ id }) => id !== focused.id),
  ];
}

export const craftModel: LayerFactory<FocusedCraft | null> = (host) => {
  /** The model built, and whose. */
  let built: { readonly id: string; readonly object: Object3D } | null = null;
  /** The craft asked for: a model that comes in for another is not drawn. */
  let wanted: string | null = null;
  const pass = metrePass(host, {
    name: 'craft-model',
    dataset: 'craftModel',
    fill: 0.7,
    drawn: () => (wanted !== null && built?.id === wanted ? wanted.toLowerCase() : null),
  });

  function build(craft: FocusedCraft): void {
    const id = craft.id;
    craft.model.load().then(
      (make) => {
        if (wanted !== id || built?.id === id) return;
        if (built !== null) {
          pass.group.remove(built.object);
          releaseModel(built.object);
        }
        built = { id, object: make() };
        pass.group.add(built.object);
        host.requestRender();
      },
      () => {
        // Not drawn: the camera still orbits where the craft is, its point taken away.
        host.requestRender();
      },
    );
  }

  return {
    update(craft) {
      const toScene = host.spaceToScene();
      if (craft === null || toScene === null) {
        wanted = null;
        pass.release();
        host.requestRender();
        return;
      }
      const at = new Vector3(...toScene(craft.km));
      pass.place(at, awayFromSun(at, host.sunPosition()));
      if (wanted !== craft.id) {
        wanted = craft.id;
        if (built?.id !== craft.id) build(craft);
      }
      pass.hold({
        id: craft.id.toLowerCase(),
        about: craft.model.about,
        radius: craft.model.radius,
      });
      host.requestRender();
    },
    dispose() {
      if (built !== null) releaseModel(built.object);
    },
  };
};
