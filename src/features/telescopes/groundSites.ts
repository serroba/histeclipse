/**
 * Going to a telescope on the ground, to see its model standing at its site (#864): the step on
 * its card, and which telescopes stand there when the view names it.
 */

import type { Telescope, Telescopes } from '../../data/telescopes';
import { telescopeModel } from '../../models/telescopeModels';
import type { ViewState } from '../../state/viewState';
import type { MarkerCardContent } from '../../ui/markerCard';
import { nearSites, type GroundSite, type HeldSite } from './groundModelLayer';

type Ground = Extract<Telescope, { kind: 'ground' }>;

function siteOf(telescope: Ground): GroundSite {
  return {
    id: telescope.id,
    latitude: telescope.site.latitude,
    longitude: telescope.site.longitude,
  };
}

/** The ground telescope the view is at (#864, #876) and those beside it, if it is one. */
export function heldSite(record: Telescopes, on: string | null): HeldSite | null {
  const ground = record.telescopes.filter(
    (telescope): telescope is Ground => telescope.kind === 'ground',
  );
  const telescope = ground.find(({ id }) => id === on);
  if (telescope === undefined) return null;
  const held = siteOf(telescope);
  return { held, near: nearSites(held, ground.map(siteOf)) };
}

/** The view at a ground telescope, its model standing there, the camera orbiting it. */
function atSite(state: ViewState, telescope: Telescope): ViewState {
  return { ...state, on: { kind: 'site', id: telescope.id }, focus: 'earth', view: 'free' };
}

/** A ground telescope's card's step to its model at its site, if it has one. */
export function goToSite(
  telescope: Telescope,
  context: { change(update: (state: ViewState) => ViewState): void },
): Pick<MarkerCardContent, 'action'> {
  if (telescope.kind !== 'ground' || telescopeModel(telescope.id) === undefined) {
    return {};
  }
  return {
    action: {
      label: 'Go to it',
      run: () => {
        context.change((state) => atSite(state, telescope));
      },
    },
  };
}
