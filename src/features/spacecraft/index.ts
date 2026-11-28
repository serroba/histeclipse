/**
 * Every craft sent beyond Earth orbit (#350), the second feature on the contract (#380): the
 * record and Horizons's paths loaded the first time it is on, each craft's approximate path
 * worked out once, as it flies; each drawn where it was at the moment shown, named, a tap on a
 * name opening its card. With a mission named (#712), only its craft, each with its whole route,
 * a mission about Earth drawn about Earth as it was at each moment. Close up on a world, its
 * landers are marked where they came down, and craft at it are not drawn at its centre (#716).
 * A craft that stays about Earth (#795, Hubble) is drawn only with Earth close up: from further
 * off it would sit on Earth.
 */

import { lazyFeature } from '../lazyFeature';
import { closeOnEarth, NEEDS, seesModel } from './views';

export const spacecraftFeature = lazyFeature({
  id: 'spacecraft',
  needs: NEEDS,
  picks: 'craft',
  // On or off with its layer; a mission followed, or every craft.
  // On a craft, whether it is close enough to be its model, not its point (#796).
  watches: (state) => [
    state.layers,
    state.mission,
    state.on,
    seesModel(state.on?.id ?? null, state.camera.distance),
    closeOnEarth(state),
  ],
  // On the years' globe, with its layer on, or the Telescopes' (their craft fly, #849), or a
  // mission or a craft linked to.
  wanted: (state) =>
    state.mode === 'globe' &&
    state.ma === null &&
    (state.layers.has('spacecraft') ||
      state.layers.has('telescopes') ||
      state.mission !== null ||
      state.on !== null),
  // The zoom rail's spacecraft button says whether the layer is offered, and on, all the same.
  idle: (context, state) => {
    context.zoomRail.setSpacecraft(
      state.mode === 'globe' && state.ma === null,
      state.layers.has('spacecraft'),
    );
  },
  body: () => import('./body').then(({ mountSpacecraft }) => mountSpacecraft),
});

// The launches' own bar (#702), a part of the page, not of the layer: loaded with the site.
export { mountLaunches, type LaunchesContext, type LaunchesPart } from './launches';
