/**
 * The asteroid belt (#372), the first feature on the contract (#380): its large asteroids'
 * orbits loaded the first time it is on, each drawn where it is at the moment shown, the
 * largest named, a tap on a name opening its card.
 */

import { loadOnce } from '../../state/loadOnce';
import { feature } from '../feature';
import { asteroidBelt } from './beltLayer';
import { asteroidCard } from './card';
import { asteroidPosition, loadAsteroids, type Asteroids } from './orbits';
import './asteroids.css';

export const asteroidsFeature = feature({
  id: 'asteroids',
  needs: ['cards', 'ephemerides', 'zoomRail'],
  picks: 'asteroid',
  // On or off with its layer.
  watches: (state) => [state.layers],
  mount(context) {
    const belt = context.globe.addLayer(asteroidBelt);
    const load = loadOnce<Asteroids>({
      fetch: () => loadAsteroids(`${context.base}data/asteroids.json`, context.fetchJson),
      what: 'the asteroids',
      context,
    });
    let on = false;
    let shownAt: number | null = null;

    return {
      show(state, jdTT) {
        shownAt = jdTT;
        const offered = state.mode === 'globe' && state.ma === null;
        context.zoomRail.setAsteroids(offered, state.layers.has('asteroids'));
        on = offered && state.layers.has('asteroids');
        if (!on) {
          belt.update(null);
          return;
        }
        const planets = context.ephemerides.planets();
        if (planets === null) void context.ephemerides.loadPlanets();
        const asteroids = load.value();
        if (asteroids === null) {
          load.want();
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
      load: () => load.report(on),
      pick(id) {
        const asteroids = load.value();
        const asteroid = asteroids?.asteroids.find((each) => each.number === id);
        if (asteroid !== undefined && asteroids !== null && shownAt !== null) {
          context.cards.show(asteroidCard(asteroid, asteroids.fitted, shownAt));
        }
      },
    };
  },
});
