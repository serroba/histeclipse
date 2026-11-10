/**
 * The asteroid belt (#372), the first feature on the contract (#380): its large asteroids'
 * orbits loaded the first time it is on, each drawn where it is at the moment shown, the
 * largest named, a tap on a name opening its card.
 */

import { errorMessage } from '../../util/errors';
import type { Feature } from '../feature';
import { asteroidBelt } from './beltLayer';
import { asteroidCard } from './card';
import { asteroidPosition, loadAsteroids, type Asteroids } from './orbits';

export const asteroidsFeature: Feature = {
  id: 'asteroids',
  picks: 'asteroid',
  mount(context) {
    const belt = context.globe.addLayer(asteroidBelt);
    let asteroids: Asteroids | null = null;
    let asked = false;
    let shownAt: number | null = null;

    return {
      show(state, jdTT) {
        shownAt = jdTT;
        const offered = state.mode === 'globe' && state.ma === null;
        context.zoomRail.setAsteroids(offered, state.layers.has('asteroids'));
        if (!offered || !state.layers.has('asteroids')) {
          belt.update(null);
          return;
        }
        const planets = context.planets();
        if (planets === null) context.loadPlanets();
        if (asteroids === null) {
          if (asked) return;
          asked = true;
          loadAsteroids(`${context.base}data/asteroids.json`, context.fetchJson).then(
            (loaded) => {
              asteroids = loaded;
              context.refresh();
            },
            (error: unknown) => {
              asked = false;
              context.notify(`Could not load the asteroids: ${errorMessage(error)}`);
            },
          );
          return;
        }
        // From Earth's centre, as the scene places everything.
        const earth = planets?.heliocentric('earth', jdTT) ?? null;
        if (earth === null) return;
        const [ex, ey, ez] = earth;
        belt.update(
          asteroids.asteroids.map((asteroid) => {
            const [x, y, z] = asteroidPosition(asteroid, jdTT);
            return {
              number: asteroid.number,
              name: asteroid.name,
              diameterKm: asteroid.diameterKm,
              km: [x - ex, y - ey, z - ez],
            };
          }),
        );
      },
      pick(id) {
        const asteroid = asteroids?.asteroids.find((each) => each.number === id);
        if (asteroid !== undefined && asteroids !== null && shownAt !== null) {
          context.showCard(asteroidCard(asteroid, asteroids.fitted, shownAt));
        }
      },
    };
  },
};
