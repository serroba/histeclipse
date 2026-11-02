/** A full `TabletSky` for tests: DE441-fitted Moon, VSOP87 planets, the star catalogue. */

import moonData from 'astronomia/data/elpMppDe';
import earth from 'astronomia/data/vsop87Bearth';
import jupiter from 'astronomia/data/vsop87Bjupiter';
import mars from 'astronomia/data/vsop87Bmars';
import mercury from 'astronomia/data/vsop87Bmercury';
import saturn from 'astronomia/data/vsop87Bsaturn';
import venus from 'astronomia/data/vsop87Bvenus';
import { Moon } from 'astronomia/elp';
import { Planet } from 'astronomia/planetposition';

import deltaTTable from '../../public/data/delta-t.json' with { type: 'json' };
import skyData from '../../public/data/sky.json' with { type: 'json' };
import { createMoonEphemeris } from '../astro/moon';
import { createPlanetEphemeris } from '../astro/planets';
import { DeltaT } from '../time/deltaT';
import { BABYLON, starsByNumber, type TabletSky } from './tabletSky';

const deltaT = new DeltaT(deltaTTable);

export const testSky: TabletSky = {
  moon: createMoonEphemeris(moonData, Moon),
  planets: createPlanetEphemeris({ earth, mercury, venus, mars, jupiter, saturn }, Planet),
  stars: starsByNumber(skyData.stars),
  deltaT: (jd) => deltaT.seconds(jd),
  place: BABYLON,
};
